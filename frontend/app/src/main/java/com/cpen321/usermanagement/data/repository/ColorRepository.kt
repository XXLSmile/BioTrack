package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.remote.api.ColorApiInterface
import com.cpen321.usermanagement.data.remote.dto.ColorApiRequest
import javax.inject.Inject

class ColorRepository @Inject constructor(
    private val colorApiInterface: ColorApiInterface
) {
    suspend fun getRandomThemeColors(): List<List<Int>> {
        val request = ColorApiRequest(model = "ui")
        return colorApiInterface.getThemeColors(request).result
    }
}
