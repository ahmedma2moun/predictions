import SwiftUI

struct MatchCard: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    let match: MatchListItem
    @State private var poller: LiveScorePoller

    init(app: AppContainer, match: MatchListItem) {
        self.app = app
        self.match = match
        _poller = State(initialValue: LiveScorePoller(app: app, match: match))
    }

    private var liveScore: LiveScore? { poller.displayed }
    private var locked: Bool { isMatchLocked(match.kickoffDate) }
    private var isFinished: Bool { match.status == .finished || liveScore?.status == .finished }
    private var isLive: Bool { match.status == .live && !isFinished }
    private var showLiveScore: Bool { match.status == .live }

    private var competitionLabel: String {
        let suffix = match.leagueName.map { " · \($0.uppercased())" } ?? ""
        if isKnockoutStage(match.stage), let stage = match.stage {
            return "\(formatStage(stage))\(match.leg.map { " · Leg \($0)" } ?? "")\(suffix)"
        }
        if let matchday = match.matchday { return "Matchday \(matchday)\(suffix)" }
        return match.leagueName ?? "–"
    }

    var body: some View {
        VStack(spacing: 0) {
            topStrip
            body_
            footer
        }
        .background(c.card)
        .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.lg).stroke(c.border, lineWidth: hairline))
        .task(id: "\(match.id)-\(match.status.rawValue)") { await poller.run() }
        .accessibilityElement(children: .combine)
    }

    private var topStrip: some View {
        HStack(spacing: Tokens.Spacing.sm) {
            Text(competitionLabel.uppercased())
                .appFont(10.5, .bold).tracking(0.8)
                .foregroundStyle(c.mutedForeground)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            if isLive {
                Pill("LIVE", tone: .live, icon: AnyView(LiveDot()))
            } else if locked && !isFinished {
                Pill("LOCKED", tone: .ghost)
            } else if isFinished {
                Pill("FT", tone: .ghost)
            } else if match.prediction != nil {
                Pill("PICKED", tone: .brand)
            }
        }
        .padding(.horizontal, Tokens.Spacing.lg)
        .padding(.vertical, 9)
        .background(isLive ? Tokens.Fixed.liveStripTint : .clear)
        .overlay(alignment: .bottom) { Rectangle().fill(c.border).frame(height: hairline) }
    }

    private var body_: some View {
        HStack(spacing: Tokens.Spacing.md) {
            TeamSide(team: match.homeTeam, standing: match.homeStanding, alignment: .leading)
            scoreChip
            TeamSide(team: match.awayTeam, standing: match.awayStanding, alignment: .trailing)
        }
        .padding(.horizontal, Tokens.Spacing.lg)
        .padding(.top, 14)
        .padding(.bottom, 16)
    }

    private var scoreChip: some View {
        Group {
            if showLiveScore {
                VStack(spacing: 2) {
                    Text(isFinished ? "FULL TIME" : "LIVE SCORE")
                        .appFont(9, .bold).tracking(0.5).foregroundStyle(c.live)
                    Text(scoreText)
                        .appFont(20, .bold, mono: true).foregroundStyle(c.live)
                        .contentTransition(.numericText())
                        .animation(.default, value: scoreText)
                }
            } else if let prediction = match.prediction {
                Text("\(prediction.homeScore)–\(prediction.awayScore)")
                    .appFont(19, .bold, mono: true).foregroundStyle(c.primary)
            } else {
                Text("VS").appFont(Tokens.FontSize.xs, .semibold).tracking(1).foregroundStyle(c.mutedForeground)
            }
        }
        .frame(minWidth: 70)
        .padding(.horizontal, 14)
        .padding(.vertical, 4)
        .background(chipFill, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
        .overlay {
            if showLiveScore || match.prediction != nil {
                RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(chipBorder, lineWidth: 1)
            }
        }
        .accessibilityLabel(showLiveScore ? "Live score \(scoreText)" : "")
    }

    private var scoreText: String {
        if let home = liveScore?.homeScore, let away = liveScore?.awayScore { return "\(home)–\(away)" }
        return "–"
    }

    private var chipFill: Color {
        if showLiveScore { return c.cardElevated }
        if match.prediction != nil { return c.primarySoft }
        return .clear
    }

    private var chipBorder: Color { showLiveScore ? c.live : c.primarySoftBorder }

    private var footer: some View {
        HStack {
            Text(formatKickoff(match.kickoffDate)).appFont(11.5).foregroundStyle(c.mutedForeground)
            Spacer()
            footerRight
        }
        .padding(.top, 12)
        .padding(.horizontal, Tokens.Spacing.lg)
        .padding(.bottom, 14)
        .overlay(alignment: .top) {
            Rectangle().stroke(c.border, style: StrokeStyle(lineWidth: 1, dash: [4, 3])).frame(height: 1)
        }
    }

    @ViewBuilder private var footerRight: some View {
        if match.status == .live {
            if let prediction = match.prediction {
                (Text("Your pick: ") + Text("\(prediction.homeScore)–\(prediction.awayScore)").foregroundStyle(c.foreground))
                    .appFont(Tokens.FontSize.xs).foregroundStyle(c.mutedForeground)
            }
        } else if locked && match.status != .finished {
            Text(match.prediction != nil ? "Prediction submitted" : "No prediction submitted")
                .appFont(Tokens.FontSize.xs).italic().foregroundStyle(c.mutedForeground)
        } else {
            CountdownText(kickoff: match.kickoffDate)
        }
    }
}

private struct TeamSide: View {
    @Environment(\.palette) private var c
    let team: Team
    let standing: Standing?
    let alignment: HorizontalAlignment

    var body: some View {
        VStack(alignment: alignment, spacing: 6) {
            RemoteImage(url: team.logo, size: 36)
            Text(team.name)
                .appFont(Tokens.FontSize.sm, .semibold)
                .foregroundStyle(c.foreground)
                .lineLimit(2)
                .multilineTextAlignment(alignment == .leading ? .leading : .trailing)
            if let standing {
                Text("#\(standing.position) · \(standing.points)")
                    .appFont(10.5, mono: true).foregroundStyle(c.mutedForeground)
            }
        }
        .frame(maxWidth: .infinity, alignment: alignment == .leading ? .leading : .trailing)
    }
}

/// "2h 5m to predict" — refreshed every 30 s and cleared at kickoff.
private struct CountdownText: View {
    @Environment(\.palette) private var c
    let kickoff: Date
    @State private var label: String?

    var body: some View {
        Group {
            if let label {
                HStack(spacing: 4) {
                    Image(systemName: AppIcon.clock).font(.system(size: 10)).foregroundStyle(c.warning)
                    Text(label).appFont(Tokens.FontSize.xs, .semibold, mono: true).foregroundStyle(c.warning)
                }
            }
        }
        .task(id: kickoff) {
            label = countdownLabel(until: kickoff)
            while !Task.isCancelled, label != nil {
                try? await Task.sleep(for: .seconds(30))
                label = countdownLabel(until: kickoff)
            }
        }
    }
}
