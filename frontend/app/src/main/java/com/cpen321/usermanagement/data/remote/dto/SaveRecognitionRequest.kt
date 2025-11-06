package com.cpen321.usermanagement.data.remote.dto

data class SaveRecognitionRequest(
    val imagePath: String,
    val recognition: ScanData,
    val catalogId: String?,
    val notes: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null
)
