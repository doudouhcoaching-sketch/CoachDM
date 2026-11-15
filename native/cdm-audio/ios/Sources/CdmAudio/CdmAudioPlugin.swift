import Foundation
import AVFoundation
import UIKit
import Capacitor

/* ==========================================================================
   COACH DM — MOTEUR AUDIO NATIF (iOS)
   Pourquoi : dans la WebView, le son passait par Web Audio.
     1. WebKit prend la session audio en « lecture exclusive » : Spotify / Apple
        Music s'arretaient des que la voix ou un bip partait.
     2. Ecran verrouille, iOS gele le JavaScript : les annonces partaient en retard
        (decalage chrono / voix) ou sautaient.
   Ici :
     - session .playback + .mixWithOthers : la musique du membre ne s'arrete JAMAIS ;
       pendant une vraie phrase, .duckOthers la baisse, puis elle remonte.
     - AVAudioEngine tourne pendant toute la seance (son muet en boucle) : l'app
       reste eveillee ecran verrouille (UIBackgroundModes audio).
     - chaque son est place sur l'horloge audio a l'heure exacte (hostTime) :
       zero decalage, meme quand le JavaScript dort.
   Trois files :
     "fg" : la voix que l'app joue maintenant (une nouvelle phrase coupe la precedente) ;
     "fx" : les bips (jamais coupes par une phrase) ;
     "bg" : le programme a l'avance de tout ce qui doit etre dit si l'app passe en
            arriere-plan. Il ne joue QUE quand l'app est en arriere-plan (ecran
            verrouille, autre app), et 1,2 s apres son retour, le temps que le
            JavaScript reprenne la main.
   ========================================================================== */

@objc(CdmAudioPlugin)
public class CdmAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifierName = "CdmAudioPlugin"
    public let jsName = "CdmAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "put", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private let core = CdmAudioCore.shared

    /* debut d'un timer ou d'une seance : session audio + moteur, pour toute la duree */
    @objc func start(_ call: CAPPluginCall) {
        core.q.async { self.core.start(); call.resolve() }
    }

    /* fin du timer / de la seance : on rend la main a la musique quand tout est dit */
    @objc func stop(_ call: CAPPluginCall) {
        core.q.async { self.core.stop(); call.resolve() }
    }

    /* un son (voix deja traitee, bip) : PCM 16 bits mono 48 kHz, en base64 */
    @objc func put(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let b64 = call.getString("pcm"),
              let data = Data(base64Encoded: b64) else {
            call.reject("CdmAudio.put : id ou pcm manquant"); return
        }
        core.q.async { self.core.load(id: id, pcm: data); call.resolve() }
    }

    /* events : [{at: ms epoch, id?: son, tts?: texte, lang?: 'fr-FR', duck?: bool}] */
    @objc func schedule(_ call: CAPPluginCall) {
        let tag = call.getString("tag") ?? "fg"
        let replace = call.getBool("replace") ?? false
        let raw = call.getArray("events", JSObject.self) ?? []
        var evs: [CdmAudioCore.Ev] = []
        for e in raw {
            guard let at = CdmAudioPlugin.num(e["at"]) else { continue }
            let id = e["id"] as? String
            let tts = e["tts"] as? String
            if id == nil && tts == nil { continue }
            evs.append(CdmAudioCore.Ev(at: at, id: id, tts: tts, lang: e["lang"] as? String,
                                       duck: (e["duck"] as? Bool) ?? false, tag: tag))
        }
        core.q.async { self.core.schedule(evs, tag: tag, replace: replace); call.resolve() }
    }

    @objc func clear(_ call: CAPPluginCall) {
        let tag = call.getString("tag") ?? "fg"
        core.q.async { self.core.clear(tag: tag); call.resolve() }
    }

    static func num(_ v: JSValue?) -> Double? {
        if let n = v as? NSNumber { return n.doubleValue }
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        return nil
    }
}

final class CdmAudioCore {
    static let shared = CdmAudioCore()

    struct Ev {
        let at: Double
        let id: String?
        let tts: String?
        let lang: String?
        let duck: Bool
        let tag: String
    }

    private struct Live {
        let ev: Ev
        let end: Double
    }

    let q = DispatchQueue(label: "be.coachdm.audio", qos: .userInteractive)

    private static let rate: Double = 48000
    private let engine = AVAudioEngine()
    private let fmt = AVAudioFormat(standardFormatWithSampleRate: CdmAudioCore.rate, channels: 1)!
    private let keepNode = AVAudioPlayerNode()
    private var keepBuf: AVAudioPCMBuffer?
    private var pool: [String: [AVAudioPlayerNode]] = [:]
    private var busy: [ObjectIdentifier: Double] = [:]
    private var built = false

    private var clips: [String: AVAudioPCMBuffer] = [:]
    private var pending: [Ev] = []          /* trie par heure */
    private var live: [Live] = []           /* deja confies au moteur */
    private var horizon: [String: Double] = [:]

    private var keep = false                /* start() ... stop() */
    private var up = false                  /* session active + moteur qui tourne */
    private var ducked = false
    private var inBg = false
    private var fgAt: Double = 0
    private var idleSince: Double = 0
    private var lastCheck: Double = 0
    private var timer: DispatchSourceTimer?
    private let synth = AVSpeechSynthesizer()

    private init() {
        if Thread.isMainThread { inBg = UIApplication.shared.applicationState == .background }
        let nc = NotificationCenter.default
        nc.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil) { [weak self] _ in
            self?.q.async { self?.inBg = true }
        }
        nc.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: nil) { [weak self] _ in
            self?.q.async { self?.inBg = false; self?.fgAt = CdmAudioCore.now() }
        }
        /* appel, Siri, alarme : a la fin de l'interruption on repart, a l'heure */
        nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: nil) { [weak self] n in
            guard let self = self else { return }
            let raw = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let type = raw.flatMap { AVAudioSession.InterruptionType(rawValue: $0) }
            self.q.async {
                if type == .began { self.up = false }
                else if type == .ended && (self.keep || !self.pending.isEmpty) { self.restart(duck: false) }
            }
        }
        /* ecouteurs branches / debranches, AirPods, CarPlay : le moteur s'arrete, on le relance */
        nc.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil) { [weak self] _ in
            guard let self = self else { return }
            self.q.async { if self.up { self.restart(duck: self.ducked) } }
        }
    }

    static func now() -> Double { Date().timeIntervalSince1970 * 1000 }

    private static func host(_ atMs: Double) -> UInt64 {
        let dt = (atMs - now()) / 1000
        let h = mach_absolute_time()
        if dt <= 0 { return h }
        return h + AVAudioTime.hostTime(forSeconds: dt)
    }

    // MARK: - API (toujours sur q)

    func start() {
        keep = true
        ensureUp()
    }

    func stop() {
        keep = false
        pending.removeAll { $0.tag == "bg" }
        stopPool("bg")
    }

    func load(id: String, pcm: Data) {
        let n = pcm.count / 2
        guard n > 0,
              let buf = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: AVAudioFrameCount(n)),
              let ch = buf.floatChannelData?[0] else { return }
        pcm.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            for i in 0..<n {
                let v = Int16(bitPattern: UInt16(raw[2 * i]) | (UInt16(raw[2 * i + 1]) << 8))
                ch[i] = Float(v) / 32768
            }
        }
        buf.frameLength = AVAudioFrameCount(n)
        clips[id] = buf
    }

    func schedule(_ evs: [Ev], tag: String, replace: Bool) {
        if replace {
            /* nouveau programme complet : ce qui est deja parti au moteur n'est pas rejoue */
            pending.removeAll { $0.tag == tag }
            let h = horizon[tag] ?? 0
            pending.append(contentsOf: evs.filter { $0.at > h })
        } else {
            pending.append(contentsOf: evs)
        }
        pending.sort { $0.at < $1.at }
        if !pending.isEmpty { ensureUp() }
    }

    func clear(tag: String) {
        pending.removeAll { $0.tag == tag }
        live.removeAll { $0.ev.tag == tag }
        horizon[tag] = 0
        stopPool(tag)
        if tag == "fg" {
            DispatchQueue.main.async { if self.synth.isSpeaking { self.synth.stopSpeaking(at: .immediate) } }
        }
    }

    // MARK: - Moteur et session

    private func build() {
        if built { return }
        built = true
        engine.attach(keepNode)
        engine.connect(keepNode, to: engine.mainMixerNode, format: fmt)
        for tag in ["fg", "fx", "bg"] {
            var arr: [AVAudioPlayerNode] = []
            for _ in 0..<4 {
                let p = AVAudioPlayerNode()
                engine.attach(p)
                engine.connect(p, to: engine.mainMixerNode, format: fmt)
                arr.append(p)
            }
            pool[tag] = arr
        }
        let frames = AVAudioFrameCount(CdmAudioCore.rate / 10)
        if let silent = AVAudioPCMBuffer(pcmFormat: fmt, frameCapacity: frames), let ch = silent.floatChannelData?[0] {
            for i in 0..<Int(frames) { ch[i] = 0 }
            silent.frameLength = frames
            keepBuf = silent
        }
    }

    private func session(duck: Bool) throws {
        let s = AVAudioSession.sharedInstance()
        var o: AVAudioSession.CategoryOptions = [.mixWithOthers]
        if duck { o.insert(.duckOthers) }
        try s.setCategory(.playback, mode: .default, options: o)
        try s.setActive(true)
    }

    private func ensureUp() {
        if !up || !engine.isRunning { restart(duck: false) }
        startTimer()
    }

    /* (re)demarre tout. Les sons deja confies au moteur et pas encore joues sont
       reconfies : on ne perd rien, on n'arrive pas en retard. */
    private func restart(duck: Bool) {
        build()
        let t = CdmAudioCore.now()
        let again = live.filter { $0.ev.at >= t - 30 }.map { $0.ev }
        live.removeAll()
        busy.removeAll()
        for arr in pool.values { arr.forEach { $0.stop() } }
        keepNode.stop()
        if engine.isRunning { engine.stop() }
        /* la musique ne remonte (ou ne baisse) qu'a la reactivation de la session */
        if up { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
        do {
            try session(duck: duck)
            engine.prepare()
            try engine.start()
            up = true
            ducked = duck
        } catch {
            up = false
            NSLog("[CdmAudio] demarrage impossible : %@", error.localizedDescription)
            return
        }
        if let kb = keepBuf {
            keepNode.scheduleBuffer(kb, at: nil, options: .loops, completionHandler: nil)
            keepNode.play()
        }
        for arr in pool.values { arr.forEach { $0.play() } }
        if !again.isEmpty {
            pending.insert(contentsOf: again, at: 0)
            pending.sort { $0.at < $1.at }
        }
    }

    private func shutdown() {
        for arr in pool.values { arr.forEach { $0.stop() } }
        keepNode.stop()
        if engine.isRunning { engine.stop() }
        if up { try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) }
        up = false
        ducked = false
        busy.removeAll()
        timer?.cancel()
        timer = nil
    }

    private func stopPool(_ tag: String) {
        guard let arr = pool[tag] else { return }
        for p in arr {
            p.stop()
            busy[ObjectIdentifier(p)] = nil
            if up && engine.isRunning { p.play() }
        }
    }

    private func startTimer() {
        if timer != nil { return }
        let tm = DispatchSource.makeTimerSource(queue: q)
        tm.schedule(deadline: .now(), repeating: .milliseconds(25), leeway: .milliseconds(5))
        tm.setEventHandler { [weak self] in self?.tick() }
        tm.resume()
        timer = tm
    }

    /* "bg" ne joue qu'en arriere-plan (+ 1,2 s apres le retour) ; "fg" et "fx" toujours */
    private func active(_ tag: String, _ t: Double) -> Bool {
        return tag != "bg" || inBg || t < fgAt + 1200
    }

    // MARK: - Boucle (25 ms)

    private func tick() {
        let t = CdmAudioCore.now()

        /* 1. la session est-elle toujours la notre ? (WebKit peut la reprendre) */
        if up && t - lastCheck > 1000 {
            lastCheck = t
            let s = AVAudioSession.sharedInstance()
            let o = s.categoryOptions
            if !engine.isRunning || s.category != .playback || !o.contains(.mixWithOthers) && !o.contains(.duckOthers) {
                restart(duck: ducked)
            }
        }

        /* 2. musique baissee pendant une vraie phrase (350 ms avant, 600 ms apres).
              Une fois baissee, elle reste baissee si une autre phrase arrive dans
              les 1,5 s : pas de « pompage ». */
        var want = false
        for l in live where l.ev.duck && t <= l.end + 600 { want = true; break }
        if !want {
            let lead: Double = ducked ? 1500 : 350
            for e in pending {
                if e.at - lead > t { break }
                if e.duck && active(e.tag, t) && e.at >= t - 600 { want = true; break }
            }
        }
        if up && want != ducked { restart(duck: want) }
        if !up && (keep || !pending.isEmpty) && t - lastCheck > 1000 { lastCheck = t; restart(duck: false) }

        /* 3. on confie au moteur ce qui doit sonner dans les 250 ms */
        if up && engine.isRunning {
            var i = 0
            while i < pending.count {
                let e = pending[i]
                if e.at > t + 250 { break }
                if e.at < t - 600 { pending.remove(at: i); continue }   /* jamais en retard : on saute */
                if !active(e.tag, t) { i += 1; continue }
                pending.remove(at: i)
                fire(e, t)
            }
        }
        live.removeAll { $0.end < t - 1000 }

        /* 4. plus rien a jouer et plus de seance : on rend la main apres 4 s */
        if !keep && pending.isEmpty && live.isEmpty {
            if idleSince == 0 { idleSince = t } else if t - idleSince > 4000 { idleSince = 0; shutdown() }
        } else {
            idleSince = 0
        }
    }

    private func fire(_ e: Ev, _ t: Double) {
        horizon[e.tag] = max(horizon[e.tag] ?? 0, e.at)
        if let id = e.id, let buf = clips[id], let arr = pool[e.tag], !arr.isEmpty {
            /* un lecteur libre a cette heure-la (sinon le son attendrait la fin du precedent) */
            var pick = arr[0]
            var best = Double.greatestFiniteMagnitude
            for p in arr {
                let b = busy[ObjectIdentifier(p)] ?? 0
                if b <= e.at { pick = p; break }
                if b < best { best = b; pick = p }
            }
            let dur = Double(buf.frameLength) / CdmAudioCore.rate * 1000
            let start = max(e.at, t)
            busy[ObjectIdentifier(pick)] = start + dur
            if !pick.isPlaying { pick.play() }
            pick.scheduleBuffer(buf, at: AVAudioTime(hostTime: CdmAudioCore.host(e.at)), options: [], completionHandler: nil)
            live.append(Live(ev: e, end: start + dur))
        } else if let text = e.tts {
            let delay = max(0, e.at - t) / 1000
            let lang = e.lang ?? "fr-FR"
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self = self else { return }
                let u = AVSpeechUtterance(string: text)
                u.voice = AVSpeechSynthesisVoice(language: lang)
                self.synth.speak(u)
            }
            live.append(Live(ev: e, end: max(e.at, t) + 600 + Double(text.count) * 65))
        }
    }
}
