package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface CatalogApi {

    @GET("catalogs")
    suspend fun listCatalogs(): Response<CatalogListResponse>

    @POST("catalogs")
    suspend fun createCatalog(@Body request: Map<String, String>): Response<CatalogResponse>

    @GET("catalogs/{id}")
    suspend fun getCatalog(@Path("id") id: String): Response<CatalogResponse>

    @POST("catalogs/{catalogId}/entries/{entryId}")
    suspend fun linkEntry(
        @Path("catalogId") catalogId: String,
        @Path("entryId") entryId: String
    ): Response<CatalogResponse>

    @DELETE("catalog/{catalogId}")
    suspend fun deleteCatalog(@Path("catalogId") catalogId: String): Response<Unit>

}
