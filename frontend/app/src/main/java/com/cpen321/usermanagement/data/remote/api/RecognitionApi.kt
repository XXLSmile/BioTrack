package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.ApiResponse
import com.cpen321.usermanagement.data.remote.dto.RecentEntriesResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface RecognitionApi {
    @GET("recognition/recent")
    suspend fun getRecentEntries(
        @Query("limit") limit: Int = 10
    ): Response<ApiResponse<RecentEntriesResponse>>

    @GET("recognition/catalog")
    suspend fun getCatalogEntries(): Response<ApiResponse<RecentEntriesResponse>>
}
