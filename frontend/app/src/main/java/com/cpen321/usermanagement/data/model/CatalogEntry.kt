package com.cpen321.usermanagement.data.model

data class CatalogEntry(
    val id: String,
    val speciesName: String,
    val description: String,
    val imageUri: String,
    val location: String?,
    val timestamp: Long = System.currentTimeMillis()
)