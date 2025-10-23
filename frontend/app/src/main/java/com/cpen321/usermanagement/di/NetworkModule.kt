package com.cpen321.usermanagement.di

import com.cpen321.usermanagement.BuildConfig
import com.cpen321.usermanagement.data.remote.api.AuthInterface
import com.cpen321.usermanagement.data.remote.api.CatalogApi
import com.cpen321.usermanagement.data.remote.api.ColorApiInterface
import com.cpen321.usermanagement.data.remote.api.FriendApi
import com.cpen321.usermanagement.data.remote.api.MediaInterface
import com.cpen321.usermanagement.data.remote.api.RecognitionApi
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.data.remote.api.UserInterface
import com.cpen321.usermanagement.data.remote.api.WildlifeApi
import com.cpen321.usermanagement.data.repository.CatalogRepository
import com.cpen321.usermanagement.data.repository.FriendRepository
import com.cpen321.usermanagement.data.repository.RecognitionRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient =
        OkHttpClient.Builder().build()

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

    // Existing services (if they depend on RetrofitClient)
    @Provides @Singleton fun provideAuthService(): AuthInterface = RetrofitClient.authInterface
    @Provides @Singleton fun provideUserService(): UserInterface = RetrofitClient.userInterface
    @Provides @Singleton fun provideMediaApiService(): MediaInterface = RetrofitClient.mediaApi
    @Provides @Singleton fun provideColorApiService(): ColorApiInterface = RetrofitClient.colorApiInterface
    @Provides @Singleton fun provideWildlifeService(): WildlifeApi = RetrofitClient.wildlifeApi
    @Provides @Singleton fun provideFriendApi(): FriendApi = RetrofitClient.friendApi
    @Provides @Singleton fun provideRecognitionApi(): RecognitionApi = RetrofitClient.recognitionApi

    // For catalog
    @Provides
    @Singleton
    fun provideCatalogApi(retrofit: Retrofit): CatalogApi =
        retrofit.create(CatalogApi::class.java)

    @Provides
    @Singleton
    fun provideCatalogRepository(api: CatalogApi): CatalogRepository =
        CatalogRepository(api)

    @Provides
    @Singleton
    fun provideFriendRepository(api: FriendApi, userInterface: UserInterface): FriendRepository =
        FriendRepository(api, userInterface)

    @Provides
    @Singleton
    fun provideRecognitionRepository(api: RecognitionApi): RecognitionRepository =
        RecognitionRepository(api)
}
