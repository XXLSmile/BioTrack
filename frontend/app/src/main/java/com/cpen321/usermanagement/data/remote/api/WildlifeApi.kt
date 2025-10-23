package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.RecognizeAndSaveResponse
import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
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

    @Multipart
    @POST("recognition/save")
    suspend fun recognizeAndSave(
        @Part image: MultipartBody.Part,
        @Part("catalogId") catalogId: RequestBody?
    ): Response<RecognizeAndSaveResponse>
}
