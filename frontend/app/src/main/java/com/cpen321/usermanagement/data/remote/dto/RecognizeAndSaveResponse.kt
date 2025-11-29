package com.cpen321.usermanagement.data.remote.dto

data class RecognizeAndSaveResponse(
    val message: String,
    val data: RecognizeAndSaveData?
)

data class RecognizeAndSaveData(
    val entry: SavedCatalogEntry?,
    val recognition: ScanData?,
    val linkedCatalogId: String?
)

data class SavedEntryResponse(
    val entry: SavedCatalogEntry?,
    val imageUrl: String?
)

data class SavedCatalogEntry(
    val _id: String,
    val userId: String,
    val speciesId: String,
    val imageUrl: String?,
    val imageMimeType: String?,
    val latitude: Double?,
    val longitude: Double?,
    val confidence: Double,
    val notes: String?,
    val createdAt: String?,
    val updatedAt: String?
)
