package com.cpen321.usermanagement.di

import com.cpen321.usermanagement.BuildConfig
import com.cpen321.usermanagement.data.remote.api.*
import com.cpen321.usermanagement.data.repository.CatalogRepository
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
    @Provides @Singleton fun provideMediaService(): ImageInterface = RetrofitClient.imageInterface
    @Provides @Singleton fun provideMediaApiService(): MediaInterface = RetrofitClient.mediaApi
    @Provides @Singleton fun provideHobbyService(): HobbyInterface = RetrofitClient.hobbyInterface
    @Provides @Singleton fun provideColorApiService(): ColorApiInterface = RetrofitClient.colorApiInterface
    @Provides @Singleton fun provideWildlifeService(): WildlifeApi = RetrofitClient.wildlifeApi

    // For catalog
    @Provides
    @Singleton
    fun provideCatalogApi(retrofit: Retrofit): CatalogApi =
        retrofit.create(CatalogApi::class.java)

    @Provides
    @Singleton
    fun provideCatalogRepository(api: CatalogApi): CatalogRepository =
        CatalogRepository(api)
}
