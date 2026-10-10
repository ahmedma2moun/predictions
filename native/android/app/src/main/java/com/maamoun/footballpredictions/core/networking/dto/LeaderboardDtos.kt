package com.maamoun.footballpredictions.core.networking.dto

import kotlinx.serialization.SerialName
import com.maamoun.footballpredictions.core.util.parseIsoInstant
import kotlinx.serialization.Serializable

@Serializable
data class LeaderboardEntry(
    val rank: Int,
    val userId: String,
    val name: String,
    val avatarUrl: String? = null,
    val totalPoints: Int,
    // Older payloads omit these; the RN app treats them as zero/empty.
    val championBonusPoints: Int = 0,
    val predictionsCount: Int = 0,
    val accuracy: Double = 0.0,
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
    val badges: List<String> = emptyList(),
    val exactScoreCount: Int = 0,
    val isGroupChampion: Boolean = false,
)

@Serializable
data class LeaderboardGroup(val id: String, val name: String, val isDefault: Boolean)

@Serializable
data class LeaderboardLeague(
    val id: String,
    val externalId: Int,
    val name: String,
    val country: String,
    val logo: String? = null,
)

@Serializable
data class LeaderboardUserPredictionResult(val homeScore: Int, val awayScore: Int)

@Serializable
data class LeaderboardUserPrediction(
    val matchId: String,
    val kickoffTime: String,
    val homeTeamName: String,
    val awayTeamName: String,
    val homeScore: Int,
    val awayScore: Int,
    val result: LeaderboardUserPredictionResult,
    val pointsAwarded: Int,
    val scoringBreakdown: List<ScoringRuleBreakdown>? = null,
    val oddsBonus: OddsBonus? = null,
    val matchOdds: MatchOddsFactors? = null,
) {
    val kickoffDate: java.time.Instant get() = parseIsoInstant(kickoffTime) ?: java.time.Instant.MAX
}

@Serializable
enum class LiveMovement {
    @SerialName("up") UP,
    @SerialName("down") DOWN,
    @SerialName("same") SAME,
}

@Serializable
data class LiveStandingMatch(
    val matchId: String,
    val homeTeamName: String,
    val homeTeamLogo: String? = null,
    val awayTeamName: String,
    val awayTeamLogo: String? = null,
    val homeScore: Int,
    val awayScore: Int,
    val status: String,
    val kickoffTime: String,
)

@Serializable
data class LiveStandingEntry(
    val userId: String,
    val name: String? = null,
    val avatarUrl: String? = null,
    val previousRank: Int,
    val rank: Int,
    val movement: LiveMovement = LiveMovement.SAME,
    val points: Int,
    val livePoints: Int,
    val liveTotalPoints: Int,
)

@Serializable
data class LiveGroupStanding(
    val hasLiveMatches: Boolean,
    val matches: List<LiveStandingMatch>,
    val standings: List<LiveStandingEntry>,
)
