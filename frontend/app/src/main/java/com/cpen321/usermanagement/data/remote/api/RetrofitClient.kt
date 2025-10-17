package com.cpen321.usermanagement.data.remote.api

import com.cpen321.usermanagement.BuildConfig
import com.cpen321.usermanagement.data.remote.interceptors.AuthInterceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private const val BASE_URL = BuildConfig.API_BASE_URL
    private const val IMAGE_BASE_URL = BuildConfig.IMAGE_BASE_URL
    private const val COLOR_API_BASE_URL = "http://colormind.io/"

    private var authToken: String? = null

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val authInterceptor = AuthInterceptor { authToken }

    private val httpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val colorApiHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(httpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    private val colorApiRetrofit = Retrofit.Builder()
        .baseUrl(COLOR_API_BASE_URL)
        .client(colorApiHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val authInterface: AuthInterface = retrofit.create(AuthInterface::class.java)
    val imageInterface: ImageInterface = retrofit.create(ImageInterface::class.java)
    val userInterface: UserInterface = retrofit.create(UserInterface::class.java)
    val hobbyInterface: HobbyInterface = retrofit.create(HobbyInterface::class.java)
    val colorApiInterface: ColorApiInterface = colorApiRetrofit.create(ColorApiInterface::class.java)


    fun setAuthToken(token: String?) {
        authToken = token
    }

    fun getPictureUri(picturePath: String): String {
        return if (picturePath.startsWith("uploads/")) {
            IMAGE_BASE_URL + picturePath
        } else {
            picturePath
        }
    }

    val mediaApi: MediaInterface by lazy {
        retrofit.create(MediaInterface::class.java)
    }

}