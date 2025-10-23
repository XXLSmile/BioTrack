package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.data.repository.RecognitionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MainUiState(
    val successMessage: String? = null,
    val recentObservations: List<RecentObservation> = emptyList(),
    val isLoadingRecent: Boolean = false,
    val recentError: String? = null
)

@HiltViewModel
class MainViewModel @Inject constructor(
    private val recognitionRepository: RecognitionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MainUiState())
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        loadRecentObservations()
    }

    fun setSuccessMessage(message: String) {
        _uiState.value = _uiState.value.copy(successMessage = message)
    }

    fun clearSuccessMessage() {
        _uiState.value = _uiState.value.copy(successMessage = null)
    }

    fun loadRecentObservations(limit: Int = 5) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingRecent = true, recentError = null)
            recognitionRepository.fetchRecentObservations(limit)
                .onSuccess { observations ->
                    _uiState.value = _uiState.value.copy(
                        recentObservations = observations,
                        isLoadingRecent = false,
                        recentError = null
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoadingRecent = false,
                        recentError = error.localizedMessage ?: "Failed to load recent observations"
                    )
                }
        }
    }
}
