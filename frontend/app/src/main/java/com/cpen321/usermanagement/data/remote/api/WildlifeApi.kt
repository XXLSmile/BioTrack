package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.WildlifeResponse
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface WildlifeApi {

    @Multipart
    @POST("detect-label")
    suspend fun recognizeAnimal(
        @Part image: MultipartBody.Part,
        @Header("x-rapidapi-key") apiKey: String = "b8b295a1e9msh04198519f49ce85p198b00jsn5742e43e1cfe",
        @Header("x-rapidapi-host") host: String = "label-image.p.rapidapi.com"
    ): Response<WildlifeResponse>
}
