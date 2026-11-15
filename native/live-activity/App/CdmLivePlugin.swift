import Foundation
import Capacitor
import ActivityKit
import CdmAudio

/* ==========================================================================
   COACH DM — PLUGIN LIVE ACTIVITY (target App)
   show({timeline}) : la suite des etats a afficher, chacun a son heure
                      (repos -> serie suivante, phases du Timer…). Le plugin passe
                      d'un etat au suivant tout seul, meme si le JavaScript dort.
   arm({arm})       : ce qu'il faut faire si le membre touche « Série faite » sur
                      l'ecran verrouille : sons (relatifs au toucher), chronologie,
                      et le niveau suivant (next) pour la serie d'apres.
   end()            : retire la carte.
   Evenement "done" {at} : le JavaScript valide la serie a l'heure exacte du toucher.
   ========================================================================== */

@objc(CdmLivePlugin)
public class CdmLivePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifierName = "CdmLivePlugin"
    public let jsName = "CdmLive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "arm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    private let lq = DispatchQueue(label: "be.coachdm.live")
    private var timeline: [(at: Double, s: JSObject)] = []
    private var armed: JSObject?
    private var shown = ""
    private var activity: Any?
    private var ticker: DispatchSourceTimer?
    private var lastDone: Double = 0

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(onDone),
                                               name: Notification.Name("be.coachdm.live.done"), object: nil)
        /* une carte restee d'une session precedente (app fermee) : on la retire */
        if #available(iOS 16.2, *) {
            Task {
                for a in Activity<CdmWorkoutAttributes>.activities { await a.end(nil, dismissalPolicy: .immediate) }
            }
        }
    }

    private static func now() -> Double { Date().timeIntervalSince1970 * 1000 }

    private static func num(_ v: JSValue?) -> Double? {
        if let n = v as? NSNumber { return n.doubleValue }
        if let d = v as? Double { return d }
        if let i = v as? Int { return Double(i) }
        return nil
    }

    private static func plain(_ o: JSObject) -> [String: Any] {
        var d: [String: Any] = [:]
        for (k, v) in o { d[k] = v }
        return d
    }

    @objc func show(_ call: CAPPluginCall) {
        let raw = call.getArray("timeline", JSObject.self) ?? []
        lq.async {
            self.timeline = raw.compactMap { o -> (at: Double, s: JSObject)? in
                guard let at = CdmLivePlugin.num(o["at"]), let s = o["s"] as? JSObject else { return nil }
                return (at, s)
            }.sorted { $0.at < $1.at }
            if self.timeline.isEmpty { self.stop() } else { self.apply(); self.startTicker() }
            call.resolve()
        }
    }

    @objc func arm(_ call: CAPPluginCall) {
        let a = call.getObject("arm")
        lq.async { self.armed = a; call.resolve() }
    }

    @objc func end(_ call: CAPPluginCall) {
        lq.async { self.timeline = []; self.armed = nil; self.stop(); call.resolve() }
    }

    /* ---- « Série faite » touche sur l'ecran verrouille ---- */
    @objc func onDone() {
        lq.async {
            let t = CdmLivePlugin.now()
            if t - self.lastDone < 800 { return }          /* double toucher */
            self.lastDone = t
            if let a = self.armed {
                /* 1. la voix et les bips du repos, a l'heure, sans attendre le JavaScript */
                let evs = ((a["events"] as? JSArray) ?? []).compactMap { $0 as? JSObject }.map { e -> [String: Any] in
                    var d = CdmLivePlugin.plain(e)
                    if let at = CdmLivePlugin.num(e["at"]) { d["at"] = t + at }
                    return d
                }
                CdmAudioBridge.schedule(evs, tag: "bg", replace: true)
                /* 2. la carte passe au repos, puis a la serie suivante */
                let tl = ((a["timeline"] as? JSArray) ?? []).compactMap { $0 as? JSObject }
                self.timeline = tl.compactMap { o -> (at: Double, s: JSObject)? in
                    guard let at = CdmLivePlugin.num(o["at"]), var s = o["s"] as? JSObject else { return nil }
                    if let e = CdmLivePlugin.num(s["endIn"]) { s["end"] = t + e; s["endIn"] = nil }
                    return (t + at, s)
                }.sorted { $0.at < $1.at }
                /* 3. la serie d'apres est deja preparee */
                self.armed = a["next"] as? JSObject
                self.shown = ""
                self.apply()
                self.startTicker()
            }
            DispatchQueue.main.async {
                self.notifyListeners("done", data: ["at": t], retainUntilConsumed: true)
            }
        }
    }

    // MARK: - Carte

    private func startTicker() {
        if ticker != nil { return }
        let tm = DispatchSource.makeTimerSource(queue: lq)
        tm.schedule(deadline: .now() + .milliseconds(250), repeating: .milliseconds(250), leeway: .milliseconds(50))
        tm.setEventHandler { [weak self] in self?.apply() }
        tm.resume()
        ticker = tm
    }

    private func apply() {
        guard !timeline.isEmpty else { return }
        let t = CdmLivePlugin.now()
        var cur = timeline[0].s
        for e in timeline where e.at <= t { cur = e.s }
        let key = String(describing: cur.sorted { $0.key < $1.key }.map { "\($0.key)=\($0.value)" })
        if key == shown { return }
        shown = key
        push(cur)
    }

    private func push(_ s: JSObject) {
        guard #available(iOS 16.2, *) else { return }
        let date: (JSValue?) -> Date? = { v in CdmLivePlugin.num(v).map { Date(timeIntervalSince1970: $0 / 1000) } }
        let st = CdmWorkoutAttributes.ContentState(
            title: (s["title"] as? String) ?? "",
            detail: (s["detail"] as? String) ?? "",
            phase: (s["phase"] as? String) ?? "work",
            end: date(s["end"]),
            start: date(s["start"]),
            canDone: (s["canDone"] as? Bool) ?? false,
            doneLabel: (s["doneLabel"] as? String) ?? "Série faite")
        let content = ActivityContent(state: st, staleDate: nil)
        if let a = activity as? Activity<CdmWorkoutAttributes>, a.activityState == .active {
            Task { await a.update(content) }
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        do {
            activity = try Activity.request(attributes: CdmWorkoutAttributes(kind: "workout"), content: content, pushType: nil)
        } catch {
            NSLog("[CdmLive] %@", error.localizedDescription)
        }
    }

    private func stop() {
        ticker?.cancel()
        ticker = nil
        shown = ""
        if #available(iOS 16.2, *), let a = activity as? Activity<CdmWorkoutAttributes> {
            Task { await a.end(nil, dismissalPolicy: .immediate) }
        }
        activity = nil
    }
}
