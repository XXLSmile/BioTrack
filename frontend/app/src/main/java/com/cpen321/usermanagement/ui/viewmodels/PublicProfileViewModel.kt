package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.remote.dto.PublicUserProfile
import com.cpen321.usermanagement.data.repository.FriendRepository
import com.cpen321.usermanagement.data.repository.PrivateProfileException
import com.cpen321.usermanagement.data.repository.UserNotFoundException
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PublicProfileUiState(
    val isLoading: Boolean = false,
    val profile: PublicUserProfile? = null,
    val isPrivate: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class PublicProfileViewModel @Inject constructor(
    private val friendRepository: FriendRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PublicProfileUiState())
    val uiState: StateFlow<PublicProfileUiState> = _uiState.asStateFlow()

    fun loadProfile(username: String) {
        if (username.isBlank()) {
            _uiState.update {
                it.copy(
                    isLoading = false,
                    profile = null,
                    isPrivate = false,
                    errorMessage = "Username is missing"
                )
            }
            return
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    errorMessage = null,
                    isPrivate = false
                )
            }

            friendRepository.fetchPublicProfile(username)
                .onSuccess { profile ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            profile = profile,
                            isPrivate = false,
                            errorMessage = null
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        when (error) {
                            is PrivateProfileException -> it.copy(
                                isLoading = false,
                                profile = null,
                                isPrivate = true,
                                errorMessage = error.message
                            )

                            is UserNotFoundException -> it.copy(
                                isLoading = false,
                                profile = null,
                                isPrivate = false,
                                errorMessage = error.message ?: "User not found"
                            )

                            else -> it.copy(
                                isLoading = false,
                                profile = null,
                                isPrivate = false,
                                errorMessage = error.localizedMessage ?: "Failed to load profile"
                            )
                        }
                    }
                }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }
}
