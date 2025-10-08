package com.cpen321.usermanagement.data.remote.dto

import com.google.gson.annotations.SerializedName

data class WildlifeResponse(
    @SerializedName("animal") val animal: String?,
    @SerializedName("confidence") val confidence: Float?
)
