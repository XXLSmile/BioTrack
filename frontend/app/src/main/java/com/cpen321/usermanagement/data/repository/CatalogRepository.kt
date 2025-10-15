package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogEntry
import java.util.UUID

object CatalogRepository {
    private val catalogs = mutableListOf<Catalog>()

    fun getCatalogs(): List<Catalog> = catalogs
    fun getCatalog(id: String): Catalog? = catalogs.find { it.id == id }

    fun addCatalog(name: String): Catalog {
        val newCatalog = Catalog(id = UUID.randomUUID().toString(), name = name)
        catalogs.add(newCatalog)
        return newCatalog
    }

    fun deleteCatalog(id: String) {
        catalogs.removeAll { it.id == id }
    }

    fun addEntryToCatalog(catalogId: String, entry: CatalogEntry) {
        getCatalog(catalogId)?.entries?.add(entry)
    }
}
