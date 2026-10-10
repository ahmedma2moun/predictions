package com.maamoun.footballpredictions.core.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// Mirrors mobile/src/utils/leaderboard-dates.ts. Weeks run Friday -> Thursday in the device's timezone.

data class DateBounds(val from: Instant, val to: Instant)

fun getWeekBounds(offset: Int, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): DateBounds {
    val today = now.atZone(zone).toLocalDate()
    val weekday = today.dayOfWeek.value % 7 // 0 = Sunday, like JS getDay()
    val daysSinceFriday = (weekday - 5 + 7) % 7
    val friday = today.minusDays(daysSinceFriday.toLong()).plusDays(offset * 7L)
    return DateBounds(friday.atStartOfDay(zone).toInstant(), friday.plusDays(7).atStartOfDay(zone).toInstant())
}

fun getMonthBounds(offset: Int, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): DateBounds {
    val first = now.atZone(zone).toLocalDate().withDayOfMonth(1).plusMonths(offset.toLong())
    return DateBounds(first.atStartOfDay(zone).toInstant(), first.plusMonths(1).atStartOfDay(zone).toInstant())
}

private fun shortDay(instant: Instant, zone: ZoneId) =
    DateTimeFormatter.ofPattern("d MMM", Locale.UK).format(instant.atZone(zone))

fun computeWeekLabel(offset: Int, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): String {
    val b = getWeekBounds(offset, now, zone)
    val thursdayEnd = b.to.atZone(zone).minusDays(1).toInstant()
    return "${shortDay(b.from, zone)} – ${shortDay(thursdayEnd, zone)}"
}

fun computeMonthLabel(offset: Int, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): String =
    DateTimeFormatter.ofPattern("MMMM yyyy", Locale.UK).format(getMonthBounds(offset, now, zone).from.atZone(zone))

/** ISO string sent to the API (`Date.toISOString()` in JS: UTC with milliseconds). */
fun isoString(instant: Instant): String =
    DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(java.time.ZoneOffset.UTC).format(instant)
