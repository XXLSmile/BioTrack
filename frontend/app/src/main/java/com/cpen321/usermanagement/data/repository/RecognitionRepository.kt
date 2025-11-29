package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.data.remote.api.RecognitionApi
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.data.remote.dto.EntryRecognitionUpdateDto
import com.cpen321.usermanagement.data.remote.dto.RecentEntryDto
import com.cpen321.usermanagement.data.remote.dto.SavedCatalogEntry
import com.cpen321.usermanagement.data.remote.dto.ScanData
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Response
import org.json.JSONException
import org.json.JSONObject
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
            throw RecognitionRepositoryException(
                response.errorBody()?.string().orEmpty().ifBlank { "Failed to load recent observations" }
            )
        }
    }

    suspend fun fetchAllCatalogEntries(): Result<List<RecentObservation>> = runCatching {
        val response = recognitionApi.getCatalogEntries()
        if (response.isSuccessful) {
            val entries = response.body()?.data?.entries ?: emptyList()
            entries.map { it.toDomain() }
        } else {
            throw RecognitionRepositoryException(
                response.errorBody()?.string().orEmpty().ifBlank { "Failed to load observations" }
            )
        }
    }

    suspend fun deleteEntry(entryId: String): Result<Unit> = runCatching {
        val response = recognitionApi.deleteEntry(entryId)
        if (response.isSuccessful) {
            Unit
        } else {
            throw RecognitionRepositoryException(
                response.parseApiMessage("Failed to delete observation")
            )
        }
    }

    suspend fun rerunEntryRecognition(entryId: String): Result<EntryRecognitionUpdate> = runCatching {
        val response = recognitionApi.rerunEntryRecognition(entryId)
        if (response.isSuccessful) {
            val payload = response.body()?.data ?: throw RecognitionRepositoryException(
                "Missing recognition data"
            )
            payload.toDomain()
        } else {
            throw RecognitionRepositoryException(
                response.parseApiMessage("Failed to re-run recognition")
            )
        }
    }

    suspend fun saveImageEntry(
        image: MultipartBody.Part,
        latitude: Double?,
        longitude: Double?,
        notes: String?
    ): Result<SavedCatalogEntry> = runCatching {
        val notesBody = notes?.takeIf { it.isNotBlank() }?.toRequestBody(MultipartBody.FORM)
        val response = recognitionApi.saveImageEntry(
            image = image,
            latitude = latitude,
            longitude = longitude,
            notes = notesBody
        )
        if (response.isSuccessful) {
            val entry = response.body()?.data?.entry
            entry ?: throw RecognitionRepositoryException("Missing entry from save response")
        } else {
            throw RecognitionRepositoryException(
                response.parseApiMessage("Failed to save observation image")
            )
        }
    }
}

data class EntryRecognitionUpdate(
    val observation: RecentObservation,
    val recognition: ScanData?
)

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

    return RecentObservation(
        id = _id,
        title = displayTitle,
        subtitle = subtitle,
        city = city?.takeIf { it.isNotBlank() },
        province = province?.takeIf { it.isNotBlank() },
        imageUrl = resolvedImage,
        notes = notes,
        confidence = confidence,
        latitude = latitude,
        longitude = longitude,
        speciesCommonName = commonName,
        speciesScientificName = scientificName,
        createdAtIso = createdAt
    )
}

private fun EntryRecognitionUpdateDto.toDomain(): EntryRecognitionUpdate {
    val observation = entry.toDomain()
    return EntryRecognitionUpdate(
        observation = observation,
        recognition = recognition
    )
}

private fun <T> Response<T>.parseApiMessage(fallback: String): String {
    val rawBody = errorBody()?.string()?.trim().orEmpty()
    if (rawBody.isBlank()) return fallback
    return try {
        val json = JSONObject(rawBody)
        json.optString("message")
            .ifBlank { json.optString("error") }
            .ifBlank { fallback }
    } catch (_: JSONException) {
        rawBody
    }
}
