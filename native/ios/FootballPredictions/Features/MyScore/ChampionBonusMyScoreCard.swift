import SwiftUI

struct ChampionBonusMyScoreCard: View {
    @Environment(\.palette) private var c
    let state: ChampionBonusState?
    let onOpen: () -> Void

    var body: some View {
        switch state {
        case .none, .some(.disabled):
            EmptyView()
        case .some(.open(let open)):
            tile(fill: Tokens.Fixed.championTint, border: c.warning) {
                Text("👑 Champion Bonus").appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground)
                Muted(open.myPick != nil ? "You've picked your champion" : "Pick your champion before picks lock", size: Tokens.FontSize.xs)
            }
        case .some(.locked(let locked)):
            if let team = locked.myPick.flatMap({ locked.teams[$0.teamId] }) {
                let wins = team.awards.filter(\.isWin).count
                tile(fill: Tokens.Fixed.championTint, border: c.warning) {
                    HStack {
                        Text("👑 Champion Bonus (\(team.name))").appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground)
                        Spacer()
                        Text("+\(team.totalPoints) pts").appFont(Tokens.FontSize.sm, .bold, mono: true).foregroundStyle(c.foreground)
                    }
                    Muted("\(team.awards.count) game\(team.awards.count != 1 ? "s" : "") played · \(wins) win\(wins != 1 ? "s" : "") · next win = \(team.nextWinPoints) pts", size: Tokens.FontSize.xs)
                }
            } else {
                tile(fill: c.card, border: c.border) {
                    Muted("👑 Champion Bonus — you didn't pick a champion this round")
                }
            }
        }
    }

    private func tile<Content: View>(fill: Color, border: Color, @ViewBuilder content: () -> Content) -> some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 2) { content() }
                .padding(Tokens.Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(fill, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(border, lineWidth: 1))
        }
        .buttonStyle(PressableStyle())
    }
}
