package com.cpen321.usermanagement.data.remote.dto

import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonPrimitive
import com.google.gson.annotations.JsonAdapter
import java.lang.reflect.Type

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
    @JsonAdapter(UserSummaryAdapter::class)
    val requester: PublicUserSummary?,
    @JsonAdapter(UserSummaryAdapter::class)
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

class UserSummaryAdapter : JsonDeserializer<PublicUserSummary?> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): PublicUserSummary? {
        if (json == null || json.isJsonNull) return null

        return when {
            json.isJsonObject -> context?.deserialize(json, PublicUserSummary::class.java)
            json.isJsonPrimitive -> {
                val primitive = json as JsonPrimitive
                if (primitive.isString) {
                    PublicUserSummary(primitive.asString, null, null, null)
                } else {
                    null
                }
            }
            else -> null
        }
    }
}
