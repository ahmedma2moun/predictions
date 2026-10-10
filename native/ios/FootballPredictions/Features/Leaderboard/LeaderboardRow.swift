import SwiftUI

private let medals = ["🥇", "🥈", "🥉"]

struct LeaderboardRow: View {
    @Environment(\.palette) private var c
    let item: LeaderboardEntry
    let index: Int
    let myId: String?
    let isCurrentPeriod: Bool
    let isExpanded: Bool
    let expandedLoading: Bool
    let expandedData: [LeaderboardUserPrediction]?
    let showMedal: Bool
    let championTeamName: String?
    let onToggle: () -> Void

    private var isMe: Bool { myId == item.userId }

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onToggle) { header }
                .buttonStyle(PressableStyle())
                .accessibilityHint(isExpanded ? "Collapse predictions" : "Expand predictions")
            if isExpanded { expandedBox }
        }
        .background(isMe ? c.primarySoft : c.card, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(isMe ? c.primarySoftBorder : c.border, lineWidth: hairline))
        .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.md))
    }

    private var header: some View {
        HStack(spacing: Tokens.Spacing.sm) {
            Group {
                if showMedal, index < 3 {
                    Text(medals[index]).font(.system(size: 16))
                } else {
                    Text("\(index + 1)").appFont(Tokens.FontSize.sm, .bold, mono: true)
                        .foregroundStyle(isMe ? c.primary : c.mutedForeground)
                }
            }
            .frame(width: 26)

            Avatar(name: item.name, url: item.avatarUrl, size: 32)

            HStack(spacing: 4) {
                Text(item.name).appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground).lineLimit(1)
                if isMe { Text("· YOU").appFont(Tokens.FontSize.xxs, .bold).tracking(0.5).foregroundStyle(c.primary).fixedSize() }
                BadgeStrip(badges: item.badges, isGroupChampion: item.isGroupChampion, exactScoreCount: item.exactScoreCount,
                           longestStreak: item.longestStreak, isCurrentPeriod: isCurrentPeriod)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 4) {
                Text("\(item.totalPoints)").appFont(14, .bold, mono: true).foregroundStyle(isMe ? c.primary : c.foreground)
                if item.championBonusPoints > 0 {
                    Text("👑+\(item.championBonusPoints)")
                        .appFont(10, .bold, mono: true).foregroundStyle(c.warning)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Tokens.Fixed.championChip, in: Capsule())
                }
            }
            Image(systemName: isExpanded ? AppIcon.chevronUp : AppIcon.chevronDown)
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(c.mutedForeground)
        }
        .padding(.vertical, 11)
        .padding(.horizontal, 14)
        .contentShape(Rectangle())
    }

    private var expandedBox: some View {
        VStack(spacing: Tokens.Spacing.xs) {
            if item.championBonusPoints > 0 {
                HStack {
                    Text("👑 Champion Bonus\(championTeamName.map { " (\($0))" } ?? "")")
                        .appFont(Tokens.FontSize.xs, .semibold).foregroundStyle(c.foreground)
                    Spacer()
                    Text("+\(item.championBonusPoints)").appFont(Tokens.FontSize.xs, .bold, mono: true).foregroundStyle(c.warning)
                }
                .padding(.horizontal, Tokens.Spacing.sm).padding(.vertical, Tokens.Spacing.xs + 2)
                .background(Tokens.Fixed.championTint, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
            }
            if expandedLoading {
                ProgressView().tint(c.primary)
            } else if let data = expandedData, !data.isEmpty {
                ForEach(data) { UserPredRow(p: $0) }
            } else {
                Muted("No scored predictions in this period.", size: Tokens.FontSize.xs).frame(maxWidth: .infinity)
            }
        }
        .padding(Tokens.Spacing.md)
        .overlay(alignment: .top) { Rectangle().fill(c.border).frame(height: hairline) }
    }
}

private struct UserPredRow: View {
    @Environment(\.palette) private var c
    let p: LeaderboardUserPrediction

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: Tokens.Spacing.sm) {
                (Text(p.homeTeamName) + Text(" vs ").fontWeight(.regular).foregroundStyle(c.mutedForeground) + Text(p.awayTeamName))
                    .appFont(Tokens.FontSize.xs, .semibold).foregroundStyle(c.foreground).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 2) {
                    Text("+\(p.pointsAwarded) pts").appFont(Tokens.FontSize.xs, .semibold)
                        .foregroundStyle(p.pointsAwarded > 0 ? c.warning : c.mutedForeground)
                    if let rules = p.scoringBreakdown, !rules.isEmpty { ScoringBreakdown(rules: rules, bonus: p.oddsBonus) }
                }
            }
            HStack(spacing: Tokens.Spacing.sm) {
                Muted(formatKickoff(p.kickoffDate), size: Tokens.FontSize.xs)
                (Text("Pick: ") + Text("\(p.homeScore)–\(p.awayScore)").font(.custom("JetBrainsMono-Regular", fixedSize: 11)).foregroundStyle(c.foreground))
                    .appFont(Tokens.FontSize.xs).foregroundStyle(c.mutedForeground)
                (Text("Result: ") + Text("\(p.result.homeScore)–\(p.result.awayScore)").font(.custom("JetBrainsMono-Regular", fixedSize: 11)).foregroundStyle(c.foreground))
                    .appFont(Tokens.FontSize.xs).foregroundStyle(c.mutedForeground)
            }
        }
        .padding(.horizontal, Tokens.Spacing.sm).padding(.vertical, Tokens.Spacing.xs + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
    }
}

// MARK: - Badges

private struct BadgeStrip: View {
    @Environment(\.palette) private var c
    let badges: [String]
    let isGroupChampion: Bool
    let exactScoreCount: Int
    let longestStreak: Int
    let isCurrentPeriod: Bool
    @State private var open = false

    private var hasExact: Bool { badges.contains("first_exact_score") }
    private var hasRoll: Bool { badges.contains("on_a_roll") }
    private var showPopover: Bool { isCurrentPeriod && (hasExact || hasRoll) }

    var body: some View {
        if isGroupChampion || showPopover {
            HStack(spacing: 2) {
                if isGroupChampion {
                    Image(systemName: AppIcon.trophyFilled).font(.system(size: 11)).foregroundStyle(c.gold)
                        .accessibilityLabel("Group champion")
                }
                if showPopover {
                    Button { open = true } label: {
                        Image(systemName: AppIcon.medal).font(.system(size: 12)).foregroundStyle(c.mutedForeground)
                            .frame(width: 18, height: 18).contentShape(Rectangle().inset(by: -8))
                    }
                    .buttonStyle(PressableStyle(pressedOpacity: 0.6))
                    .accessibilityLabel("View badges")
                    .popover(isPresented: $open) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Badges").appFont(Tokens.FontSize.sm, .semibold).foregroundStyle(c.foreground).padding(.bottom, 2)
                            if hasExact {
                                HStack(spacing: Tokens.Spacing.lg) {
                                    Text("🎯 Exact Score").appFont(Tokens.FontSize.xs).foregroundStyle(c.foreground)
                                    Spacer()
                                    Text("×\(exactScoreCount)").appFont(Tokens.FontSize.xs, mono: true).foregroundStyle(c.mutedForeground)
                                }
                            }
                            if hasRoll {
                                HStack(spacing: Tokens.Spacing.lg) {
                                    Text("🔥 On a Roll").appFont(Tokens.FontSize.xs).foregroundStyle(c.foreground)
                                    Spacer()
                                    Text("longest: \(longestStreak)").appFont(Tokens.FontSize.xs).foregroundStyle(c.mutedForeground)
                                }
                            }
                        }
                        .padding(.vertical, Tokens.Spacing.md).padding(.horizontal, Tokens.Spacing.lg)
                        .frame(minWidth: 200, maxWidth: 300)
                        .background(c.card)
                        .environment(\.palette, c)
                        .presentationCompactAdaptation(.popover)
                    }
                }
            }
            .fixedSize()
        }
    }
}

// MARK: - Podium

struct Podium: View {
    @Environment(\.palette) private var c
    let entries: [LeaderboardEntry]
    var highlightMe: String?
    var scoreFont: CGFloat = 16

    var body: some View {
        if entries.count >= 3 {
            let order = [entries[1], entries[0], entries[2]]
            let ranks = [2, 1, 3]
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(0..<3, id: \.self) { i in
                    let entry = order[i]
                    let rank = ranks[i]
                    let medal = MedalStyle.colors(rank: rank)
                    VStack(spacing: 4) {
                        Avatar(name: entry.name, url: entry.avatarUrl, size: rank == 1 ? 48 : 40)
                        Text(entry.name.split(separator: " ").first.map(String.init) ?? entry.name)
                            .appFont(11.5, .semibold).foregroundStyle(c.foreground).lineLimit(1)
                        Text("\(entry.totalPoints)").appFont(scoreFont, .bold, mono: true)
                            .foregroundStyle(highlightMe == entry.userId ? c.primary : c.foreground)
                        Text("\(rank)").appFont(20, .heavy)
                            .foregroundStyle(medal.color)
                            .frame(maxWidth: .infinity)
                            .frame(height: medal.height)
                            .background(medal.fill, in: UnevenRoundedRectangle(topLeadingRadius: Tokens.Radius.md, topTrailingRadius: Tokens.Radius.md))
                            .overlay(UnevenRoundedRectangle(topLeadingRadius: Tokens.Radius.md, topTrailingRadius: Tokens.Radius.md)
                                .stroke(medal.border, lineWidth: 1))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, Tokens.Spacing.sm)
            .padding(.bottom, Tokens.Spacing.md)
        }
    }
}
