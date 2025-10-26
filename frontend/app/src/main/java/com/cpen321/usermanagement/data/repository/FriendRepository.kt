package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.remote.api.FriendApi
import com.cpen321.usermanagement.data.remote.api.UserInterface
import com.cpen321.usermanagement.data.remote.dto.FriendListResponse
import com.cpen321.usermanagement.data.remote.dto.FriendRequestsResponse
import com.cpen321.usermanagement.data.remote.dto.PublicUserProfile
import com.cpen321.usermanagement.data.remote.dto.SearchUsersResponse
import com.cpen321.usermanagement.data.remote.dto.SendFriendRequestBody
import com.cpen321.usermanagement.data.remote.dto.UpdateFriendRequestBody
import com.cpen321.usermanagement.utils.JsonUtils.parseErrorMessage
import javax.inject.Inject
import javax.inject.Singleton

class PrivateProfileException(message: String) : Exception(message)
class UserNotFoundException(message: String) : Exception(message)

@Singleton
class FriendRepository @Inject constructor(
    private val friendApi: FriendApi,
    private val userInterface: UserInterface
) {
    suspend fun fetchFriends(): Result<FriendListResponse> = runCatching {
        val response = friendApi.getFriends()
        if (response.isSuccessful) {
            response.body()?.data ?: FriendListResponse(emptyList(), 0)
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to load friends")
        }
    }

    suspend fun fetchFriendRequests(type: String? = null): Result<FriendRequestsResponse> = runCatching {
        val response = friendApi.getFriendRequests(type)
        if (response.isSuccessful) {
            response.body()?.data ?: FriendRequestsResponse(emptyList(), 0)
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to load friend requests")
        }
    }

    suspend fun sendFriendRequest(targetUserId: String): Result<Unit> = runCatching {
        val response = friendApi.sendFriendRequest(SendFriendRequestBody(targetUserId))
        if (!response.isSuccessful) {
            throw Exception(response.errorBody()?.string() ?: "Failed to send friend request")
        }
    }

    suspend fun respondToRequest(requestId: String, action: String): Result<Unit> = runCatching {
        val response = friendApi.respondToFriendRequest(requestId, UpdateFriendRequestBody(action))
        if (!response.isSuccessful) {
            throw Exception(response.errorBody()?.string() ?: "Failed to update friend request")
        }
    }

    suspend fun cancelFriendRequest(requestId: String): Result<Unit> = runCatching {
        val response = friendApi.cancelFriendRequest(requestId)
        if (!response.isSuccessful) {
            throw Exception(response.errorBody()?.string() ?: "Failed to cancel friend request")
        }
    }

    suspend fun removeFriend(friendshipId: String): Result<Unit> = runCatching {
        val response = friendApi.removeFriend(friendshipId)
        if (!response.isSuccessful) {
            throw Exception(response.errorBody()?.string() ?: "Failed to remove friend")
        }
    }

    suspend fun searchUsers(query: String): Result<SearchUsersResponse> = runCatching {
        val response = userInterface.searchUsers(query)
        if (response.isSuccessful) {
            response.body()?.data ?: SearchUsersResponse(emptyList(), 0)
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to search users")
        }
    }

    suspend fun fetchPublicProfile(username: String): Result<PublicUserProfile> = runCatching {
        val response = userInterface.getUserByUsername(username)
        val body = response.body()

        if (response.isSuccessful && body?.data?.user != null) {
            body.data.user
        } else {
            val errorBodyString = response.errorBody()?.string()
            val fallbackMessage = body?.message ?: "Failed to load profile"
            val message = parseErrorMessage(errorBodyString, fallbackMessage)
            when (response.code()) {
              403 -> throw PrivateProfileException(message)
              404 -> throw UserNotFoundException(message)
              else -> throw Exception(message)
            }
        }
    }
}
