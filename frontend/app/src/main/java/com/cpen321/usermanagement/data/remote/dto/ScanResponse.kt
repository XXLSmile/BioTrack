package com.cpen321.usermanagement.data.remote.dto

data class ScanResponse(
    val message: String,
    val data: ScanPayload
)

data class ScanPayload(
    val recognition: ScanData,
    val imagePath: String?,
    val absoluteImageUrl: String?,
    val latitude: Double?,
    val longitude: Double?
)

data class ScanData(
    val species: Species?,
    val confidence: Double,
    val alternatives: List<Alternative>?
)

data class Species(
    val id: Int,
    val scientificName: String,
    val commonName: String?,
    val rank: String?,
    val taxonomy: String?,
    val wikipediaUrl: String?,
    val imageUrl: String?
)

data class Alternative(
    val scientificName: String,
    val commonName: String?,
    val confidence: Double
)
