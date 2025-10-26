package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.ApiResponse
import com.cpen321.usermanagement.data.remote.dto.FriendListResponse
import com.cpen321.usermanagement.data.remote.dto.FriendRecommendationsResponse
import com.cpen321.usermanagement.data.remote.dto.FriendRequestsResponse
import com.cpen321.usermanagement.data.remote.dto.SendFriendRequestBody
import com.cpen321.usermanagement.data.remote.dto.UpdateFriendRequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface FriendApi {
    @GET("friends")
    suspend fun getFriends(): Response<ApiResponse<FriendListResponse>>

    @GET("friends/requests")
    suspend fun getFriendRequests(
        @Query("type") type: String? = null
    ): Response<ApiResponse<FriendRequestsResponse>>

    @GET("friends/recommendations")
    suspend fun getFriendRecommendations(
        @Query("limit") limit: Int? = null
    ): Response<ApiResponse<FriendRecommendationsResponse>>

    @POST("friends/requests")
    suspend fun sendFriendRequest(
        @Body body: SendFriendRequestBody
    ): Response<ApiResponse<Void>>

    @PATCH("friends/requests/{requestId}")
    suspend fun respondToFriendRequest(
        @Path("requestId") requestId: String,
        @Body body: UpdateFriendRequestBody
    ): Response<ApiResponse<Void>>

    @DELETE("friends/{friendshipId}")
    suspend fun removeFriend(
        @Path("friendshipId") friendshipId: String
    ): Response<ApiResponse<Void>>
}
