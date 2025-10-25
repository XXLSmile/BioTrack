package com.cpen321.usermanagement.data.model

import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

data class RecentObservation(
    val id: String,
    val title: String,
    val subtitle: String,
    val city: String?,
    val province: String?,
    val imageUrl: String?,
    val notes: String?,
    val confidence: Double?,
    val latitude: Double?,
    val longitude: Double?,
    val speciesCommonName: String?,
    val speciesScientificName: String?,
    val createdAtIso: String?
) {
    val displayLocation: String = when {
        !city.isNullOrBlank() && !province.isNullOrBlank() -> "${city.trim()}, ${province.trim()}"
        !city.isNullOrBlank() -> city.trim()
        !province.isNullOrBlank() -> province.trim()
        latitude != null && longitude != null -> "Location available"
        else -> ""
    }

    val hasCoordinates: Boolean = latitude != null && longitude != null

    val createdAt: OffsetDateTime? = createdAtIso?.let {
        try {
            OffsetDateTime.parse(it, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        } catch (e: DateTimeParseException) {
            null
        }
    }
}
