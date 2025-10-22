package com.cpen321.usermanagement.data.remote.dto

data class FriendSummary(
    val friendshipId: String,
    val user: PublicUserSummary,
    val since: String
)

data class FriendListResponse(
    val friends: List<FriendSummary>,
    val count: Int
)

data class FriendRequestSummary(
    val _id: String,
    val requester: PublicUserSummary?,
    val addressee: PublicUserSummary?,
    val status: String,
    val createdAt: String,
    val respondedAt: String?
)

data class FriendRequestsResponse(
    val requests: List<FriendRequestSummary>,
    val count: Int
)

data class SendFriendRequestBody(
    val targetUserId: String
)

data class UpdateFriendRequestBody(
    val action: String
)

data class PublicUserSummary(
    val _id: String,
    val name: String?,
    val username: String?,
    val profilePicture: String?
)

data class SearchUsersResponse(
    val users: List<PublicUserSummary>,
    val count: Int
)
