package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.data.remote.api.RecognitionApi
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
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
            throw Exception(response.errorBody()?.string() ?: "Failed to load recent observations")
        }
    }

    suspend fun fetchAllCatalogEntries(): Result<List<RecentObservation>> = runCatching {
        val response = recognitionApi.getCatalogEntries()
        if (response.isSuccessful) {
            val entries = response.body()?.data?.entries ?: emptyList()
            entries.map { it.toDomain() }
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to load observations")
        }
    }

    suspend fun deleteEntry(entryId: String): Result<Unit> = runCatching {
        val response = recognitionApi.deleteEntry(entryId)
        if (response.isSuccessful) {
            Unit
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to delete observation")
        }
    }
}

private fun RecentEntryDto.toDomain(): RecentObservation {
    val species = this.speciesId
    val resolvedImage = RetrofitClient.resolveImageUrl(imageUrl)
        ?: RetrofitClient.resolveImageUrl(species?.imageUrl)
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
        imageUrl = resolvedImage,
        notes = notes,
        confidence = confidence,
        createdAtIso = createdAt
    )
}
