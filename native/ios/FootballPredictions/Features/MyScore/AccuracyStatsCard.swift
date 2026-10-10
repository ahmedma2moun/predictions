import SwiftUI

struct AccuracyStatsCard: View {
    @Environment(\.palette) private var c
    let stats: AccuracyStats
    var weekPoints = 0
    var recentPoints: [Int] = []

    var body: some View {
        Card(padding: 0) {
            VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                Text("THIS WEEK").appFont(Tokens.FontSize.xs, .bold).tracking(0.8).foregroundStyle(c.mutedForeground)
                HStack(alignment: .bottom, spacing: Tokens.Spacing.md) {
                    HStack(alignment: .lastTextBaseline, spacing: 6) {
                        Text("\(weekPoints)")
                            .appFont(44, .bold, mono: true).tracking(-1).foregroundStyle(c.primary)
                            .contentTransition(.numericText())
                        Text("pts").appFont(Tokens.FontSize.md).foregroundStyle(c.mutedForeground)
                    }
                    Spacer(minLength: 0)
                    if !recentPoints.isEmpty { sparkline }
                }
            }
            .padding(Tokens.Spacing.lg)
            .padding(.bottom, -Tokens.Spacing.xs)
            .overlay(alignment: .bottom) { Rectangle().fill(c.border).frame(height: hairline) }

            HStack(spacing: 0) {
                statCell(value: "\(formatNumber(stats.correctWinnerPct))%", label: "Outcome", color: c.foreground)
                Rectangle().fill(c.border).frame(width: hairline).padding(.vertical, Tokens.Spacing.sm)
                statCell(value: "\(formatNumber(stats.exactScorePct))%", label: "Exact", color: c.primary)
                Rectangle().fill(c.border).frame(width: hairline).padding(.vertical, Tokens.Spacing.sm)
                statCell(value: stats.currentStreak > 0 ? "\(stats.currentStreak)" : "—", label: "Streak", color: c.warning)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var sparkline: some View {
        HStack(alignment: .bottom, spacing: 4) {
            ForEach(Array(recentPoints.suffix(10).enumerated()), id: \.offset) { _, pts in
                RoundedRectangle(cornerRadius: 2)
                    .fill(pts >= 6 ? c.primary : (pts > 0 ? c.primary.opacity(0.33) : c.border))
                    .frame(height: 36)
            }
        }
        .frame(height: 36)
        .frame(maxWidth: 140)
    }

    private func statCell(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).appFont(Tokens.FontSize.xl, .bold, mono: true).foregroundStyle(color)
            Text(label).appFont(Tokens.FontSize.xs).foregroundStyle(c.mutedForeground)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .padding(.horizontal, Tokens.Spacing.md)
    }
}
