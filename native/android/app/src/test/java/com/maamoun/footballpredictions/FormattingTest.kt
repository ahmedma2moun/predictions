package com.maamoun.footballpredictions

import com.maamoun.footballpredictions.core.networking.dto.PredictedWinner
import com.maamoun.footballpredictions.core.util.*
import org.junit.Assert.*
import org.junit.Test
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId

class FormattingTest {
    @Test fun ordinals() {
        mapOf(1 to "1st", 2 to "2nd", 3 to "3rd", 4 to "4th", 11 to "11th", 12 to "12th", 13 to "13th", 21 to "21st", 102 to "102nd", 111 to "111th")
            .forEach { (n, s) -> assertEquals(s, ordinal(n)) }
    }

    @Test fun stageLabels() {
        assertEquals("Quarter Final", formatStage("QUARTER_FINALS"))
        assertEquals("LAST 16", formatStage("LAST_16"))
        assertTrue(isKnockoutStage("QUARTER_FINALS"))
        assertFalse(isKnockoutStage("REGULAR_SEASON"))
        assertFalse(isKnockoutStage("GROUP_STAGE"))
        assertFalse(isKnockoutStage(null))
    }

    @Test fun winner() {
        assertEquals(PredictedWinner.HOME, getWinner(2, 1))
        assertEquals(PredictedWinner.AWAY, getWinner(0, 1))
        assertEquals(PredictedWinner.DRAW, getWinner(1, 1))
    }

    @Test fun formatNumbers() {
        assertEquals("60", formatNumber(60.0))
        assertEquals("33.3", formatNumber(33.3))
        assertEquals("0", formatNumber(0.0))
    }

    @Test fun isoParsing() {
        assertNotNull(parseIsoInstant("2026-10-17T14:00:00.000Z"))
        assertNotNull(parseIsoInstant("2026-10-17T14:00:00Z"))
        assertNull(parseIsoInstant("not a date"))
    }

    @Test fun countdown() {
        val now = Instant.now()
        assertNull(countdownLabel(now.minusSeconds(5), now))
        assertEquals("< 1m to predict", countdownLabel(now.plusSeconds(30), now))
        assertEquals("1h 1m to predict", countdownLabel(now.plusSeconds(61 * 60 + 30), now))
        assertEquals("1d 1h to predict", countdownLabel(now.plusSeconds(25 * 3600), now))
        assertEquals("2d to predict", countdownLabel(now.plusSeconds(48 * 3600 + 30), now))
        assertEquals("12m to predict", countdownLabel(now.plusSeconds(12 * 60 + 5), now))
    }

    @Test fun matchDayHeader() {
        val now = Instant.now()
        assertEquals("Today", formatMatchDayHeader(now, now))
        assertEquals("Tomorrow", formatMatchDayHeader(now.plusSeconds(86_400), now))
        assertEquals("Yesterday", formatMatchDayHeader(now.minusSeconds(86_400), now))
    }

    @Test fun kickoffFormat() {
        val zone = ZoneId.of("UTC")
        assertEquals("Sat 17 Oct, 14:00", formatKickoff(Instant.parse("2026-10-17T14:00:00Z"), zone))
        assertEquals("2026-10-17", getMatchDayKey(Instant.parse("2026-10-17T23:30:00Z"), zone))
    }

    @Test fun weekBoundsStartOnFriday() {
        val zone = ZoneId.systemDefault()
        for (offset in listOf(-2, 0, 1)) {
            val b = getWeekBounds(offset)
            assertEquals(DayOfWeek.FRIDAY, b.from.atZone(zone).dayOfWeek)
            assertEquals(7, java.time.Duration.between(b.from.atZone(zone), b.to.atZone(zone)).toDays().let { it })
        }
        val now = getWeekBounds(0)
        assertTrue(!now.from.isAfter(Instant.now()) && Instant.now().isBefore(now.to))
    }

    @Test fun monthBounds() {
        val b = getMonthBounds(0)
        assertEquals(1, b.from.atZone(ZoneId.systemDefault()).dayOfMonth)
        assertTrue(!b.from.isAfter(Instant.now()) && Instant.now().isBefore(b.to))
    }
}
