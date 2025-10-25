package com.cpen321.usermanagement.data.remote.dto

import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonPrimitive
import com.google.gson.annotations.JsonAdapter
import java.lang.reflect.Type

data class RecentEntriesResponse(
    val entries: List<RecentEntryDto>,
    val count: Int
)

data class RecentEntryDto(
    val _id: String,
    val userId: String,
    @JsonAdapter(SpeciesSummaryAdapter::class)
    val speciesId: SpeciesSummaryDto?,
    val imageUrl: String?,
    val imageMimeType: String?,
    val confidence: Double?,
    val notes: String?,
    val latitude: Double?,
    val longitude: Double?,
    val city: String?,
    val province: String?,
    val createdAt: String?,
    val updatedAt: String?
)

data class SpeciesSummaryDto(
    val _id: String?,
    val scientificName: String?,
    val commonName: String?,
    val rank: String?,
    val taxonomy: String?,
    val wikipediaUrl: String?,
    val imageUrl: String?
)

class SpeciesSummaryAdapter : JsonDeserializer<SpeciesSummaryDto?> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): SpeciesSummaryDto? {
        if (json == null || json.isJsonNull) return null
        return when {
            json.isJsonObject -> context?.deserialize(json, SpeciesSummaryDto::class.java)
            json.isJsonPrimitive -> {
                val primitive = json as JsonPrimitive
                if (primitive.isString) {
                    SpeciesSummaryDto(primitive.asString, null, null, null, null, null, null)
                } else {
                    null
                }
            }
            else -> null
        }
    }
}
