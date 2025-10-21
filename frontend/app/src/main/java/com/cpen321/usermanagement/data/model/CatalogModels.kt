package com.cpen321.usermanagement.data.model

data class CatalogListResponse(
    val message: String?,
    val data: CatalogListData?
)

data class CatalogListData(
    val catalogs: List<Catalog>
)

data class CatalogResponse(
    val message: String?,
    val data: CatalogData?
)

data class CatalogData(
    val catalog: Catalog,
    val entries: List<CatalogEntry>?
)

data class Catalog(
    val _id: String,
    val owner: String?,
    val name: String,
    val description: String?,
    val createdAt: String?,
    val updatedAt: String?
)

data class CatalogEntry(
    val entry: Entry,
    val linkedAt: String?,
    val addedBy: String?
)

data class Entry(
    val _id: String,
    val species: String?,
    val confidence: Double?,
    val imageUrl: String?
)
