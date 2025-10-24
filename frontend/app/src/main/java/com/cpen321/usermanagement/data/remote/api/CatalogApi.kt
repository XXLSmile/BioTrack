package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.model.CatalogCollaboratorsResponse
import com.cpen321.usermanagement.data.model.CatalogListResponse
import com.cpen321.usermanagement.data.model.CatalogResponse
import com.cpen321.usermanagement.data.model.CatalogShareWrapper
import com.cpen321.usermanagement.data.model.CatalogSharesResponse
import com.cpen321.usermanagement.data.model.InviteCollaboratorBody
import com.cpen321.usermanagement.data.model.RespondInvitationBody
import com.cpen321.usermanagement.data.model.UpdateCollaboratorBody
import com.cpen321.usermanagement.data.remote.dto.ApiResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
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

    @DELETE("catalogs/{catalogId}/entries/{entryId}")
    suspend fun unlinkEntry(
        @Path("catalogId") catalogId: String,
        @Path("entryId") entryId: String
    ): Response<CatalogResponse>

    @GET("catalogs/{catalogId}/share")
    suspend fun listCollaborators(
        @Path("catalogId") catalogId: String
    ): Response<ApiResponse<CatalogCollaboratorsResponse>>

    @POST("catalogs/{catalogId}/share")
    suspend fun inviteCollaborator(
        @Path("catalogId") catalogId: String,
        @Body body: InviteCollaboratorBody
    ): Response<ApiResponse<CatalogShareWrapper>>

    @PATCH("catalogs/{catalogId}/share/{shareId}")
    suspend fun updateCollaborator(
        @Path("catalogId") catalogId: String,
        @Path("shareId") shareId: String,
        @Body body: UpdateCollaboratorBody
    ): Response<ApiResponse<CatalogShareWrapper>>

    @GET("catalogs/shared-with/me")
    suspend fun listSharedWithMe(): Response<ApiResponse<CatalogSharesResponse>>

    @GET("catalogs/share/pending")
    suspend fun listPendingInvitations(): Response<ApiResponse<CatalogSharesResponse>>

    @PATCH("catalogs/share/{shareId}/respond")
    suspend fun respondToInvitation(
        @Path("shareId") shareId: String,
        @Body body: RespondInvitationBody
    ): Response<ApiResponse<CatalogShareWrapper>>

    @DELETE("catalogs/{catalogId}")
    suspend fun deleteCatalog(@Path("catalogId") catalogId: String): Response<Unit>

}
