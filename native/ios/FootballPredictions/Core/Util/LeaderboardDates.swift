import Foundation

// Mirrors mobile/src/utils/leaderboard-dates.ts. Weeks run Friday -> Thursday in the device's timezone.

struct DateBounds: Equatable {
    let from: Date
    let to: Date
}

func getWeekBounds(offset: Int, now: Date = Date()) -> DateBounds {
    let cal = Calendar.current
    let weekday = cal.component(.weekday, from: now) - 1 // 0 = Sunday, like JS getDay()
    let daysSinceFriday = (weekday - 5 + 7) % 7
    let startOfToday = cal.startOfDay(for: now)
    let friday = cal.date(byAdding: .day, value: -daysSinceFriday + offset * 7, to: startOfToday)!
    let next = cal.date(byAdding: .day, value: 7, to: friday)!
    return DateBounds(from: friday, to: next)
}

func getMonthBounds(offset: Int, now: Date = Date()) -> DateBounds {
    let cal = Calendar.current
    let parts = cal.dateComponents([.year, .month], from: now)
    let first = cal.date(from: parts)!
    let from = cal.date(byAdding: .month, value: offset, to: first)!
    let to = cal.date(byAdding: .month, value: 1, to: from)!
    return DateBounds(from: from, to: to)
}

private func shortDay(_ d: Date) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_GB")
    f.dateFormat = "d MMM"
    return f.string(from: d)
}

func computeWeekLabel(offset: Int, now: Date = Date()) -> String {
    let b = getWeekBounds(offset: offset, now: now)
    let thursdayEnd = Calendar.current.date(byAdding: .day, value: -1, to: b.to)!
    return "\(shortDay(b.from)) – \(shortDay(thursdayEnd))"
}

func computeMonthLabel(offset: Int, now: Date = Date()) -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_GB")
    f.dateFormat = "MMMM yyyy"
    return f.string(from: getMonthBounds(offset: offset, now: now).from)
}

/// ISO string sent to the API (`Date.toISOString()` in JS: UTC with milliseconds).
func isoString(_ date: Date) -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.string(from: date)
}
