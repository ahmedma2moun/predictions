package com.maamoun.footballpredictions

import com.maamoun.footballpredictions.core.networking.dto.EventSide
import com.maamoun.footballpredictions.core.networking.dto.MatchEvent
import com.maamoun.footballpredictions.core.networking.dto.MatchEventType
import com.maamoun.footballpredictions.features.matchdetail.mergeMatchEvents
import org.junit.Assert.*
import org.junit.Test

class EventMergeTest {
    private fun e(type: MatchEventType, detail: String, minute: Int, team: EventSide = EventSide.HOME, player: String = "P") =
        MatchEvent(type, detail, minute, team, player, null)

    @Test fun yellowThenRedSamePlayerMinuteMerges() {
        val merged = mergeMatchEvents(listOf(e(MatchEventType.CARD, "Yellow Card", 55), e(MatchEventType.CARD, "Red Card", 55)))
        assertEquals(1, merged.size)
        assertEquals(listOf("🟨", "🟥"), merged[0].icons)
    }

    @Test fun differentPlayersDoNotMerge() {
        val merged = mergeMatchEvents(listOf(e(MatchEventType.CARD, "Yellow Card", 55, player = "A"), e(MatchEventType.CARD, "Red Card", 55, player = "B")))
        assertEquals(2, merged.size)
    }

    @Test fun ownGoalAndOrdering() {
        val merged = mergeMatchEvents(listOf(e(MatchEventType.GOAL, "Own Goal", 40), e(MatchEventType.GOAL, "Normal Goal", 10)))
        assertEquals(listOf(10, 40), merged.map { it.event.minute })
        assertFalse(merged[0].ownGoal)
        assertTrue(merged[1].ownGoal)
        assertEquals(listOf("⚽"), merged[0].icons)
    }
}
