package com.cpen321.usermanagement.data.remote.dto

data class PublicProfileData(
    val user: PublicUserProfile?
)

data class PublicUserProfile(
    val _id: String,
    val name: String?,
    val username: String?,
    val profilePicture: String?,
    val location: String?,
    val region: String?,
    val observationCount: Int?,
    val speciesDiscovered: Int?,
    val badges: List<String> = emptyList(),
    val friendCount: Int?,
    val createdAt: String?,
    val favoriteSpecies: List<String>? = emptyList()
)
