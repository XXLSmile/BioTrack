package com.cpen321.usermanagement.data.remote.dto

data class UpdateProfileRequest(
    val name: String? = null,
    val username: String? = null,
    val location: String? = null,
    val region: String? = null,
    val isPublicProfile: Boolean? = null,
    val profilePicture: String? = null,
    val favoriteSpecies: List<String>? = null
)

data class ProfileData(
    val user: User
)

data class User(
    val _id: String,
    val email: String,
    val name: String,
    val username: String,
    val googleId: String? = null,
    val profilePicture: String? = null,
    val location: String? = null,
    val region: String? = null,
    val isPublicProfile: Boolean = true,
    val observationCount: Int = 0,
    val speciesDiscovered: Int = 0,
    val favoriteSpecies: List<String> = emptyList(),
    val badges: List<String> = emptyList(),
    val friendCount: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

data class UserStatsData(
    val observationCount: Int,
    val speciesDiscovered: Int,
    val friendCount: Int,
    val badges: List<String>
)

data class FavoriteSpeciesRequest(
    val speciesName: String
)

data class UsernameAvailabilityResponse(
    val available: Boolean,
    val username: String?,
    val message: String
)
