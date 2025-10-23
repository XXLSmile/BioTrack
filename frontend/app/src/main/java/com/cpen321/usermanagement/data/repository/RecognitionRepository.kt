package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.data.remote.api.RecognitionApi
import com.cpen321.usermanagement.data.remote.dto.RecentEntryDto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecognitionRepository @Inject constructor(
    private val recognitionApi: RecognitionApi
) {
    suspend fun fetchRecentObservations(limit: Int): Result<List<RecentObservation>> = runCatching {
        val response = recognitionApi.getRecentEntries(limit)
        if (response.isSuccessful) {
            val entries = response.body()?.data?.entries ?: emptyList()
            entries.map { it.toDomain() }
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to load recent entries")
        }
    }
}

private fun RecentEntryDto.toDomain(): RecentObservation {
    val species = this.speciesId
    val commonName = species?.commonName
    val scientificName = species?.scientificName
    val displayTitle = commonName ?: scientificName ?: "Unknown species"
    val subtitle = when {
        !commonName.isNullOrBlank() && !scientificName.isNullOrBlank() -> scientificName
        !scientificName.isNullOrBlank() -> scientificName
        else -> ""
    }

    val location = when {
        latitude != null && longitude != null -> "Lat ${"%.2f".format(latitude)}, Lng ${"%.2f".format(longitude)}"
        else -> "Location unavailable"
    }

    return RecentObservation(
        id = _id,
        title = displayTitle,
        subtitle = subtitle,
        location = location,
        imageUrl = species?.imageUrl ?: imageUrl,
        notes = notes,
        confidence = confidence,
        createdAtIso = createdAt
    )
}
