package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.ApiResponse
import com.cpen321.usermanagement.data.remote.dto.EntryRecognitionUpdateDto
import com.cpen321.usermanagement.data.remote.dto.RecentEntriesResponse
import com.cpen321.usermanagement.data.remote.dto.SavedEntryResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Multipart
import retrofit2.http.Part

interface RecognitionApi {
    @GET("recognition/recent")
    suspend fun getRecentEntries(
        @Query("limit") limit: Int = 10
    ): Response<ApiResponse<RecentEntriesResponse>>

    @GET("recognition/catalog")
    suspend fun getCatalogEntries(): Response<ApiResponse<RecentEntriesResponse>>

    @DELETE("recognition/entry/{entryId}")
    suspend fun deleteEntry(
        @Path("entryId") entryId: String
    ): Response<ApiResponse<Unit>>

    @POST("recognition/entry/{entryId}/rerun")
    suspend fun rerunEntryRecognition(
        @Path("entryId") entryId: String
    ): Response<ApiResponse<EntryRecognitionUpdateDto>>

    @Multipart
    @POST("recognition/entry")
    suspend fun saveImageEntry(
        @Part image: MultipartBody.Part,
        @Part("latitude") latitude: Double? = null,
        @Part("longitude") longitude: Double? = null,
        @Part("notes") notes: RequestBody? = null
    ): Response<ApiResponse<SavedEntryResponse>>
}
