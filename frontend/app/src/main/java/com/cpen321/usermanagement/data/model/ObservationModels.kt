package com.cpen321.usermanagement.data.model

import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

data class RecentObservation(
    val id: String,
    val title: String,
    val subtitle: String,
    val location: String,
    val imageUrl: String?,
    val notes: String?,
    val createdAtIso: String?
) {
    val createdAt: OffsetDateTime? = createdAtIso?.let {
        try {
            OffsetDateTime.parse(it, DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        } catch (e: DateTimeParseException) {
            null
        }
    }
}
