package com.cpen321.usermanagement.data.model

import com.cpen321.usermanagement.data.remote.dto.PublicUserSummary
import com.cpen321.usermanagement.data.remote.dto.UserSummaryAdapter
import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonPrimitive
import com.google.gson.annotations.JsonAdapter
import java.lang.reflect.Type



data class CatalogShareEntry(
    val _id: String,
    @JsonAdapter(CatalogSummaryAdapter::class)
    val catalog: CatalogShareCatalog?,
    val owner: String?,
    @JsonAdapter(UserSummaryAdapter::class)
    val invitee: PublicUserSummary?,
    @JsonAdapter(UserSummaryAdapter::class)
    val invitedBy: PublicUserSummary?,
    val role: String,
    val status: String,
    val respondedAt: String?,
    val createdAt: String?,
    val updatedAt: String?
)

data class CatalogShareCatalog(
    val _id: String,
    val name: String? = null,
    val description: String? = null
)

data class CatalogCollaboratorsResponse(
    val collaborators: List<CatalogShareEntry>
)

data class CatalogSharesResponse(
    val shares: List<CatalogShareEntry>
)

data class CatalogShareWrapper(
    val invitation: CatalogShareEntry?
)

data class InviteCollaboratorBody(
    val inviteeId: String,
    val role: String
)

data class UpdateCollaboratorBody(
    val role: String? = null,
    val action: String? = null
)

data class RespondInvitationBody(
    val action: String
)


class CatalogSummaryAdapter : JsonDeserializer<CatalogShareCatalog?> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): CatalogShareCatalog? {
        if (json == null || json.isJsonNull) return null

        return when {
            json.isJsonObject -> context?.deserialize(json, CatalogShareCatalog::class.java)
            json.isJsonPrimitive -> {
                val primitive = json as JsonPrimitive
                if (primitive.isString) {
                    CatalogShareCatalog(_id = primitive.asString)
                } else {
                    null
                }
            }
            else -> null
        }
    }
}