package com.maamoun.footballpredictions.core.util

import com.maamoun.footballpredictions.core.networking.dto.MatchStatus
import com.maamoun.footballpredictions.core.networking.dto.PredictedWinner
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

// Mirrors mobile/src/utils/format.ts (which mirrors src/lib/utils.ts on the web).

private val dayNames = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
private val monthNames = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
private val fullDayNames = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
private val fullMonthNames = listOf(
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)

private val stageLabels = mapOf(
    "GROUP_STAGE" to "Group Stage",
    "ROUND_OF_64" to "Round of 64",
    "ROUND_OF_32" to "Round of 32",
    "ROUND_OF_16" to "Round of 16",
    "QUARTER_FINALS" to "Quarter Final",
    "SEMI_FINALS" to "Semi Final",
    "THIRD_PLACE" to "Third Place",
    "FINAL" to "Final",
    "PLAYOFF_ROUND_ONE" to "Playoff Round 1",
    "PLAYOFF_ROUND_TWO" to "Playoff Round 2",
    "PLAYOFFS" to "Playoffs",
)
private val nonKnockoutStages = setOf("GROUP_STAGE", "REGULAR_SEASON")

/** Dates arrive as UTC ISO strings, with or without fractional seconds. */
fun parseIsoInstant(value: String): Instant? = try { Instant.parse(value) } catch (_: Exception) { null }

private fun pad2(n: Int) = if (n < 10) "0$n" else n.toString()

/** 0 = Sunday, like JS `getDay()`. */
private fun ZonedDateTime.jsDay() = dayOfWeek.value % 7

private fun local(instant: Instant, zone: ZoneId = ZoneId.systemDefault()): ZonedDateTime = instant.atZone(zone)

/** "Sun 04 Oct, 14:30" in the device's local timezone. */
fun formatKickoff(date: Instant, zone: ZoneId = ZoneId.systemDefault()): String {
    val d = local(date, zone)
    return "${dayNames[d.jsDay()]} ${pad2(d.dayOfMonth)} ${monthNames[d.monthValue - 1]}, ${pad2(d.hour)}:${pad2(d.minute)}"
}

/** Local calendar-day key, e.g. "2026-08-24" — used to group matches by day. */
fun getMatchDayKey(date: Instant, zone: ZoneId = ZoneId.systemDefault()): String {
    val d = local(date, zone)
    return "${d.year}-${pad2(d.monthValue)}-${pad2(d.dayOfMonth)}"
}

/** "Today", "Tomorrow", "Yesterday" or "Weekday, d Month". */
fun formatMatchDayHeader(date: Instant, now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): String {
    val d = local(date, zone)
    val diff = ChronoUnit.DAYS.between(local(now, zone).toLocalDate(), d.toLocalDate())
    return when (diff) {
        0L -> "Today"
        1L -> "Tomorrow"
        -1L -> "Yesterday"
        else -> "${fullDayNames[d.jsDay()]}, ${d.dayOfMonth} ${fullMonthNames[d.monthValue - 1]}"
    }
}

fun isMatchLocked(kickoff: Instant, now: Instant = Instant.now()): Boolean = !now.isBefore(kickoff)

fun getWinner(home: Int, away: Int): PredictedWinner = when {
    home > away -> PredictedWinner.HOME
    away > home -> PredictedWinner.AWAY
    else -> PredictedWinner.DRAW
}

fun formatStage(stage: String): String =
    stageLabels[stage] ?: stage.replace('_', ' ').split(' ').joinToString(" ") { w ->
        w.replaceFirstChar { it.uppercase() }
    }

fun isKnockoutStage(stage: String?): Boolean = !stage.isNullOrEmpty() && stage !in nonKnockoutStages

fun ordinal(n: Int): String {
    val v = n % 100
    if (v in 11..13) return "${n}th"
    return when (n % 10) { 1 -> "${n}st"; 2 -> "${n}nd"; 3 -> "${n}rd"; else -> "${n}th" }
}

fun formatMatchStatus(status: MatchStatus): String = when (status) {
    MatchStatus.LIVE -> "LIVE"
    MatchStatus.FINISHED -> "FT"
    MatchStatus.POSTPONED -> "PST"
    MatchStatus.CANCELLED -> "CANC"
    MatchStatus.SCHEDULED -> "Upcoming"
}

/** Prints numbers the way JS does: `60` not `60.0`, `33.3` stays `33.3`. */
fun formatNumber(value: Double): String =
    if (value == Math.rint(value) && Math.abs(value) < 1e15) value.toLong().toString() else value.toString()

fun formatSignedPoints(points: Int): String = if (points > 0) "+$points" else "0"

// Cairo-time formats (Club / Slip)
private val cairo = ZoneId.of("Africa/Cairo")
private val slipFormatter = DateTimeFormatter.ofPattern("EEE d MMM, HH:mm", Locale.UK).withZone(cairo)
private val cairoDayFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.UK).withZone(cairo)
private val longDateFormatter = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.UK).withZone(ZoneId.systemDefault())

fun formatSlipKickoff(date: Instant): String = slipFormatter.format(date)
fun formatCairoDate(date: Instant): String = cairoDayFormatter.format(date)

/** "4 Oct 2026" (Seasons). */
fun formatLongDate(date: Instant): String = longDateFormatter.format(date)

/** Device-locale numeric date, e.g. "9/1/2026" (Champion lock banner). */
fun formatDeviceDate(date: Instant): String {
    val pattern = java.time.format.DateTimeFormatterBuilder.getLocalizedDateTimePattern(
        java.time.format.FormatStyle.SHORT, null, java.time.chrono.IsoChronology.INSTANCE, Locale.getDefault(),
    ).replace(Regex("(?<!y)yy(?!y)"), "yyyy")
    return DateTimeFormatter.ofPattern(pattern, Locale.getDefault()).withZone(ZoneId.systemDefault()).format(date)
}

/** Countdown label for the Matches list; null once kickoff has passed. */
fun countdownLabel(kickoff: Instant, now: Instant = Instant.now()): String? {
    val ms = kickoff.toEpochMilli() - now.toEpochMilli()
    if (ms <= 0) return null
    val totalMinutes = (ms / 60_000).toInt()
    val hours = totalMinutes / 60
    val minutes = totalMinutes % 60
    if (hours >= 24) {
        val days = hours / 24
        val remainHours = hours % 24
        return if (remainHours > 0) "${days}d ${remainHours}h to predict" else "${days}d to predict"
    }
    if (hours > 0) return "${hours}h ${minutes}m to predict"
    if (totalMinutes > 0) return "${totalMinutes}m to predict"
    return "< 1m to predict"
}
