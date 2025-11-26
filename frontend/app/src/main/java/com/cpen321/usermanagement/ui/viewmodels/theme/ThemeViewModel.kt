package com.cpen321.usermanagement.ui.viewmodels.theme

import android.util.Log
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.repository.ColorRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.IOException
import javax.inject.Inject
import retrofit2.HttpException

@HiltViewModel
class ThemeViewModel @Inject constructor(
    private val colorRepository: ColorRepository
) : ViewModel() {

    private val _themeColors = MutableStateFlow<List<Color>>(emptyList())
    val themeColors: StateFlow<List<Color>> = _themeColors

    fun getRandomThemeColors() {
        viewModelScope.launch {
            try {
                val colors = colorRepository.getRandomThemeColors()
                Log.d("Theme", "Colors from API: $colors")
                _themeColors.value = colors.map { Color(it[0], it[1], it[2]) }
            } catch (e: IOException) {
                Log.e("Theme", "Network error getting theme colors", e)
            } catch (e: HttpException) {
                Log.e("Theme", "HTTP error getting theme colors: ${e.code()}", e)
            }
        }
    }
}
