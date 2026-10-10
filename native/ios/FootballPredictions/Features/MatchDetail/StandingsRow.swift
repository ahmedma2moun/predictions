import SwiftUI

struct StandingsRow: View {
    @Environment(\.palette) private var c
    let label: String
    let standing: Standing?

    var body: some View {
        if let s = standing {
            let form = Array((s.form ?? "").suffix(5))
            HStack(spacing: Tokens.Spacing.sm) {
                Text(label).appFont(Tokens.FontSize.xs).foregroundStyle(c.mutedForeground).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(ordinal(s.position)).appFont(Tokens.FontSize.xs).foregroundStyle(c.foreground).frame(minWidth: 56)
                Text("\(s.won ?? 0)W \(s.drawn ?? 0)D \(s.lost ?? 0)L")
                    .appFont(Tokens.FontSize.xs).foregroundStyle(c.foreground).frame(minWidth: 56)
                Text("\(s.points) pts").appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground)
                HStack(spacing: 2) {
                    ForEach(Array(form.enumerated()), id: \.offset) { _, result in
                        Text(String(result))
                            .appFont(9, .bold).foregroundStyle(.white)
                            .frame(width: 16, height: 16)
                            .background(dotColor(result), in: RoundedRectangle(cornerRadius: 3))
                    }
                }
            }
            .padding(.vertical, Tokens.Spacing.xs)
        }
    }

    private func dotColor(_ result: Character) -> Color {
        switch result {
        case "W": return c.success
        case "D": return c.warning
        default: return c.destructive
        }
    }
}
