package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.ApiResponse
import com.cpen321.usermanagement.data.remote.dto.FavoriteSpeciesRequest
import com.cpen321.usermanagement.data.remote.dto.ProfileData
import com.cpen321.usermanagement.data.remote.dto.SearchUsersResponse
import com.cpen321.usermanagement.data.remote.dto.UpdateProfileRequest
import com.cpen321.usermanagement.data.remote.dto.UserStatsData
import com.cpen321.usermanagement.data.remote.dto.UsernameAvailabilityResponse
import com.cpen321.usermanagement.data.remote.dto.PublicProfileData
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface UserInterface {
    @GET("user/profile")
    suspend fun getProfile(): Response<ApiResponse<ProfileData>>

    @POST("user/profile")
    suspend fun updateProfile(
        @Body request: UpdateProfileRequest
    ): Response<ApiResponse<ProfileData>>

    @DELETE("user/profile")
    suspend fun deleteProfile(): Response<ApiResponse<Unit>>

    @GET("user/stats")
    suspend fun getUserStats(): Response<ApiResponse<UserStatsData>>

    @GET("user/check-username")
    suspend fun checkUsername(
        @Query("username") username: String
    ): Response<UsernameAvailabilityResponse>

    @POST("user/favorite-species")
    suspend fun addFavoriteSpecies(
        @Body request: FavoriteSpeciesRequest
    ): Response<ApiResponse<Unit>>

    @DELETE("user/favorite-species")
    suspend fun removeFavoriteSpecies(
        @Body request: FavoriteSpeciesRequest
    ): Response<ApiResponse<Unit>>

    @GET("user/search")
    suspend fun searchUsers(
        @Query("query") query: String
    ): Response<ApiResponse<SearchUsersResponse>>

    @GET("user/username/{username}")
    suspend fun getUserByUsername(
        @Path("username") username: String
    ): Response<ApiResponse<PublicProfileData>>
}
