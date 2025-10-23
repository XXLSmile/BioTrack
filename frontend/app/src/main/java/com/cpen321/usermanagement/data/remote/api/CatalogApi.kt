package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.model.CatalogListResponse
import com.cpen321.usermanagement.data.model.CatalogResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface CatalogApi {

    @GET("catalogs")
    suspend fun listCatalogs(): Response<CatalogListResponse>

    @POST("catalogs")
    suspend fun createCatalog(@Body request: Map<String, String>): Response<CatalogResponse>

    @GET("catalogs/{catalogId}")
    suspend fun getCatalog(@Path("catalogId") catalogId: String): Response<CatalogResponse>

    @POST("catalogs/{catalogId}/entries/{entryId}")
    suspend fun linkEntry(
        @Path("catalogId") catalogId: String,
        @Path("entryId") entryId: String
    ): Response<CatalogResponse>

    @DELETE("catalogs/{catalogId}")
    suspend fun deleteCatalog(@Path("catalogId") catalogId: String): Response<Unit>

}
