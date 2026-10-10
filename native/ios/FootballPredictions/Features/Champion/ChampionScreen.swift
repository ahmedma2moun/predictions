import SwiftUI

struct ChampionScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    @State private var vm: ChampionBonusViewModel
    @State private var expandedUserId: String?
    @State private var confirmTeam: ChampionBonusAllowedTeam?

    init(app: AppContainer) {
        self.app = app
        _vm = State(initialValue: ChampionBonusViewModel(app: app))
    }

    var body: some View {
        Group {
            if vm.isLoading && vm.state == nil && vm.error == nil {
                CenteredSpinner()
            } else if let error = vm.error {
                emptyState(emoji: "⚠️", title: "Failed to load") { Muted(error).multilineTextAlignment(.center) }
            } else {
                switch vm.state {
                case .none, .some(.disabled):
                    emptyState(emoji: "👑", title: "Champion Bonus isn't running right now") {
                        VStack(spacing: 0) {
                            Text("Each season the admin picks one league and a subset of its teams. Pick one as your champion — once locked, every game they play doubles the bonus:\n")
                                .foregroundStyle(c.mutedForeground)
                            Text("Win 1 = 2 pts · Win 2 = 4 · Win 3 = 8 …").fontWeight(.semibold).foregroundStyle(c.foreground)
                            Text("\nDraws and losses still double the next stake — it's a gamble!").foregroundStyle(c.mutedForeground)
                        }
                        .appFont(Tokens.FontSize.sm).lineSpacing(4).multilineTextAlignment(.center)
                    }
                case .some(.open(let open)): openView(open)
                case .some(.locked(let locked)): lockedView(locked)
                }
            }
        }
        .background(c.background)
        .navigationTitle("Champion")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(c.background, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .task { await vm.load() }
    }

    private func emptyState<Content: View>(emoji: String, title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: Tokens.Spacing.sm) {
            Text(emoji).font(.system(size: 40))
            Text(title).appFont(Tokens.FontSize.lg, .bold).foregroundStyle(c.foreground).multilineTextAlignment(.center)
            content()
        }
        .padding(.horizontal, Tokens.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Open

    private func openView(_ open: ChampionBonusOpen) -> some View {
        let myTeam = open.myPick.flatMap { pick in open.allowedTeams.first { $0.teamId == pick.teamId } }
        return ScrollView {
            VStack(spacing: Tokens.Spacing.sm) {
                Text(open.league.name).appFont(Tokens.FontSize.sm).foregroundStyle(c.mutedForeground)
                    .frame(maxWidth: .infinity, alignment: .leading)
                banner(fill: Tokens.Fixed.championTint, border: c.warning) {
                    Text("👑 Picks are open — the admin can lock at any time")
                        .appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground)
                    Muted("\(open.pickCount) player\(open.pickCount != 1 ? "s have" : " has") picked.\(myTeam.map { " You picked \($0.name)." } ?? "")",
                          size: Tokens.FontSize.xs)
                    if let error = vm.pickError {
                        Text(error).appFont(Tokens.FontSize.xs).foregroundStyle(c.destructive).padding(.top, 4)
                    }
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Tokens.Spacing.sm), count: 3), spacing: Tokens.Spacing.sm) {
                    ForEach(open.allowedTeams) { team in
                        ChampionTeamCard(team: team, isPicked: open.myPick?.teamId == team.teamId, isPicking: vm.picking == team.teamId) {
                            if let current = open.myPick, current.teamId != team.teamId {
                                confirmTeam = team
                            } else if open.myPick == nil {
                                Task { await vm.pick(teamId: team.teamId) }
                            }
                        }
                    }
                }
            }
            .padding(Tokens.Spacing.lg)
        }
        .refreshable { await vm.refresh() }
        .sensoryFeedback(.success, trigger: open.myPick?.teamId)
        .alert("Switch champion?", isPresented: Binding(get: { confirmTeam != nil }, set: { if !$0 { confirmTeam = nil } })) {
            Button("Cancel", role: .cancel) { confirmTeam = nil }
            Button("Switch") {
                if let team = confirmTeam { Task { await vm.pick(teamId: team.teamId) } }
                confirmTeam = nil
            }
        } message: {
            Text("Switch from \(myTeam?.name ?? "") to \(confirmTeam?.name ?? "")? You can change again anytime before picks lock.")
        }
    }

    // MARK: Locked

    private func lockedView(_ locked: ChampionBonusLocked) -> some View {
        let myTeam = locked.myPick.flatMap { locked.teams[$0.teamId] }
        return ScrollView {
            LazyVStack(spacing: Tokens.Spacing.xs) {
                VStack(spacing: Tokens.Spacing.md) {
                    Text(locked.league.name).appFont(Tokens.FontSize.sm).foregroundStyle(c.mutedForeground)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    banner(fill: c.cardElevated, border: c.border) {
                        Text("🔒 Locked \(formatDeviceDate(locked.lockedDate))")
                            .appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground)
                        Muted("A postponed match finishing late can renumber later games — the ledger rebuilds in kickoff order.", size: Tokens.FontSize.xs)
                    }
                    if let myTeam {
                        banner(fill: Tokens.Fixed.championTint, border: c.warning) {
                            HStack {
                                Text("Your champion: \(myTeam.name)").appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground)
                                Spacer()
                                Text("+\(myTeam.totalPoints)").appFont(18, .bold, mono: true).foregroundStyle(c.foreground)
                            }
                            Muted("\(myTeam.awards.count) game\(myTeam.awards.count != 1 ? "s" : "") played · next win = \(myTeam.nextWinPoints) pts",
                                  size: Tokens.FontSize.xs)
                        }
                    } else {
                        Muted("You didn't pick a champion this round — but you can still browse everyone else's below.")
                            .multilineTextAlignment(.center).frame(maxWidth: .infinity)
                    }
                }
                .padding(.bottom, Tokens.Spacing.sm)
                if locked.picks.isEmpty {
                    Muted("No one picked a champion this round.").frame(maxWidth: .infinity).padding(.top, Tokens.Spacing.xl)
                }
                ForEach(locked.picks) { pick in
                    ChampionRevealRow(
                        pickEntry: pick, team: locked.teams[pick.teamId], isMe: pick.userId == app.auth.user?.id,
                        isExpanded: expandedUserId == pick.userId
                    ) {
                        withAnimation(.snappy) { expandedUserId = expandedUserId == pick.userId ? nil : pick.userId }
                    }
                }
            }
            .padding(Tokens.Spacing.lg)
        }
        .refreshable { await vm.refresh() }
    }

    private func banner<Content: View>(fill: Color, border: Color, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 2) { content() }
            .padding(Tokens.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(fill, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(border, lineWidth: 1))
    }
}

private struct ChampionTeamCard: View {
    @Environment(\.palette) private var c
    let team: ChampionBonusAllowedTeam
    let isPicked: Bool
    let isPicking: Bool
    let onPress: () -> Void

    var body: some View {
        Button(action: onPress) {
            VStack(spacing: Tokens.Spacing.xs) {
                ZStack(alignment: .topTrailing) {
                    if let logo = team.logo {
                        RemoteImage(url: logo, size: 48)
                    } else {
                        Text(String(team.name.prefix(2)).uppercased()).appFont(Tokens.FontSize.sm, .bold).foregroundStyle(c.foreground)
                            .frame(width: 48, height: 48).background(c.cardElevated, in: Circle())
                    }
                    if isPicked {
                        Image(systemName: AppIcon.checkmark).font(.system(size: 9, weight: .bold)).foregroundStyle(c.background)
                            .frame(width: 18, height: 18).background(c.warning, in: Circle()).offset(x: 4, y: -4)
                    }
                }
                Text(team.name).appFont(Tokens.FontSize.xs, .semibold).foregroundStyle(c.foreground).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Tokens.Spacing.md).padding(.horizontal, Tokens.Spacing.sm)
            .background(isPicked ? Tokens.Fixed.championTint : c.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(isPicked ? c.warning : c.border, lineWidth: 2))
        }
        .buttonStyle(PressableStyle())
        .disabled(isPicking)
        .opacity(isPicking ? 0.6 : 1)
        .accessibilityLabel(team.name)
        .accessibilityAddTraits(isPicked ? .isSelected : [])
    }
}

private struct ChampionRevealRow: View {
    @Environment(\.palette) private var c
    let pickEntry: ChampionBonusRevealPick
    let team: ChampionBonusRevealTeam?
    let isMe: Bool
    let isExpanded: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggle) {
                HStack(spacing: Tokens.Spacing.sm) {
                    if let logo = pickEntry.teamLogo {
                        RemoteImage(url: logo, size: 28)
                    } else {
                        Text(String(pickEntry.teamName.prefix(2)).uppercased()).appFont(Tokens.FontSize.xxs, .bold)
                            .foregroundStyle(c.foreground).frame(width: 28, height: 28).background(c.cardElevated, in: Circle())
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: 4) {
                            Text(pickEntry.name ?? "User \(pickEntry.userId)").appFont(Tokens.FontSize.sm, .semibold)
                                .foregroundStyle(c.foreground).lineLimit(1)
                            if isMe { Text("· YOU").appFont(Tokens.FontSize.xxs, .bold).tracking(0.5).foregroundStyle(c.primary) }
                        }
                        Muted(pickEntry.teamName, size: Tokens.FontSize.xs).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Text("+\(pickEntry.totalBonus)").appFont(14, .bold, mono: true).foregroundStyle(c.foreground)
                    Image(systemName: isExpanded ? AppIcon.chevronUp : AppIcon.chevronDown)
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(c.mutedForeground)
                }
                .padding(.vertical, 11).padding(.horizontal, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())

            if isExpanded {
                VStack(spacing: Tokens.Spacing.xs) {
                    if let team, !team.awards.isEmpty {
                        ForEach(team.awards) { a in
                            HStack(spacing: Tokens.Spacing.sm) {
                                Text("Game \(a.gameNumber)").appFont(Tokens.FontSize.xs, .semibold).foregroundStyle(c.foreground)
                                    .frame(width: 56, alignment: .leading)
                                Text("\(a.homeAway == "home" ? "vs" : "@") \(a.opponentName)\(a.teamScore.map { " · \($0)–\(a.opponentScore ?? 0)" } ?? "")")
                                    .appFont(Tokens.FontSize.xs).foregroundStyle(c.mutedForeground).lineLimit(1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Muted(formatKickoff(a.kickoffDate), size: Tokens.FontSize.xxs)
                                Text("+\(a.points)").appFont(Tokens.FontSize.xs, .bold, mono: true)
                                    .foregroundStyle(a.isWin ? c.success : c.mutedForeground)
                                    .strikethrough(!a.isWin)
                            }
                            .padding(.horizontal, Tokens.Spacing.sm).padding(.vertical, Tokens.Spacing.xs + 2)
                            .background(a.isWin ? Tokens.Fixed.successTint : c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
                        }
                        Muted("Next win = \(team.nextWinPoints) pts", size: Tokens.FontSize.xxs)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    } else {
                        Muted("No games played yet since lock.", size: Tokens.FontSize.xs).frame(maxWidth: .infinity)
                    }
                }
                .padding(Tokens.Spacing.md)
                .overlay(alignment: .top) { Rectangle().fill(c.border).frame(height: hairline) }
            }
        }
        .background(isMe ? c.primarySoft : c.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(isMe ? c.primarySoftBorder : c.border, lineWidth: hairline))
        .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.md))
    }
}
