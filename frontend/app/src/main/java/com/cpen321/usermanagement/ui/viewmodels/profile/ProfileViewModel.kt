package com.cpen321.usermanagement.ui.viewmodels.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.data.remote.dto.UserStatsData
import com.cpen321.usermanagement.data.repository.ProfileRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UsernameAvailabilityResult(
    val isAvailable: Boolean,
    val message: String
)

data class ProfileUiState(
    val isLoadingProfile: Boolean = false,
    val isSavingProfile: Boolean = false,
    val isLoadingStats: Boolean = false,
    val isCheckingUsername: Boolean = false,
    val user: User? = null,
    val stats: UserStatsData? = null,
    val usernameResult: UsernameAvailabilityResult? = null,
    val errorMessage: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val profileRepository: ProfileRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoadingProfile = true,
                errorMessage = null,
                successMessage = null
            )

            val profileResult = profileRepository.getProfile()

            if (profileResult.isSuccess) {
                val user = profileResult.getOrNull()!!
                _uiState.value = _uiState.value.copy(
                    isLoadingProfile = false,
                    user = user
                )
                refreshStats()
            } else {
                val error = profileResult.exceptionOrNull()
                _uiState.value = _uiState.value.copy(
                    isLoadingProfile = false,
                    errorMessage = error?.message ?: "Failed to load profile"
                )
            }
        }
    }

    fun refreshStats() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingStats = true)

            val statsResult = profileRepository.getUserStats()
            if (statsResult.isSuccess) {
                _uiState.value = _uiState.value.copy(
                    isLoadingStats = false,
                    stats = statsResult.getOrNull()
                )
            } else {
                val error = statsResult.exceptionOrNull()
                _uiState.value = _uiState.value.copy(
                    isLoadingStats = false,
                    errorMessage = error?.message ?: "Failed to load user stats"
                )
            }
        }
    }

    fun updateProfile(
        name: String?,
        username: String?,
        location: String?,
        region: String?,
        isPublicProfile: Boolean,
        favoriteSpecies: List<String>,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isSavingProfile = true,
                errorMessage = null,
                successMessage = null
            )

            val result = profileRepository.updateProfile(
                name = name,
                username = username,
                location = location,
                region = region,
                isPublicProfile = isPublicProfile,
                favoriteSpecies = favoriteSpecies
            )

            if (result.isSuccess) {
                _uiState.value = _uiState.value.copy(
                    isSavingProfile = false,
                    user = result.getOrNull(),
                    successMessage = "Profile updated successfully!",
                    usernameResult = null
                )
                refreshStats()
                onSuccess()
            } else {
                val error = result.exceptionOrNull()
                _uiState.value = _uiState.value.copy(
                    isSavingProfile = false,
                    errorMessage = error?.message ?: "Failed to update profile"
                )
            }
        }
    }

    fun checkUsernameAvailability(username: String) {
        if (username.isBlank()) {
            _uiState.value = _uiState.value.copy(
                usernameResult = null,
                isCheckingUsername = false
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isCheckingUsername = true,
                usernameResult = null,
                errorMessage = null
            )

            val result = profileRepository.checkUsernameAvailability(username)
            if (result.isSuccess) {
                val response = result.getOrNull()!!
                _uiState.value = _uiState.value.copy(
                    isCheckingUsername = false,
                    usernameResult = UsernameAvailabilityResult(
                        isAvailable = response.available,
                        message = response.message
                    )
                )
            } else {
                val error = result.exceptionOrNull()
                _uiState.value = _uiState.value.copy(
                    isCheckingUsername = false,
                    errorMessage = error?.message ?: "Failed to check username"
                )
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(errorMessage = null)
    }

    fun clearSuccessMessage() {
        _uiState.value = _uiState.value.copy(successMessage = null)
    }

    fun clearUsernameResult() {
        _uiState.value = _uiState.value.copy(usernameResult = null)
    }
}
