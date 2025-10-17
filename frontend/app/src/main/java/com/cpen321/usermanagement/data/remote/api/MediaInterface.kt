package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface MediaInterface {

    // Upload image for identification
    @Multipart
    @POST("/api/media/upload")
    suspend fun uploadImage(
        @Part image: MultipartBody.Part
    ): Response<ScanResponse>

    // (Optional) delete endpoint if needed
    @DELETE("/api/media/{mediaId}")
    suspend fun deleteImage(
        @Path("mediaId") mediaId: String
    ): Response<Unit>
}
