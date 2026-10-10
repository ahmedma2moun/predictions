package com.maamoun.footballpredictions.core.networking.dto

import kotlinx.serialization.SerialName
import com.maamoun.footballpredictions.core.util.parseIsoInstant
import kotlinx.serialization.Serializable

/** Unknown server values decode to `SCHEDULED` (coerceInputValues) rather than failing the payload. */
@Serializable
enum class MatchStatus {
    @SerialName("scheduled") SCHEDULED,
    @SerialName("live") LIVE,
    @SerialName("finished") FINISHED,
    @SerialName("postponed") POSTPONED,
    @SerialName("cancelled") CANCELLED,
}

@Serializable
enum class PredictedWinner {
    @SerialName("home") HOME,
    @SerialName("away") AWAY,
    @SerialName("draw") DRAW,
}

@Serializable
data class Team(val name: String, val logo: String? = null)

@Serializable
data class MatchResult(
    val homeScore: Int,
    val awayScore: Int,
    val penaltyHomeScore: Int? = null,
    val penaltyAwayScore: Int? = null,
)

@Serializable
data class PredictionSummary(
    val homeScore: Int,
    val awayScore: Int,
    val predictedWinner: PredictedWinner? = null,
    val pointsAwarded: Int,
)

@Serializable
data class Standing(
    val position: Int,
    val points: Int,
    val played: Int? = null,
    val won: Int? = null,
    val drawn: Int? = null,
    val lost: Int? = null,
    val goalDifference: Int? = null,
    val form: String? = null,
)

@Serializable
data class MatchListItem(
    @SerialName("_id") val id: String,
    val externalId: Int? = null,
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
    val prediction: PredictionSummary? = null,
    val homeStanding: Standing? = null,
    val awayStanding: Standing? = null,
) {
    val kickoffDate: java.time.Instant get() = parseIsoInstant(kickoffTime) ?: java.time.Instant.MAX
}

@Serializable
data class AdjacentMatch(
    @SerialName("_id") val id: String,
    val homeTeamName: String,
    val awayTeamName: String,
)

@Serializable
data class MatchOddsVotes(val homeWin: Int, val draw: Int, val awayWin: Int)

@Serializable
data class MatchOdds(
    val homeWin: Double,
    val draw: Double,
    val awayWin: Double,
    val locked: Boolean,
    val votes: MatchOddsVotes? = null,
)

@Serializable
data class ScoringRuleBreakdown(val key: String, val name: String, val points: Int, val awarded: Boolean)

@Serializable
data class OddsBonus(val outcomeOdds: Double, val baseScore: Int, val finalScore: Int)

@Serializable
data class MatchOddsFactors(val homeWin: Double, val draw: Double, val awayWin: Double)

@Serializable
data class OtherPrediction(
    val userId: String,
    val userName: String,
    val homeScore: Int,
    val awayScore: Int,
    val pointsAwarded: Int,
    val scoringBreakdown: List<ScoringRuleBreakdown>? = null,
    val oddsBonus: OddsBonus? = null,
)

/** `MatchListItem` plus detail-only fields (flattened — no inheritance on the wire). */
@Serializable
data class MatchDetail(
    @SerialName("_id") val id: String,
    val externalId: Int? = null,
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
    val prediction: PredictionSummary? = null,
    val homeStanding: Standing? = null,
    val awayStanding: Standing? = null,
    val isAdmin: Boolean = false,
    val prevMatch: AdjacentMatch? = null,
    val nextMatch: AdjacentMatch? = null,
    val isKnockout: Boolean = false,
    val resultPenaltyHomeScore: Int? = null,
    val resultPenaltyAwayScore: Int? = null,
    val odds: MatchOdds? = null,
    val allPredictions: List<OtherPrediction>? = null,
) {
    val kickoffDate: java.time.Instant get() = parseIsoInstant(kickoffTime) ?: java.time.Instant.MAX
}

@Serializable
enum class FormResult { W, D, L }

@Serializable
data class TeamFormMatch(
    val date: String,
    val opponentName: String,
    val opponentLogo: String? = null,
    val isHome: Boolean,
    val teamScore: Int? = null,
    val opponentScore: Int? = null,
    val penaltyTeamScore: Int? = null,
    val penaltyOpponentScore: Int? = null,
    /** Unknown values coerce to null (coerceInputValues + nullable default). */
    val result: FormResult? = null,
    val competition: String,
    val status: String,
)

@Serializable
data class MatchForm(val home: List<TeamFormMatch>, val away: List<TeamFormMatch>)

@Serializable
enum class MatchEventType {
    @SerialName("goal") GOAL,
    @SerialName("card") CARD,
}

@Serializable
enum class EventSide {
    @SerialName("home") HOME,
    @SerialName("away") AWAY,
}

@Serializable
data class MatchEvent(
    val type: MatchEventType,
    val detail: String,
    val minute: Int,
    val team: EventSide,
    val player: String,
    val assistPlayer: String? = null,
)

/** `GET matches/{id}/live`. Fields are nullable because the upstream feed can omit them. */
@Serializable
data class LiveScoreResponse(
    val status: MatchStatus = MatchStatus.SCHEDULED,
    val homeScore: Int? = null,
    val awayScore: Int? = null,
    val events: List<MatchEvent>? = null,
)

@Serializable
data class SavePredictionRequest(val matchId: String, val homeScore: Int, val awayScore: Int)
