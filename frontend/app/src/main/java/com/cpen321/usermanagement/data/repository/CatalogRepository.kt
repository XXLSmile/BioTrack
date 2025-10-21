package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.remote.api.CatalogApi
import com.cpen321.usermanagement.data.model.*
import javax.inject.Inject

class CatalogRepository @Inject constructor(
    private val api: CatalogApi
) {

    suspend fun getCatalogs(): List<Catalog> {
        val response = api.listCatalogs()
        return response.body()?.data?.catalogs ?: emptyList()
    }

    suspend fun createCatalog(name: String, description: String? = null): Catalog? {
        val response = api.createCatalog(
            mapOf("name" to name, "description" to (description ?: ""))
        )
        return response.body()?.data?.catalog
    }

    suspend fun linkEntryToCatalog(catalogId: String, entryId: String): Boolean {
        val response = api.linkEntry(catalogId, entryId)
        return response.isSuccessful
    }

    suspend fun getCatalogById(catalogId: String): com.cpen321.usermanagement.data.model.CatalogData? {
        val response = api.getCatalog(catalogId)
        return response.body()?.data
    }

    suspend fun deleteCatalog(catalogId: String): Boolean {
        return try {
            val response = api.deleteCatalog(catalogId)
            response.isSuccessful
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

}
