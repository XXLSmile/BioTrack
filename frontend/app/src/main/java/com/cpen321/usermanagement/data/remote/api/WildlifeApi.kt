package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface WildlifeApi {
    @Multipart
    @POST("recognition")
    suspend fun recognizeAnimal(
        @Part image: MultipartBody.Part
    ): Response<ScanResponse>
}
