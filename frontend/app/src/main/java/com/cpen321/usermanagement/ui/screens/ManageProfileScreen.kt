package com.cpen321.usermanagement.ui.screens

import Button
import Icon
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.ui.components.MessageSnackbar
import com.cpen321.usermanagement.ui.components.MessageSnackbarState
import com.cpen321.usermanagement.ui.theme.LocalSpacing
import com.cpen321.usermanagement.ui.viewmodels.ProfileUiState
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel

private data class ProfileFormState(
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

    ManageProfileContent(
        uiState = uiState,
        formState = formState,
        snackBarHostState = snackBarHostState,
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
        },
        onBackClick = onBackClick,
        onSuccessMessageShown = profileViewModel::clearSuccessMessage,
        onErrorMessageShown = profileViewModel::clearError
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManageProfileContent(
    uiState: ProfileUiState,
    formState: ProfileFormState,
    snackBarHostState: SnackbarHostState,
    onFormChange: (ProfileFormState) -> Unit,
    onCheckUsername: (String) -> Unit,
    onClearUsernameResult: () -> Unit,
    onSaveProfile: (ProfileFormState) -> Unit,
    onBackClick: () -> Unit,
    onSuccessMessageShown: () -> Unit,
    onErrorMessageShown: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            ManageProfileTopBar(onBackClick = onBackClick)
        },
        snackbarHost = {
            MessageSnackbar(
                hostState = snackBarHostState,
                messageState = MessageSnackbarState(
                    successMessage = uiState.successMessage,
                    errorMessage = uiState.errorMessage,
                    onSuccessMessageShown = onSuccessMessageShown,
                    onErrorMessageShown = onErrorMessageShown
                )
            )
        }
    ) { paddingValues ->
        ManageProfileBody(
            paddingValues = paddingValues,
            uiState = uiState,
            formState = formState,
            onFormChange = onFormChange,
            onCheckUsername = onCheckUsername,
            onClearUsernameResult = onClearUsernameResult,
            onSaveProfile = onSaveProfile
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManageProfileTopBar(
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    TopAppBar(
        modifier = modifier,
        title = {
            Text(
                text = stringResource(R.string.manage_profile),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Medium
            )
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(name = R.drawable.ic_arrow_back)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

@Composable
private fun ManageProfileBody(
    paddingValues: PaddingValues,
    uiState: ProfileUiState,
    formState: ProfileFormState,
    onFormChange: (ProfileFormState) -> Unit,
    onCheckUsername: (String) -> Unit,
    onClearUsernameResult: () -> Unit,
    onSaveProfile: (ProfileFormState) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(paddingValues)
    ) {
        when {
            uiState.isLoadingProfile -> {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }

            uiState.user != null -> {
                ProfileFormContent(
                    formState = formState,
                    uiState = uiState,
                    onFormChange = onFormChange,
                    onCheckUsername = onCheckUsername,
                    onClearUsernameResult = onClearUsernameResult,
                    onSaveProfile = onSaveProfile,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(spacing.large)
                )
            }

            else -> {
                Text(
                    text = stringResource(R.string.profile_failed_to_load),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        }
    }
}

@Composable
private fun ProfileFormContent(
    formState: ProfileFormState,
    uiState: ProfileUiState,
    onFormChange: (ProfileFormState) -> Unit,
    onCheckUsername: (String) -> Unit,
    onClearUsernameResult: () -> Unit,
    onSaveProfile: (ProfileFormState) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    LazyColumn(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(spacing.large)
    ) {
        item {
            ProfileInfoCard(
                formState = formState,
                onFormChange = onFormChange,
                uiState = uiState,
                onCheckUsername = onCheckUsername,
                onClearUsernameResult = onClearUsernameResult
            )
        }

        item {
            FavoriteSpeciesEditor(
                formState = formState,
                onFormChange = onFormChange
            )
        }

        item {
            SaveProfileButton(
                enabled = formState.hasChanges() && !uiState.isSavingProfile,
                isSaving = uiState.isSavingProfile,
                onClick = { onSaveProfile(formState) }
            )
        }
    }
}

@Composable
private fun ProfileInfoCard(
    formState: ProfileFormState,
    onFormChange: (ProfileFormState) -> Unit,
    uiState: ProfileUiState,
    onCheckUsername: (String) -> Unit,
    onClearUsernameResult: () -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current
    val usernameResult = uiState.usernameResult

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier.padding(spacing.large),
            verticalArrangement = Arrangement.spacedBy(spacing.medium)
        ) {
            Text(
                text = stringResource(R.string.manage_profile_details_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            OutlinedTextField(
                value = formState.name,
                onValueChange = { onFormChange(formState.copy(name = it)) },
                label = { Text(stringResource(R.string.profile_field_name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = formState.email,
                onValueChange = {},
                enabled = false,
                label = { Text(stringResource(R.string.profile_field_email)) },
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = formState.username,
                onValueChange = {
                    onFormChange(formState.copy(username = it))
                    onClearUsernameResult()
                },
                label = { Text(stringResource(R.string.profile_field_username)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(spacing.medium),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    fullWidth = false,
                    onClick = { onCheckUsername(formState.username) },
                    enabled = formState.username.isNotBlank() && !uiState.isCheckingUsername
                ) {
                    if (uiState.isCheckingUsername) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text(stringResource(R.string.profile_check_username))
                    }
                }

                usernameResult?.let {
                    val color = if (it.isAvailable) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    }

                    Text(
                        text = it.message,
                        color = color,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            OutlinedTextField(
                value = formState.location,
                onValueChange = { onFormChange(formState.copy(location = it)) },
                label = { Text(stringResource(R.string.profile_field_location)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = formState.region,
                onValueChange = { onFormChange(formState.copy(region = it)) },
                label = { Text(stringResource(R.string.profile_field_region)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            PrivacyToggle(
                isPublic = formState.isPublicProfile,
                onValueChange = { onFormChange(formState.copy(isPublicProfile = it)) }
            )
        }
    }
}

@Composable
private fun PrivacyToggle(isPublic: Boolean, onValueChange: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    val spacing = LocalSpacing.current

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.medium),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.profile_privacy_title),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = stringResource(R.string.profile_privacy_subtitle),
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Switch(
                checked = isPublic,
                onCheckedChange = onValueChange,
                colors = SwitchDefaults.colors()
            )
        }
    }
}

@Composable
private fun FavoriteSpeciesEditor(
    formState: ProfileFormState,
    onFormChange: (ProfileFormState) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier.padding(spacing.large),
            verticalArrangement = Arrangement.spacedBy(spacing.medium)
        ) {
            Text(
                text = stringResource(R.string.profile_favorites_heading),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(spacing.medium),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = formState.newFavoriteSpecies,
                    onValueChange = { onFormChange(formState.copy(newFavoriteSpecies = it)) },
                    label = { Text(stringResource(R.string.profile_add_favorite_placeholder)) },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )

                Button(
                    fullWidth = false,
                    onClick = {
                        val trimmed = formState.newFavoriteSpecies.trim()
                        if (trimmed.isNotEmpty() && !formState.favoriteSpecies.contains(trimmed, ignoreCase = true)) {
                            onFormChange(
                                formState.copy(
                                    favoriteSpecies = formState.favoriteSpecies + trimmed,
                                    newFavoriteSpecies = ""
                                )
                            )
                        }
                    },
                    enabled = formState.newFavoriteSpecies.isNotBlank()
                ) {
                    Text(stringResource(R.string.profile_add_favorite_action))
                }
            }

            if (formState.favoriteSpecies.isEmpty()) {
                Text(
                    text = stringResource(R.string.profile_no_favorites),
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(spacing.small)) {
                    formState.favoriteSpecies.forEach { species ->
                        FavoriteSpeciesItem(
                            species = species,
                            onRemove = {
                                onFormChange(
                                    formState.copy(
                                        favoriteSpecies = formState.favoriteSpecies.filterNot { it.equals(species, ignoreCase = true) }
                                    )
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

private fun List<String>.contains(value: String, ignoreCase: Boolean): Boolean {
    return any { it.equals(value, ignoreCase = ignoreCase) }
}

@Composable
private fun FavoriteSpeciesItem(species: String, onRemove: () -> Unit, modifier: Modifier = Modifier) {
    val spacing = LocalSpacing.current

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .padding(spacing.medium),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = species,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )

        Button(
            fullWidth = false,
            type = "secondary",
            onClick = onRemove
        ) {
            Text(stringResource(R.string.profile_remove_favorite_action))
        }
    }
}

@Composable
private fun SaveProfileButton(enabled: Boolean, isSaving: Boolean, onClick: () -> Unit) {
    Button(
        fullWidth = true,
        onClick = onClick,
        enabled = enabled
    ) {
        if (isSaving) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
        } else {
            Text(text = stringResource(R.string.profile_save_changes))
        }
    }
}
