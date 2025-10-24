package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.data.repository.RecognitionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CatalogEntriesUiState(
    val entries: List<RecentObservation> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class CatalogEntriesViewModel @Inject constructor(
    private val recognitionRepository: RecognitionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CatalogEntriesUiState(isLoading = true))
    val uiState: StateFlow<CatalogEntriesUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            recognitionRepository.fetchAllCatalogEntries()
                .onSuccess { observations ->
                    _uiState.update {
                        it.copy(
                            entries = observations,
                            isLoading = false,
                            errorMessage = null
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.localizedMessage
                                ?: "Failed to load catalog entries"
                        )
                    }
                }
        }
    }
}
