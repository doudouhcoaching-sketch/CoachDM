import Foundation
import ActivityKit
import AppIntents

/* ==========================================================================
   COACH DM — LIVE ACTIVITY : donnees partagees
   Ce fichier est compile DEUX fois : dans l'app (target App) et dans l'extension
   (target CoachDMLive). Les deux doivent voir exactement les memes types.
   ========================================================================== */

@available(iOS 16.1, *)
struct CdmWorkoutAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String          /* nom de l'exercice, ou du timer */
        var detail: String         /* « Série 2/4 · 5 × 80 kg », « Récupère · ensuite … » */
        var phase: String          /* work | rest | timer | pause | done */
        var end: Date?             /* compte a rebours jusqu'a cette heure */
        var start: Date?           /* sinon chrono qui monte depuis cette heure */
        var canDone: Bool          /* bouton « Série faite » visible */
        var doneLabel: String
    }
    var kind: String
}

/* Le bouton « Série faite » de l'ecran verrouille. iOS l'execute DANS l'app
   (meme ecran verrouille, sans l'ouvrir) : le plugin CdmLive enchaine tout de suite
   le repos, la voix et la serie suivante. */
@available(iOS 17.0, *)
struct CdmSetDoneIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Série faite"
    static let isDiscoverable: Bool = false

    init() {}

    func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(name: Notification.Name("be.coachdm.live.done"), object: nil)
        return .result()
    }
}
