import SwiftUI

struct PredictionCard: View {
    @Environment(\.palette) private var c
    let app: AppContainer
    let pred: PredictionHistoryItem
    @State private var open = false
    @State private var others: [OtherPrediction]?
    @State private var loadingOthers = false

    private var match: PredictionHistoryMatch { pred.match }
    private var isFinished: Bool { match.status == .finished }
    private var isLocked: Bool { match.status != .scheduled }
    private var isExact: Bool {
        guard isFinished, let result = match.result else { return false }
        return pred.homeScore == result.homeScore && pred.awayScore == result.awayScore
    }

    var body: some View {
        Card(padding: 0, spacing: Tokens.Spacing.xs) {
            VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                mainRow
                if isLocked { toggle }
                expanded
            }
            .padding(.horizontal, Tokens.Spacing.lg)
            .padding(.vertical, Tokens.Spacing.md)
        }
    }

    private var mainRow: some View {
        HStack(alignment: .top, spacing: Tokens.Spacing.md) {
            VStack(alignment: .leading, spacing: 5) {
                Text(formatKickoff(match.kickoffDate)).appFont(Tokens.FontSize.xs).foregroundStyle(c.mutedForeground)
                (Text(match.homeTeam.name) + Text(" vs ").fontWeight(.regular).foregroundStyle(c.mutedForeground) + Text(match.awayTeam.name))
                    .appFont(13.5, .semibold).foregroundStyle(c.foreground).lineLimit(1)
                HStack(spacing: Tokens.Spacing.md) {
                    if isFinished, let result = match.result {
                        scoreCell("PICK", "\(pred.homeScore)–\(pred.awayScore)", dim: true)
                        scoreCell("FINAL", "\(result.homeScore)–\(result.awayScore)", dim: false)
                    } else {
                        scoreCell("YOUR PICK", "\(pred.homeScore)–\(pred.awayScore)", dim: true)
                    }
                }
                .padding(.top, 4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if isFinished { pointsChip }
        }
    }

    private var pointsChip: some View {
        let pts = pred.pointsAwarded
        let valueColor = isExact ? c.primary : (pts > 0 ? c.warning : c.mutedForeground)
        return VStack(spacing: 2) {
            Text(pts > 0 ? "+\(pts)" : "0").appFont(22, .bold, mono: true).foregroundStyle(valueColor)
            Text(isExact ? "EXACT" : "pts").appFont(9.5, .bold).tracking(0.5).foregroundStyle(valueColor)
            if let rules = pred.scoringBreakdown, !rules.isEmpty {
                ScoringBreakdown(rules: rules, bonus: pred.oddsBonus)
            }
        }
        .frame(width: 72)
        .padding(.vertical, 10)
        .padding(.horizontal, Tokens.Spacing.sm)
        .background(isExact ? c.primarySoft : c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.md).stroke(isExact ? c.primarySoftBorder : c.border, lineWidth: 1))
    }

    private func scoreCell(_ label: String, _ score: String, dim: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).appFont(10, .bold).tracking(0.6).foregroundStyle(c.mutedForeground)
            Text(score).appFont(12.5, dim ? .regular : .bold, mono: true)
                .foregroundStyle(dim ? c.mutedForeground : c.foreground)
        }
    }

    private var toggle: some View {
        Button {
            Task { await toggleOthers() }
        } label: {
            HStack(spacing: 4) {
                if loadingOthers {
                    ProgressView().controlSize(.small).tint(c.mutedForeground)
                } else {
                    Text("\(open ? "Hide" : "Show") all predictions")
                        .appFont(Tokens.FontSize.xs, .medium).foregroundStyle(c.mutedForeground)
                    Image(systemName: open ? AppIcon.chevronUp : AppIcon.chevronDown)
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(c.mutedForeground)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, Tokens.Spacing.sm)
            .overlay(alignment: .top) { Rectangle().fill(c.border).frame(height: hairline) }
        }
        .buttonStyle(PressableStyle(pressedOpacity: 0.6))
        .padding(.top, Tokens.Spacing.xs)
    }

    @ViewBuilder private var expanded: some View {
        if open, let others {
            if others.isEmpty {
                Muted("No other predictions.", size: Tokens.FontSize.xs).frame(maxWidth: .infinity)
            } else {
                VStack(spacing: 4) {
                    ForEach(others, id: \.userId) { o in
                        HStack(spacing: Tokens.Spacing.sm) {
                            Text(o.userName).appFont(Tokens.FontSize.xs, .medium).foregroundStyle(c.foreground).lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text("\(o.homeScore)–\(o.awayScore)").appFont(Tokens.FontSize.xs, mono: true).foregroundStyle(c.foreground)
                            if isFinished {
                                Text("+\(o.pointsAwarded)").appFont(Tokens.FontSize.xs, .semibold)
                                    .foregroundStyle(o.pointsAwarded > 0 ? c.warning : c.mutedForeground)
                                if let rules = o.scoringBreakdown, !rules.isEmpty {
                                    ScoringBreakdown(rules: rules, bonus: o.oddsBonus)
                                }
                            }
                        }
                        .padding(.vertical, 6).padding(.horizontal, Tokens.Spacing.sm)
                        .background(c.cardElevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm))
                    }
                }
                .padding(.top, Tokens.Spacing.xs)
            }
        }
    }

    private func toggleOthers() async {
        if !open, others == nil, let token = app.token {
            loadingOthers = true
            do {
                let detail: MatchDetail = try await app.api.request("/api/mobile/matches/\(match.id)", token: token)
                others = detail.allPredictions ?? []
            } catch {
                others = []
            }
            loadingOthers = false
        }
        open.toggle()
    }
}
