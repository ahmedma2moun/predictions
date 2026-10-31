import SwiftUI
import WidgetKit

@main
struct FootballPredictionsWidgets: WidgetBundle {
    var body: some Widget { NextMatchWidget() }
}

struct NextMatchWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextMatchWidget", provider: SnapshotProvider()) { entry in
            NextMatchWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("Next match")
        .description("The next match to predict, your rank, and how many picks are missing.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct SnapshotProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry { SnapshotEntry(date: Date(), snapshot: .sample) }

    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        completion(SnapshotEntry(date: Date(), snapshot: context.isPreview ? .sample : .load()))
    }

    /// Entries now and at kickoff, so the widget flips to "Locked" on time without the app running.
    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let snapshot = WidgetSnapshot.load()
        let now = Date()
        var entries = [SnapshotEntry(date: now, snapshot: snapshot)]
        if let kickoff = snapshot.next?.kickoff, kickoff > now {
            entries.append(SnapshotEntry(date: kickoff, snapshot: snapshot))
        }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
    }
}

struct NextMatchWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    let entry: SnapshotEntry

    private var p: Palette { scheme == .dark ? Tokens.dark : Tokens.light }
    private var snapshot: WidgetSnapshot { entry.snapshot }

    var body: some View {
        Group {
            if family == .systemMedium {
                HStack(spacing: 14) {
                    matchColumn.frame(maxWidth: .infinity, alignment: .leading)
                    Rectangle().fill(p.border).frame(width: 1)
                    standingColumn.frame(width: 110, alignment: .leading)
                }
            } else {
                matchColumn
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(14)
        .background(p.card)
        .widgetURL(url)
    }

    private var url: URL {
        if let next = snapshot.next, snapshot.signedIn { return WidgetLink.match(next.id) }
        return WidgetLink.matches
    }

    // MARK: Match

    @ViewBuilder private var matchColumn: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !snapshot.signedIn {
                label("PREDICTIONS")
                Text("Sign in to start predicting").font(.system(size: 14, weight: .semibold)).foregroundStyle(p.foreground)
            } else if let next = snapshot.next {
                let locked = snapshot.isLocked(next, at: entry.date)
                label(locked ? "LOCKED" : "NEXT MATCH")
                Text(next.home).font(.system(size: 17, weight: .bold)).foregroundStyle(p.foreground).lineLimit(1).minimumScaleFactor(0.7)
                Text("v \(next.away)").font(.system(size: 14, weight: .medium)).foregroundStyle(p.mutedForeground).lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 0)
                if locked {
                    Text("Kicked off").font(.system(size: 12, weight: .semibold)).foregroundStyle(p.mutedForeground)
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "clock").font(.system(size: 10))
                        Text(next.kickoff, style: .relative).font(.system(size: 12, weight: .semibold, design: .monospaced))
                    }
                    .foregroundStyle(p.warning)
                }
                Text(next.kickoffLabel).font(.system(size: 10)).foregroundStyle(p.mutedForeground).lineLimit(1)
                pickBadge(next, locked: locked)
            } else {
                label("PREDICTIONS")
                Text("No upcoming matches").font(.system(size: 14, weight: .semibold)).foregroundStyle(p.foreground)
            }
        }
    }

    private func pickBadge(_ match: WidgetMatch, locked: Bool) -> some View {
        let picked = match.prediction
        let text = picked.map { "Picked \($0)" } ?? (locked ? "No pick" : "Predict now")
        let tint = picked != nil ? p.success : (locked ? p.mutedForeground : p.primary)
        return Text(text)
            .font(.system(size: 10.5, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(tint.opacity(0.15), in: Capsule())
    }

    // MARK: Standing

    @ViewBuilder private var standingColumn: some View {
        VStack(alignment: .leading, spacing: 6) {
            label("YOUR RANK")
            if let rank = snapshot.rank {
                Text("#\(rank)").font(.system(size: 30, weight: .bold)).foregroundStyle(p.primary)
                Text([snapshot.players.map { "of \($0)" }, snapshot.points.map { "\($0) pts" }].compactMap { $0 }.joined(separator: " · "))
                    .font(.system(size: 10)).foregroundStyle(p.mutedForeground).lineLimit(2)
            } else {
                Text("—").font(.system(size: 30, weight: .bold)).foregroundStyle(p.mutedForeground)
                Text("Open Leaders to set").font(.system(size: 10)).foregroundStyle(p.mutedForeground)
            }
            Spacer(minLength: 0)
            if snapshot.signedIn {
                Link(destination: snapshot.missingPicks > 0 ? WidgetLink.slip : WidgetLink.leaders) {
                    Text(snapshot.missingPicks > 0 ? "\(snapshot.missingPicks) need a pick" : "All picks in")
                        .font(.system(size: 10.5, weight: .bold))
                        .foregroundStyle(snapshot.missingPicks > 0 ? p.primary : p.success)
                }
            }
        }
    }

    private func label(_ text: String) -> some View {
        Text(text).font(.system(size: 9.5, weight: .bold)).tracking(0.8).foregroundStyle(p.mutedForeground)
    }
}
