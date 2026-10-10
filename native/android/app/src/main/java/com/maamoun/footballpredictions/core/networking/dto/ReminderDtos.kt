package com.maamoun.footballpredictions.core.networking.dto

import kotlinx.serialization.Serializable

@Serializable data class ReminderTeam(val teamLeagueId: Int, val name: String)
@Serializable data class ReminderLeague(val id: Int, val name: String, val teams: List<ReminderTeam>)
@Serializable data class RemindersData(val leagues: List<ReminderLeague>, val selections: List<ReminderLeague>)
@Serializable data class ReminderSelectionsRequest(val selections: List<Int>)
@Serializable data class ReminderSaveResponse(val selections: List<ReminderLeague>)

@Serializable data class DeviceRegistrationRequest(val fcmToken: String, val platform: String)
@Serializable data class DeviceUnregisterRequest(val fcmToken: String)
