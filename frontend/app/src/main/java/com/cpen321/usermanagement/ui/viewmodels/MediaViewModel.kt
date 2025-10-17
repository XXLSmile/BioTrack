package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import com.cpen321.usermanagement.data.repository.MediaRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

@HiltViewModel
class MediaViewModel @Inject constructor(
    private val mediaRepository: MediaRepository
) : ViewModel() {

    private val _scanState = MutableStateFlow<ScanState>(ScanState.Idle)
    val scanState: StateFlow<ScanState> = _scanState

    fun uploadAndIdentify(file: File) {
        viewModelScope.launch {
            _scanState.value = ScanState.Loading
            val result = mediaRepository.uploadAndIdentify(file)
            _scanState.value = result.fold(
                onSuccess = { ScanState.Success(it) },
                onFailure = { ScanState.Error(it.message ?: "Unknown error") }
            )
        }
    }

    fun resetState() {
        _scanState.value = ScanState.Idle
    }
}

sealed class ScanState {
    object Idle : ScanState()
    object Loading : ScanState()
    data class Success(val result: ScanResponse) : ScanState()
    data class Error(val message: String) : ScanState()
}
