package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.data.remote.dto.UserStatsData
import com.cpen321.usermanagement.data.remote.dto.UsernameAvailabilityResponse

interface ProfileRepository {
    suspend fun getProfile(): Result<User>
    suspend fun updateProfile(
        name: String? = null,
        username: String? = null,
        location: String? = null,
        region: String? = null,
        isPublicProfile: Boolean? = null,
        profilePicture: String? = null,
        favoriteSpecies: List<String>? = null
    ): Result<User>
    suspend fun getUserStats(): Result<UserStatsData>
    suspend fun addFavoriteSpecies(speciesName: String): Result<Unit>
    suspend fun removeFavoriteSpecies(speciesName: String): Result<Unit>
    suspend fun checkUsernameAvailability(username: String): Result<UsernameAvailabilityResponse>
}
