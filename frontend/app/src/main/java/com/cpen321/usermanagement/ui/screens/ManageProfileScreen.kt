package com.cpen321.usermanagement.ui.screens

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.ui.viewmodels.ProfileUiState
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel

internal data class ProfileFormState(
    val name: String = "",
    val email: String = "",
    val username: String = "",
    val location: String = "",
    val region: String = "",
    val isPublicProfile: Boolean = true,
    val favoriteSpecies: List<String> = emptyList(),
    val newFavoriteSpecies: String = "",
    val originalName: String = "",
    val originalUsername: String = "",
    val originalLocation: String = "",
    val originalRegion: String = "",
    val originalIsPublic: Boolean = true,
    val originalFavoriteSpecies: List<String> = emptyList()
) {
    fun hasChanges(): Boolean {
        return name != originalName ||
            username != originalUsername ||
            location != originalLocation ||
            region != originalRegion ||
            isPublicProfile != originalIsPublic ||
            favoriteSpecies != originalFavoriteSpecies
    }
}

@Composable
fun ManageProfileScreen(
    profileViewModel: ProfileViewModel,
    onBackClick: () -> Unit
) {
    val uiState by profileViewModel.uiState.collectAsState()
    val snackBarHostState = remember { SnackbarHostState() }

    var formState by remember { mutableStateOf(ProfileFormState()) }

    LaunchedEffect(Unit) {
        if (uiState.user == null) {
            profileViewModel.loadProfile()
        }
        profileViewModel.clearSuccessMessage()
        profileViewModel.clearError()
        profileViewModel.clearUsernameResult()
    }

    LaunchedEffect(uiState.user) {
        uiState.user?.let { user ->
            formState = formState.populateFromUser(user)
        }
    }

    val formActions = remember(profileViewModel, onBackClick) {
        ManageProfileFormActions(
            onFormChange = { formState = it },
            onCheckUsername = profileViewModel::checkUsernameAvailability,
            onClearUsernameResult = profileViewModel::clearUsernameResult,
            onSaveProfile = { updatedState ->
                profileViewModel.updateProfile(
                    name = updatedState.name,
                    username = updatedState.username,
                    location = updatedState.location.ifBlank { null },
                    region = updatedState.region.ifBlank { null },
                    isPublicProfile = updatedState.isPublicProfile,
                    favoriteSpecies = updatedState.favoriteSpecies,
                    onSuccess = onBackClick
                )
            }
        )
    }
    val screenActions = remember(formActions, onBackClick) {
        ManageProfileActions(
            formActions = formActions,
            onBackClick = onBackClick,
            onSuccessMessageShown = profileViewModel::clearSuccessMessage,
            onErrorMessageShown = profileViewModel::clearError
        )
    }

    ManageProfileContent(
        uiState = uiState,
        formState = formState,
        snackBarHostState = snackBarHostState,
        actions = screenActions
    )
}

private fun ProfileFormState.populateFromUser(user: User): ProfileFormState {
    return copy(
        name = user.name,
        email = user.email,
        username = user.username,
        location = user.location.orEmpty(),
        region = user.region.orEmpty(),
        isPublicProfile = user.isPublicProfile,
        favoriteSpecies = user.favoriteSpecies,
        newFavoriteSpecies = "",
        originalName = user.name,
        originalUsername = user.username,
        originalLocation = user.location.orEmpty(),
        originalRegion = user.region.orEmpty(),
        originalIsPublic = user.isPublicProfile,
        originalFavoriteSpecies = user.favoriteSpecies
    )
}
