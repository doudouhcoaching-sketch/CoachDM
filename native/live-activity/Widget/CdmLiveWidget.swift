import WidgetKit
import SwiftUI
import ActivityKit
import AppIntents

/* ==========================================================================
   COACH DM — LIVE ACTIVITY (ecran verrouille + Dynamic Island)
   Noir et or, comme l'app. Signe « Coach DM » uniquement.
   ========================================================================== */

private let cdmGold = Color(red: 0.863, green: 0.733, blue: 0.447)        /* #DCBB72 */
private let cdmGoldHi = Color(red: 0.914, green: 0.780, blue: 0.404)      /* #E9C767 */
private let cdmGoldLo = Color(red: 0.788, green: 0.635, blue: 0.306)      /* #C9A24E */
private let cdmInk = Color(red: 0.043, green: 0.043, blue: 0.039)         /* #0B0B0A */

@main
struct CdmLiveBundle: WidgetBundle {
    var body: some Widget {
        CdmLiveWidget()
    }
}

struct CdmLiveWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CdmWorkoutAttributes.self) { ctx in
            CdmLockView(s: ctx.state)
                .activityBackgroundTint(cdmInk)
                .activitySystemActionForegroundColor(cdmGold)
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    CdmMark().padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CdmClock(s: ctx.state)
                        .font(.system(size: 24, weight: .bold).monospacedDigit())
                        .foregroundColor(ctx.state.phase == "rest" ? cdmGold : .white)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 96, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(ctx.state.title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 10) {
                        Text(ctx.state.detail)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.7))
                            .lineLimit(2)
                        Spacer(minLength: 4)
                        CdmDoneButton(s: ctx.state)
                    }
                }
            } compactLeading: {
                CdmMark()
            } compactTrailing: {
                CdmClock(s: ctx.state)
                    .font(.system(size: 13, weight: .semibold).monospacedDigit())
                    .foregroundColor(ctx.state.phase == "rest" ? cdmGold : .white)
                    .frame(maxWidth: 54)
            } minimal: {
                CdmMark()
            }
            .keylineTint(cdmGold)
        }
    }
}

struct CdmMark: View {
    var body: some View {
        Text("DM")
            .font(.system(size: 13, weight: .heavy))
            .foregroundColor(cdmGold)
    }
}

struct CdmClock: View {
    let s: CdmWorkoutAttributes.ContentState
    var body: some View {
        if let e = s.end, e > Date() {
            Text(timerInterval: Date()...e, countsDown: true)
        } else if let st = s.start {
            Text(st, style: .timer)
        } else if s.phase == "done" {
            Text("✓")
        } else {
            Text(" ")
        }
    }
}

struct CdmDoneButton: View {
    let s: CdmWorkoutAttributes.ContentState
    var body: some View {
        if s.canDone {
            if #available(iOS 17.0, *) {
                Button(intent: CdmSetDoneIntent()) {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .heavy))
                        Text(s.doneLabel)
                            .font(.system(size: 14, weight: .bold))
                            .lineLimit(1)
                    }
                    .foregroundColor(cdmInk)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(
                        Capsule().fill(LinearGradient(colors: [cdmGoldHi, cdmGoldLo], startPoint: .top, endPoint: .bottom))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct CdmLockView: View {
    let s: CdmWorkoutAttributes.ContentState
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("COACH DM")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(1.6)
                    .foregroundColor(cdmGold)
                Text(s.title)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text(s.detail)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.68))
                    .lineLimit(2)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 8) {
                CdmClock(s: s)
                    .font(.system(size: 32, weight: .bold).monospacedDigit())
                    .foregroundColor(s.phase == "rest" ? cdmGold : .white)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 120, alignment: .trailing)
                CdmDoneButton(s: s)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}
