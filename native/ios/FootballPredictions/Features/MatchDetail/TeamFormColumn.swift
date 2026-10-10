import SwiftUI

struct TeamFormColumn: View {
    @Environment(\.palette) private var c
    let teamName: String?
    let matches: [TeamFormMatch]

    private func badgeColors(_ result: FormResult?) -> (bg: Color, fg: Color) {
        switch result {
        case .W: return (c.primary.opacity(0.15), c.primary)
        case .L: return (Tokens.Fixed.formLossFill, Tokens.Fixed.formLoss)
        default: return (c.cardElevated, c.mutedForeground)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
            Text(teamName ?? "—").appFont(Tokens.FontSize.xs, .medium).foregroundStyle(c.foreground).lineLimit(1)
            HStack(spacing: 4) {
                ForEach(Array(matches.enumerated()), id: \.offset) { _, m in
                    let colors = badgeColors(m.result)
                    Text(m.result?.rawValue ?? "–")
                        .appFont(Tokens.FontSize.xxs, .bold).foregroundStyle(colors.fg)
                        .frame(width: 20, height: 20)
                        .background(colors.bg, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
                }
            }
            VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                ForEach(Array(matches.enumerated()), id: \.offset) { _, m in
                    HStack(spacing: 4) {
                        HStack(spacing: 4) {
                            if let logo = m.opponentLogo { RemoteImage(url: logo, size: 14, cornerRadius: 2) }
                            Muted("\(m.isHome ? "vs" : "@") \(m.opponentName)", size: Tokens.FontSize.xs).lineLimit(1)
                        }
                        Spacer(minLength: 4)
                        Text("\(m.teamScore.map(String.init) ?? "–")-\(m.opponentScore.map(String.init) ?? "–")")
                            .appFont(Tokens.FontSize.xs, .semibold).monospacedDigit().foregroundStyle(c.foreground)
                    }
                }
                if matches.isEmpty { Muted("No recent games", size: Tokens.FontSize.xs) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
