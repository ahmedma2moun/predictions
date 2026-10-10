import SwiftUI

/// Icon-only trigger — tap opens a popup listing only the matched rules. The odds ×N row is inserted
/// right after `correct_winner` when the bonus actually changed the score.
struct ScoringBreakdown: View {
    @Environment(\.palette) private var c
    let rules: [ScoringRuleBreakdown]
    var bonus: OddsBonus?
    @State private var open = false

    private var matched: [ScoringRuleBreakdown] { rules.filter(\.awarded) }
    private var bonusApplied: Bool { bonus.map { $0.finalScore != $0.baseScore } ?? false }

    var body: some View {
        if !matched.isEmpty {
            Button { open = true } label: {
                Image(systemName: AppIcon.info)
                    .font(.system(size: 13))
                    .foregroundStyle(c.mutedForeground)
                    .frame(width: 18, height: 18)
                    .contentShape(Rectangle().inset(by: -8))
            }
            .buttonStyle(PressableStyle(pressedOpacity: 0.6))
            .accessibilityLabel("View scoring breakdown")
            .popover(isPresented: $open, attachmentAnchor: .point(.center)) {
                popoverContent
                    .presentationCompactAdaptation(.popover)
            }
        }
    }

    private var popoverContent: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Rules matched").appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground)
                .padding(.bottom, 2)
            ForEach(matched, id: \.key) { rule in
                VStack(spacing: 2) {
                    HStack(spacing: Tokens.Spacing.lg) {
                        Text(rule.name).appFont(Tokens.FontSize.xs, .medium).foregroundStyle(c.success)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("+\(rule.points)").appFont(Tokens.FontSize.xs, .semibold).monospacedDigit().foregroundStyle(c.success)
                    }
                    if bonusApplied, rule.key == "correct_winner", let bonus {
                        HStack {
                            Text("Odds ×\(String(format: "%.2f", bonus.outcomeOdds))")
                                .appFont(Tokens.FontSize.xs, .medium).foregroundStyle(c.warning)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text("→ \(Int((Double(rule.points) * bonus.outcomeOdds).rounded()))")
                                .appFont(Tokens.FontSize.xs, .semibold).monospacedDigit().foregroundStyle(c.warning)
                        }
                        .padding(.leading, Tokens.Spacing.sm)
                    }
                }
            }
        }
        .padding(.vertical, Tokens.Spacing.md)
        .padding(.horizontal, Tokens.Spacing.lg)
        .frame(minWidth: 220, maxWidth: 320)
        .background(c.card)
        .environment(\.palette, c)
    }
}
