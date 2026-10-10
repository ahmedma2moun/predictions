import Foundation

// Mirrors mobile/src/utils/format.ts (which mirrors src/lib/utils.ts on the web).

private let isoWithFraction: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

private let isoPlain: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()

/// Dates arrive as UTC ISO strings, with or without fractional seconds.
func parseISODate(_ value: String) -> Date? {
    isoWithFraction.date(from: value) ?? isoPlain.date(from: value)
}

private let dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
private let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
private let fullDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
private let fullMonthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

private let stageLabels: [String: String] = [
    "GROUP_STAGE": "Group Stage",
    "ROUND_OF_64": "Round of 64",
    "ROUND_OF_32": "Round of 32",
    "ROUND_OF_16": "Round of 16",
    "QUARTER_FINALS": "Quarter Final",
    "SEMI_FINALS": "Semi Final",
    "THIRD_PLACE": "Third Place",
    "FINAL": "Final",
    "PLAYOFF_ROUND_ONE": "Playoff Round 1",
    "PLAYOFF_ROUND_TWO": "Playoff Round 2",
    "PLAYOFFS": "Playoffs",
]

private let nonKnockoutStages: Set<String> = ["GROUP_STAGE", "REGULAR_SEASON"]

private func pad2(_ n: Int) -> String { n < 10 ? "0\(n)" : String(n) }

private func components(_ date: Date, calendar: Calendar = .current) -> DateComponents {
    calendar.dateComponents([.year, .month, .day, .hour, .minute, .weekday], from: date)
}

/// "Sun 04 Oct, 14:30" in the device's local timezone.
func formatKickoff(_ date: Date) -> String {
    let c = components(date)
    return "\(dayNames[(c.weekday ?? 1) - 1]) \(pad2(c.day ?? 1)) \(monthNames[(c.month ?? 1) - 1]), \(pad2(c.hour ?? 0)):\(pad2(c.minute ?? 0))"
}

/// Local calendar-day key, e.g. "2026-08-24" — used to group matches by day.
func getMatchDayKey(_ date: Date) -> String {
    let c = components(date)
    return "\(c.year ?? 0)-\(pad2(c.month ?? 1))-\(pad2(c.day ?? 1))"
}

/// "Today", "Tomorrow", "Yesterday" or "Weekday, d Month".
func formatMatchDayHeader(_ date: Date, now: Date = Date()) -> String {
    let cal = Calendar.current
    let diff = cal.dateComponents([.day], from: cal.startOfDay(for: now), to: cal.startOfDay(for: date)).day ?? 0
    switch diff {
    case 0: return "Today"
    case 1: return "Tomorrow"
    case -1: return "Yesterday"
    default:
        let c = components(date)
        return "\(fullDayNames[(c.weekday ?? 1) - 1]), \(c.day ?? 1) \(fullMonthNames[(c.month ?? 1) - 1])"
    }
}

func isMatchLocked(_ kickoff: Date, now: Date = Date()) -> Bool { now >= kickoff }

func getWinner(home: Int, away: Int) -> PredictedWinner {
    if home > away { return .home }
    if away > home { return .away }
    return .draw
}

func formatStage(_ stage: String) -> String {
    if let label = stageLabels[stage] { return label }
    return stage.replacingOccurrences(of: "_", with: " ")
        .split(separator: " ", omittingEmptySubsequences: false)
        .map { $0.prefix(1).uppercased() + $0.dropFirst() }
        .joined(separator: " ")
}

func isKnockoutStage(_ stage: String?) -> Bool {
    guard let stage, !stage.isEmpty else { return false }
    return !nonKnockoutStages.contains(stage)
}

func ordinal(_ n: Int) -> String {
    let v = n % 100
    if (11...13).contains(v) { return "\(n)th" }
    switch n % 10 {
    case 1: return "\(n)st"
    case 2: return "\(n)nd"
    case 3: return "\(n)rd"
    default: return "\(n)th"
    }
}

func formatMatchStatus(_ status: MatchStatus) -> String {
    switch status {
    case .live: return "LIVE"
    case .finished: return "FT"
    case .postponed: return "PST"
    case .cancelled: return "CANC"
    case .scheduled: return "Upcoming"
    }
}

/// Prints numbers the way JS does: `60` not `60.0`, `33.3` stays `33.3`.
func formatNumber(_ value: Double) -> String {
    if value.rounded() == value, abs(value) < 1e15 { return String(Int(value)) }
    return String(value)
}

/// "+3" / "0" points label used across cards.
func formatSignedPoints(_ points: Int) -> String { points > 0 ? "+\(points)" : "0" }

// MARK: - Cairo-time formats (Club / Slip)

private func cairoFormatter(_ pattern: String) -> DateFormatter {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_GB")
    f.timeZone = TimeZone(identifier: "Africa/Cairo")
    f.dateFormat = pattern
    return f
}

private let slipKickoffFormatter = cairoFormatter("EEE d MMM, HH:mm")
private let cairoDayFormatter = cairoFormatter("dd/MM/yyyy")

func formatSlipKickoff(_ date: Date) -> String { slipKickoffFormatter.string(from: date) }
func formatCairoDate(_ date: Date) -> String { cairoDayFormatter.string(from: date) }

private let longDateFormatter: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_GB")
    f.dateFormat = "d MMM yyyy"
    return f
}()

/// "4 Oct 2026" (Seasons).
func formatLongDate(_ date: Date) -> String { longDateFormatter.string(from: date) }

/// Device-locale numeric date, e.g. "9/1/2026" (Champion lock banner).
func formatDeviceDate(_ date: Date) -> String {
    date.formatted(.dateTime.day().month(.defaultDigits).year())
}

/// Countdown label for the Matches list; nil once kickoff has passed.
func countdownLabel(until kickoff: Date, now: Date = Date()) -> String? {
    let ms = kickoff.timeIntervalSince(now) * 1000
    if ms <= 0 { return nil }
    let totalMinutes = Int(ms / 60_000)
    let hours = totalMinutes / 60
    let minutes = totalMinutes % 60
    if hours >= 24 {
        let days = hours / 24
        let remainHours = hours % 24
        return remainHours > 0 ? "\(days)d \(remainHours)h to predict" : "\(days)d to predict"
    }
    if hours > 0 { return "\(hours)h \(minutes)m to predict" }
    if totalMinutes > 0 { return "\(totalMinutes)m to predict" }
    return "< 1m to predict"
}
