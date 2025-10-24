package com.cpen321.usermanagement.data.remote.socket

import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogEntry

sealed class CatalogSocketEvent {
    data class EntriesUpdated(
        val catalogId: String,
        val entries: List<CatalogEntry>,
        val updatedAt: String?
    ) : CatalogSocketEvent()

    data class MetadataUpdated(
        val catalogId: String,
        val catalog: Catalog,
        val updatedAt: String?
    ) : CatalogSocketEvent()

    data class CatalogDeleted(
        val catalogId: String,
        val timestamp: String?
    ) : CatalogSocketEvent()

    data class Error(
        val message: String
    ) : CatalogSocketEvent()
}
