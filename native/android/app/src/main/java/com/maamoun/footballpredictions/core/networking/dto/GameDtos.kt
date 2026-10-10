package com.maamoun.footballpredictions.core.networking.dto

import com.maamoun.footballpredictions.core.util.parseIsoInstant
import kotlinx.serialization.Serializable

// Club / Slip payloads use NUMERIC ids on the wire (unlike the rest of the API).
// Source of truth: src/lib/game/types.ts

@Serializable data class GamePlayer(val id: Int, val name: String, val title: String? = null)
@Serializable data class GameGroupRef(val id: Int, val name: String)
@Serializable data class GameSeasonRef(val id: Int, val name: String, val status: String)

@Serializable
data class WeekRow(
    val userId: Int, val name: String, val points: Int, val exact: Int, val predicted: Int, val rank: Int,
    val title: String? = null,
)

@Serializable
data class WeekCompetition(
    val key: String, val end: String, val state: String, val matchCount: Int,
    val standings: List<WeekRow>, val winnerIds: List<Int>,
)

@Serializable data class GameEventReaction(val emoji: String, val count: Int, val mine: Boolean)

@Serializable
data class GameEvent(
    val key: String, val at: String, val kind: String, val text: String,
    val matchId: Int? = null, val reactions: List<GameEventReaction>,
)

@Serializable
data class Challenge(
    val key: String, val name: String, val description: String, val title: String,
    val progress: Int, val target: Int, val unlocked: Boolean,
)

@Serializable data class UnlockedTitle(val key: String, val title: String)

@Serializable
data class GameRival(
    val userId: Int, val name: String, val myPoints: Int, val theirPoints: Int, val gap: Int,
    val wins: Int, val losses: Int, val draws: Int, val myAccuracy: Double, val theirAccuracy: Double,
)

@Serializable data class BestPrediction(val matchId: Int, val label: String, val score: String, val points: Int)

@Serializable
data class PlayerRecap(
    val name: String, val seasonName: String, val final: Boolean, val rank: Int? = null, val totalPoints: Int,
    val predictions: Int, val exactScores: Int, val accuracy: Double, val longestStreak: Int,
    val weeklyWins: Int, val biggestComeback: Int, val bestPrediction: BestPrediction? = null, val shareText: String,
)

@Serializable
data class GameHub(
    val currentWeekKey: String, val userId: Int,
    val groups: List<GameGroupRef>, val groupId: Int? = null,
    val seasons: List<GameSeasonRef>, val seasonId: Int? = null,
    val players: List<GamePlayer>, val weeks: List<WeekCompetition>, val feed: List<GameEvent>,
    val challenges: List<Challenge>, val equippedTitle: String? = null, val unlockedTitles: List<UnlockedTitle>,
    val rival: GameRival? = null, val recap: PlayerRecap? = null,
)

@Serializable
data class SlipMatch(
    val id: Int, val homeTeamName: String, val awayTeamName: String, val kickoffTime: String, val league: String,
    val homeScore: Int? = null, val awayScore: Int? = null, val locked: Boolean,
) {
    val kickoffDate: java.time.Instant get() = parseIsoInstant(kickoffTime) ?: java.time.Instant.MAX
}

@Serializable data class SlipData(val matches: List<SlipMatch>, val remaining: Int, val from: String, val to: String)
@Serializable data class SlipResult(val matchId: Int, val saved: Boolean, val error: String? = null)
@Serializable data class SlipSaveResponse(val results: List<SlipResult>)
@Serializable data class SlipPredictionInput(val matchId: Int, val homeScore: Int, val awayScore: Int)
@Serializable data class SlipSaveRequest(val predictions: List<SlipPredictionInput>)
