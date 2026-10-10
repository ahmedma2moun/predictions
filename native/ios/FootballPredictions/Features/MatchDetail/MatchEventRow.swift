import SwiftUI

struct DisplayMatchEvent: Equatable {
    let event: MatchEvent
    let icons: [String]
    let ownGoal: Bool
}

private func singleIcon(_ event: MatchEvent) -> (icon: String, ownGoal: Bool) {
    if event.type == .goal {
        return ("⚽", event.detail.lowercased().contains("own"))
    }
    return (event.detail.lowercased().contains("red") ? "🟥" : "🟨", false)
}

/// A second-yellow dismissal arrives as two timeline entries (Yellow then Red, same player/minute/team).
/// Collapse that pair into one row showing both icons.
func mergeMatchEvents(_ events: [MatchEvent]) -> [DisplayMatchEvent] {
    let sorted = events.enumerated().sorted { ($0.element.minute, $0.offset) < ($1.element.minute, $1.offset) }.map(\.element)
    var used = Set<Int>()
    var result: [DisplayMatchEvent] = []

    for (i, e) in sorted.enumerated() {
        if used.contains(i) { continue }
        if e.type == .card, e.detail.lowercased().contains("yellow") {
            let j = sorted.indices.first { idx in
                idx > i && !used.contains(idx) && sorted[idx].type == .card
                    && sorted[idx].detail.lowercased().contains("red")
                    && sorted[idx].player == e.player && sorted[idx].minute == e.minute && sorted[idx].team == e.team
            }
            if let j {
                used.insert(i); used.insert(j)
                result.append(DisplayMatchEvent(event: sorted[j], icons: ["🟨", "🟥"], ownGoal: false))
                continue
            }
        }
        used.insert(i)
        let single = singleIcon(e)
        result.append(DisplayMatchEvent(event: e, icons: [single.icon], ownGoal: single.ownGoal))
    }
    return result
}

struct MatchEventRow: View {
    @Environment(\.palette) private var c
    let item: DisplayMatchEvent

    private var isHome: Bool { item.event.team == .home }

    var body: some View {
        HStack(spacing: Tokens.Spacing.sm) {
            HStack(spacing: 6) {
                Spacer(minLength: 0)
                Text(item.event.player).appFont(Tokens.FontSize.sm).foregroundStyle(c.foreground).lineLimit(1)
                icon
            }
            .opacity(isHome ? 1 : 0)
            Text("\(item.event.minute)'")
                .appFont(Tokens.FontSize.xs, mono: true).foregroundStyle(c.mutedForeground)
                .frame(width: 32)
            HStack(spacing: 6) {
                icon
                Text(item.event.player).appFont(Tokens.FontSize.sm).foregroundStyle(c.foreground).lineLimit(1)
                Spacer(minLength: 0)
            }
            .opacity(isHome ? 0 : 1)
        }
        .padding(.vertical, 5)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(item.event.minute) minutes, \(item.event.player), \(item.event.type == .goal ? (item.ownGoal ? "own goal" : "goal") : "card")")
    }

    private var icon: some View {
        HStack(spacing: 1) {
            ForEach(Array(item.icons.enumerated()), id: \.offset) { _, glyph in
                Text(glyph).font(.system(size: 11))
            }
        }
        .padding(.horizontal, item.icons.count > 1 ? 4 : 0)
        .frame(minWidth: 20, minHeight: 20)
        .background(item.ownGoal ? c.live.opacity(0.15) : .clear, in: Capsule())
    }
}
