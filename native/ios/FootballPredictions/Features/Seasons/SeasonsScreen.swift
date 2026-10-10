import SwiftUI

struct SeasonsScreen: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    @State private var vm: SeasonsViewModel

    init(app: AppContainer) {
        self.app = app
        _vm = State(initialValue: SeasonsViewModel(app: app))
    }

    var body: some View {
        VStack(spacing: 0) {
            AppHeader(app: app, title: "Seasons")
            if vm.isLoading && vm.data == nil {
                CenteredSpinner()
            } else {
                content
            }
        }
        .background(c.background)
        .task { await vm.load() }
    }

    private var content: some View {
        let active = vm.data?.activeSeason
        let ended = vm.data?.endedSeasons ?? []
        return ScrollView {
            VStack(alignment: .leading, spacing: Tokens.Spacing.xl) {
                if let active {
                    VStack(alignment: .leading, spacing: Tokens.Spacing.md) {
                        HStack(spacing: Tokens.Spacing.sm) {
                            Text(active.name).appFont(Tokens.FontSize.lg, .bold).foregroundStyle(c.foreground)
                            Text("In Progress").appFont(Tokens.FontSize.xxs, .semibold).foregroundStyle(c.success)
                                .padding(.horizontal, Tokens.Spacing.sm).padding(.vertical, 2)
                                .background(Tokens.Fixed.successBadgeFill, in: Capsule())
                                .overlay(Capsule().stroke(Tokens.Fixed.successBadgeBorder, lineWidth: 1))
                        }
                        StandingsList(entries: vm.data?.activeLeaderboard ?? [], myId: vm.myId)
                    }
                }
                if !ended.isEmpty {
                    VStack(alignment: .leading, spacing: Tokens.Spacing.md) {
                        Text("Past Seasons").appFont(Tokens.FontSize.lg, .bold).foregroundStyle(c.foreground)
                        ForEach(ended) { EndedSeasonCard(item: $0, myId: vm.myId) }
                    }
                }
                if active == nil && ended.isEmpty {
                    VStack(spacing: Tokens.Spacing.sm) {
                        Image(systemName: AppIcon.tabLeaders).font(.system(size: 36)).foregroundStyle(c.mutedForeground)
                        Text("No seasons yet").appFont(Tokens.FontSize.md, .semibold).foregroundStyle(c.foreground)
                        Muted("Check back when a season is started by the admin.").multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, Tokens.Spacing.xxl * 2)
                }
            }
            .padding(Tokens.Spacing.lg)
        }
        .refreshable { await vm.refresh() }
    }
}

private struct StandingsList: View {
    @Environment(\.palette) private var c
    let entries: [SeasonEntry]
    let myId: String?

    var body: some View {
        if entries.isEmpty {
            Muted("No predictions scored yet.").frame(maxWidth: .infinity).padding(.vertical, Tokens.Spacing.lg)
        } else {
            let showPodium = entries.count >= 3
            let compact = showPodium ? Array(entries.dropFirst(3)) : entries
            VStack(spacing: Tokens.Spacing.xs) {
                if showPodium { SeasonPodium(entries: entries, myId: myId) }
                ForEach(Array(compact.enumerated()), id: \.element.userId) { idx, entry in
                    SeasonRow(rank: showPodium ? idx + 4 : idx + 1, entry: entry, isMe: entry.userId == myId)
                }
            }
        }
    }
}

private struct SeasonPodium: View {
    @Environment(\.palette) private var c
    let entries: [SeasonEntry]
    let myId: String?

    var body: some View {
        let order = [entries[1], entries[0], entries[2]]
        let ranks = [2, 1, 3]
        HStack(alignment: .bottom, spacing: Tokens.Spacing.sm) {
            ForEach(0..<3, id: \.self) { i in
                let entry = order[i]
                let rank = ranks[i]
                let medal = MedalStyle.colors(rank: rank)
                VStack(spacing: 4) {
                    Avatar(name: entry.name, url: entry.avatarUrl, size: rank == 1 ? 48 : 40)
                    Text(entry.name.split(separator: " ").first.map(String.init) ?? entry.name)
                        .appFont(Tokens.FontSize.xs, .semibold).foregroundStyle(c.foreground).lineLimit(1)
                    Text("\(entry.totalPoints)").appFont(15, .bold, mono: true)
                        .foregroundStyle(entry.userId == myId ? c.primary : c.foreground)
                    Text("\(rank)").appFont(20, .heavy).foregroundStyle(medal.color)
                        .frame(maxWidth: .infinity).frame(height: medal.height)
                        .background(medal.fill, in: UnevenRoundedRectangle(topLeadingRadius: Tokens.Radius.md, topTrailingRadius: Tokens.Radius.md))
                        .overlay(UnevenRoundedRectangle(topLeadingRadius: Tokens.Radius.md, topTrailingRadius: Tokens.Radius.md)
                            .stroke(medal.border, lineWidth: 1))
                }
                .frame(maxWidth: .infinity)
                .layoutPriority(rank == 1 ? 1.2 : 1)
            }
        }
        .padding(.horizontal, Tokens.Spacing.sm)
        .padding(.bottom, Tokens.Spacing.md)
    }
}

private struct SeasonRow: View {
    @Environment(\.palette) private var c
    let rank: Int
    let entry: SeasonEntry
    let isMe: Bool

    var body: some View {
        HStack(spacing: Tokens.Spacing.sm) {
            Text("\(rank)").appFont(Tokens.FontSize.sm, .bold, mono: true)
                .foregroundStyle(isMe ? c.primary : c.mutedForeground).frame(width: 26)
            Avatar(name: entry.name, url: entry.avatarUrl, size: 28)
            Text(entry.name).appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground).lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            if isMe { Text("YOU").appFont(Tokens.FontSize.xxs, .bold).tracking(0.5).foregroundStyle(c.primary) }
            Text("\(entry.totalPoints)").appFont(14, .bold, mono: true).foregroundStyle(isMe ? c.primary : c.foreground)
        }
        .padding(.vertical, 11).padding(.horizontal, 14)
        .background(isMe ? c.primarySoft : c.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(isMe ? c.primarySoftBorder : c.border, lineWidth: hairline))
    }
}

private struct EndedSeasonCard: View {
    @Environment(\.palette) private var c
    let item: EndedSeason
    let myId: String?
    @State private var open = false

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.md) {
            Button { withAnimation(.snappy) { open.toggle() } } label: {
                HStack(alignment: .top, spacing: Tokens.Spacing.sm) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.season.name).appFont(Tokens.FontSize.md, .semibold).foregroundStyle(c.foreground)
                        if let description = item.season.description, !description.isEmpty {
                            Muted(description, size: Tokens.FontSize.xs)
                        }
                        Muted(dateRange, size: Tokens.FontSize.xxs)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: open ? AppIcon.chevronUp : AppIcon.chevronDown)
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(c.mutedForeground)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(open ? "Collapse standings" : "Expand standings")
            if open { StandingsList(entries: item.overallStandings, myId: myId) }
        }
        .padding(Tokens.Spacing.md)
        .background(c.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(c.border, lineWidth: hairline))
    }

    private var dateRange: String {
        let start = parseISODate(item.season.startDate).map(formatLongDate) ?? item.season.startDate
        guard let end = item.season.endedAt, let date = parseISODate(end) else { return start }
        return "\(start) → \(formatLongDate(date))"
    }
}
