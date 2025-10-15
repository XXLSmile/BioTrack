package com.cpen321.usermanagement.data.model

data class Catalog(
    val id: String,
    var name: String,
    val createdAt: Long = System.currentTimeMillis(),
    val entries: MutableList<CatalogEntry> = mutableListOf()
)


