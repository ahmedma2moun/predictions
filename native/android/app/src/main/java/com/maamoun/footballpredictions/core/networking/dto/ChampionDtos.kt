package com.maamoun.footballpredictions.core.networking.dto

import kotlinx.serialization.DeserializationStrategy
import com.maamoun.footballpredictions.core.util.parseIsoInstant
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonContentPolymorphicSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Serializable
data class ChampionBonusLeague(val id: String, val name: String, val logo: String? = null)

@Serializable
data class ChampionBonusAllowedTeam(val teamId: String, val name: String, val logo: String? = null)

@Serializable
data class ChampionBonusAwardTile(
    val matchId: String,
    val gameNumber: Int,
    val opponentName: String,
    val homeAway: String,
    val teamScore: Int? = null,
    val opponentScore: Int? = null,
    val kickoffTime: String,
    val isWin: Boolean,
    val points: Int,
) {
    val kickoffDate: java.time.Instant get() = parseIsoInstant(kickoffTime) ?: java.time.Instant.MAX
}

@Serializable
data class ChampionBonusRevealTeam(
    val teamId: String,
    val name: String,
    val logo: String? = null,
    val awards: List<ChampionBonusAwardTile>,
    val totalPoints: Int,
    val nextWinPoints: Int,
)

@Serializable
data class ChampionBonusRevealPick(
    val userId: String,
    val name: String? = null,
    val avatarUrl: String? = null,
    val teamId: String,
    val teamName: String,
    val teamLogo: String? = null,
    val totalBonus: Int,
)

@Serializable
data class ChampionBonusMyPick(val teamId: String)

/** `{ enabled: false } | { enabled: true, status: 'OPEN' ... } | { enabled: true, status: 'LOCKED' ... }` */
@Serializable(with = ChampionBonusStateSerializer::class)
sealed interface ChampionBonusState {
    @Serializable
    data object Disabled : ChampionBonusState

    @Serializable
    data class Open(
        val league: ChampionBonusLeague,
        val allowedTeams: List<ChampionBonusAllowedTeam>,
        val pickCount: Int,
        val myPick: ChampionBonusMyPick? = null,
    ) : ChampionBonusState

    @Serializable
    data class Locked(
        val league: ChampionBonusLeague,
        val lockedAt: String,
        val myPick: ChampionBonusMyPick? = null,
        val teams: Map<String, ChampionBonusRevealTeam>,
        val picks: List<ChampionBonusRevealPick>,
    ) : ChampionBonusState {
        val lockedDate: java.time.Instant get() = parseIsoInstant(lockedAt) ?: java.time.Instant.now()
    }
}

object ChampionBonusStateSerializer : JsonContentPolymorphicSerializer<ChampionBonusState>(ChampionBonusState::class) {
    override fun selectDeserializer(element: JsonElement): DeserializationStrategy<ChampionBonusState> {
        val obj = element as JsonObject
        val enabled = obj["enabled"]?.jsonPrimitive?.boolean ?: false
        return when {
            !enabled -> ChampionBonusState.Disabled.serializer()
            obj["status"]?.jsonPrimitive?.contentOrNull == "LOCKED" -> ChampionBonusState.Locked.serializer()
            else -> ChampionBonusState.Open.serializer()
        }
    }
}

@Serializable
data class PickChampionRequest(val teamId: Int)
