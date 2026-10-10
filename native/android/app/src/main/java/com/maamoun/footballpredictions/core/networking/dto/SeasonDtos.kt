package com.maamoun.footballpredictions.core.networking.dto

import kotlinx.serialization.Serializable

@Serializable
data class Season(
    val id: String,
    val name: String,
    val description: String? = null,
    val status: String,
    val startDate: String,
    val startedAt: String? = null,
    val endedAt: String? = null,
)

@Serializable
data class SeasonStandingEntry(
    val id: String,
    val rank: Int,
    val totalPoints: Int,
    val groupId: Int? = null,
    val groupName: String? = null,
    val userId: String,
    val userName: String? = null,
)

@Serializable
data class SeasonWithStandings(
    val id: String,
    val name: String,
    val description: String? = null,
    val status: String,
    val startDate: String,
    val startedAt: String? = null,
    val endedAt: String? = null,
    val standings: List<SeasonStandingEntry>,
)
