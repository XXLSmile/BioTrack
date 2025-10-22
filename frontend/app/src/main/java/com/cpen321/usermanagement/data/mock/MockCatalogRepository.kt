package com.cpen321.usermanagement.data.mock

import java.text.SimpleDateFormat
import java.util.*

data class MockCatalog(
    val id: String,
    val name: String,
    val entries: MutableList<MockCatalogEntry> = mutableListOf()
)

data class MockCatalogEntry(
    val id: String,
    val speciesName: String,
    val scientificName: String,
    val imageUrl: String,
    val dateAdded: String = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).format(Date())
)

object MockCatalogRepository {
    val catalogs = mutableListOf(
        MockCatalog(id = "catalog1", name = "My Wildlife Catalog")
    )

    fun addEntryToCatalog(catalogId: String, entry: MockCatalogEntry) {
        catalogs.find { it.id == catalogId }?.entries?.add(entry)
    }
}
