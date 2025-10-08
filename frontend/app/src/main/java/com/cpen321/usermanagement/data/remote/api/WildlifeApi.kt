package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.WildlifeResponse
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

interface WildlifeApi {

    @Multipart
    @POST("animal")
    suspend fun identifyAnimal(
        @Part image: MultipartBody.Part,
        @Header("x-rapidapi-key") apiKey: String = "YOUR_RAPIDAPI_KEY",
        @Header("x-rapidapi-host") host: String = "animal-recognition2.p.rapidapi.com"
    ): Response<WildlifeResponse>
}
