package com.cpen321.usermanagement.di

import com.cpen321.usermanagement.data.remote.api.AuthInterface
import com.cpen321.usermanagement.data.remote.api.CatalogApi
import com.cpen321.usermanagement.data.remote.api.ColorApiInterface
import com.cpen321.usermanagement.data.remote.api.FriendApi
import com.cpen321.usermanagement.data.remote.api.MediaInterface
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.data.remote.api.UserInterface
import com.cpen321.usermanagement.data.remote.api.WildlifeApi
import com.cpen321.usermanagement.data.repository.CatalogRepository
import com.cpen321.usermanagement.data.repository.FriendRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    // Existing services (if they depend on RetrofitClient)
    @Provides @Singleton fun provideAuthService(): AuthInterface = RetrofitClient.authInterface
    @Provides @Singleton fun provideUserService(): UserInterface = RetrofitClient.userInterface
    @Provides @Singleton fun provideMediaApiService(): MediaInterface = RetrofitClient.mediaApi
    @Provides @Singleton fun provideColorApiService(): ColorApiInterface = RetrofitClient.colorApiInterface
    @Provides @Singleton fun provideWildlifeService(): WildlifeApi = RetrofitClient.wildlifeApi
    @Provides @Singleton fun provideFriendApi(): FriendApi = RetrofitClient.friendApi

    // For catalog
    @Provides
    @Singleton
    fun provideCatalogApi(): CatalogApi = RetrofitClient.catalogApi

    @Provides
    @Singleton
    fun provideCatalogRepository(api: CatalogApi): CatalogRepository =
        CatalogRepository(api)

    @Provides
    @Singleton
    fun provideFriendRepository(api: FriendApi, userInterface: UserInterface): FriendRepository =
        FriendRepository(api, userInterface)
}
