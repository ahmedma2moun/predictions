package com.maamoun.footballpredictions.core.networking.dto

import kotlinx.serialization.SerialName
import com.maamoun.footballpredictions.core.util.parseIsoInstant
import kotlinx.serialization.Serializable

@Serializable
data class PredictionHistoryMatch(
    @SerialName("_id") val id: String,
    val kickoffTime: String,
    val status: MatchStatus = MatchStatus.SCHEDULED,
    val leagueId: String? = null,
    val leagueName: String? = null,
    val matchday: Int? = null,
    val stage: String? = null,
    val leg: Int? = null,
    val venue: String? = null,
    val homeTeam: Team,
    val awayTeam: Team,
    val result: MatchResult? = null,
    val odds: MatchOdds? = null,
) {
    val kickoffDate: java.time.Instant get() = parseIsoInstant(kickoffTime) ?: java.time.Instant.MAX
}

@Serializable
data class PredictionHistoryItem(
    val id: String,
    val userId: String,
    val matchId: String,
    val homeScore: Int,
    val awayScore: Int,
    val predictedWinner: PredictedWinner? = null,
    val pointsAwarded: Int,
    val baseScore: Int,
    val outcomeOdds: Double,
    val createdAt: String,
    val updatedAt: String,
    val scoringBreakdown: List<ScoringRuleBreakdown>? = null,
    val oddsBonus: OddsBonus? = null,
    val match: PredictionHistoryMatch,
)

@Serializable
data class AccuracyStats(
    val totalPoints: Int,
    val overallAccuracy: Double,
    val exactScorePct: Double,
    val correctWinnerPct: Double,
    val bestLeagueName: String? = null,
    val bestLeagueLogo: String? = null,
    val currentStreak: Int,
    val totalFinished: Int,
)

@Serializable
data class GroupPredictionEntry(
    val userId: String,
    val userName: String? = null,
    val homeScore: Int? = null,
    val awayScore: Int? = null,
    val pointsAwarded: Int? = null,
    val scoringBreakdown: List<ScoringRuleBreakdown>? = null,
    val predicted: Boolean,
    val isLive: Boolean,
)
