package com.maamoun.footballpredictions.core.networking.dto

import kotlinx.serialization.Serializable

@Serializable
data class AuthUser(val id: String, val name: String, val email: String, val role: String)

@Serializable
data class LoginResponse(val token: String, val user: AuthUser)

@Serializable
data class LoginRequest(val email: String, val password: String)
