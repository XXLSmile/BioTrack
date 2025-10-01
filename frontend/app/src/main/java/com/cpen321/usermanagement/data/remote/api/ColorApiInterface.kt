package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.data.remote.dto.ColorApiRequest
import com.cpen321.usermanagement.data.remote.dto.ColorApiResponse
import retrofit2.http.Body
import retrofit2.http.POST

interface ColorApiInterface {
    @POST("api/")
    suspend fun getThemeColors(@Body body: ColorApiRequest): ColorApiResponse
}
