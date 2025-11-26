package com.cpen321.usermanagement.ui.screens.profile

import Button
import MenuButtonItem
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Pets
import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon as M3Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.graphics.vector.ImageVector
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.data.remote.dto.UserStatsData
import com.cpen321.usermanagement.ui.components.MessageSnackbar
import com.cpen321.usermanagement.ui.components.MessageSnackbarState
import com.cpen321.usermanagement.ui.theme.LocalSpacing
import com.cpen321.usermanagement.ui.viewmodels.auth.AuthViewModel
import com.cpen321.usermanagement.ui.viewmodels.profile.ProfileUiState
import com.cpen321.usermanagement.ui.viewmodels.profile.ProfileViewModel

private data class ProfileDialogState(
    val showDeleteDialog: Boolean = false
)

data class ProfileScreenActions(
    val onManageProfileClick: () -> Unit,
    val onAccountDeleted: () -> Unit,
    val onLogoutClick: () -> Unit
)

private data class ProfileScreenCallbacks(
    val onManageProfileClick: () -> Unit,
    val onDeleteAccountClick: () -> Unit,
    val onLogoutClick: () -> Unit,
    val onDeleteDialogDismiss: () -> Unit,
    val onDeleteDialogConfirm: () -> Unit,
    val onSuccessMessageShown: () -> Unit,
    val onErrorMessageShown: () -> Unit
)

@Composable
fun ProfileScreen(
    authViewModel: AuthViewModel,
    profileViewModel: ProfileViewModel,
    actions: ProfileScreenActions
) {
    val uiState by profileViewModel.uiState.collectAsState()
    val snackBarHostState = remember { SnackbarHostState() }

    var dialogState by remember {
        mutableStateOf(ProfileDialogState())
    }

    LaunchedEffect(Unit) {
        if (uiState.user == null) {
            profileViewModel.loadProfile()
        }
        profileViewModel.clearSuccessMessage()
        profileViewModel.clearError()
    }

    ProfileContent(
        uiState = uiState,
        dialogState = dialogState,
        snackBarHostState = snackBarHostState,
        callbacks = ProfileScreenCallbacks(
            onManageProfileClick = actions.onManageProfileClick,
            onDeleteAccountClick = {
                dialogState = dialogState.copy(showDeleteDialog = true)
            },
            onDeleteDialogDismiss = {
                dialogState = dialogState.copy(showDeleteDialog = false)
            },
            onDeleteDialogConfirm = {
                dialogState = dialogState.copy(showDeleteDialog = false)
                authViewModel.handleAccountDeletion()
                actions.onAccountDeleted()
            },
            onLogoutClick = actions.onLogoutClick,
            onSuccessMessageShown = profileViewModel::clearSuccessMessage,
            onErrorMessageShown = profileViewModel::clearError
        )
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileContent(
    uiState: ProfileUiState,
    dialogState: ProfileDialogState,
    snackBarHostState: SnackbarHostState,
    callbacks: ProfileScreenCallbacks,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        snackbarHost = {
            MessageSnackbar(
                hostState = snackBarHostState,
                messageState = MessageSnackbarState(
                    successMessage = uiState.successMessage,
                    errorMessage = uiState.errorMessage,
                    onSuccessMessageShown = callbacks.onSuccessMessageShown,
                    onErrorMessageShown = callbacks.onErrorMessageShown
                )
            )
        }
    ) { paddingValues ->
        ProfileBody(
            paddingValues = paddingValues,
            uiState = uiState,
            onManageProfileClick = callbacks.onManageProfileClick,
            onDeleteAccountClick = callbacks.onDeleteAccountClick,
            onLogoutClick = callbacks.onLogoutClick
        )
    }

    if (dialogState.showDeleteDialog) {
        DeleteAccountDialog(
            onDismiss = callbacks.onDeleteDialogDismiss,
            onConfirm = callbacks.onDeleteDialogConfirm
        )
    }
}

@Composable
private fun ProfileBody(
    paddingValues: PaddingValues,
    uiState: ProfileUiState,
    onManageProfileClick: () -> Unit,
    onDeleteAccountClick: () -> Unit,
    onLogoutClick: () -> Unit,
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
                LoadingIndicator(Modifier.align(Alignment.Center))
            }

            uiState.user != null -> {
                ProfileDetailsContent(
                    user = uiState.user,
                    isLoadingStats = uiState.isLoadingStats,
                    stats = uiState.stats,
                    onManageProfileClick = onManageProfileClick,
                    onLogoutClick = onLogoutClick,
                    onDeleteAccountClick = onDeleteAccountClick,
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
private fun ProfileDetailsContent(
    user: User,
    isLoadingStats: Boolean,
    stats: UserStatsData?,
    onManageProfileClick: () -> Unit,
    onLogoutClick: () -> Unit,
    onDeleteAccountClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier.verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(spacing.large)
    ) {
        ProfileOverviewCard(user)

        ProfileStatsCard(isLoadingStats = isLoadingStats, stats = stats, user = user)

        FavoriteSpeciesCard(favoriteSpecies = user.favoriteSpecies)

        ActionSection(
            onManageProfileClick = onManageProfileClick,
            onLogoutClick = onLogoutClick,
            onDeleteAccountClick = onDeleteAccountClick
        )
    }
}

@Composable
private fun ProfileOverviewCard(user: User, modifier: Modifier = Modifier) {
    val spacing = LocalSpacing.current

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(spacing.large), verticalArrangement = Arrangement.spacedBy(spacing.small)) {
            Text(
                text = user.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Text(text = stringResource(R.string.profile_username_format, user.username), style = MaterialTheme.typography.bodyMedium)
            Text(text = user.email, style = MaterialTheme.typography.bodyMedium)

            Spacer(modifier = Modifier.height(spacing.small))

            user.location?.takeIf { it.isNotBlank() }?.let {
                Text(text = stringResource(R.string.profile_location_format, it), style = MaterialTheme.typography.bodyMedium)
            }
            user.region?.takeIf { it.isNotBlank() }?.let {
                Text(text = stringResource(R.string.profile_region_format, it), style = MaterialTheme.typography.bodyMedium)
            }

            val privacyLabel = if (user.isPublicProfile) {
                stringResource(R.string.profile_public_label)
            } else {
                stringResource(R.string.profile_private_label)
            }

            Box(
                modifier = Modifier
                    .padding(top = spacing.small)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer)
                    .padding(horizontal = spacing.medium, vertical = spacing.extraSmall)
            ) {
                Text(
                    text = privacyLabel,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}

@Composable
private fun ProfileStatsCard(
    isLoadingStats: Boolean,
    stats: UserStatsData?,
    user: User,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(spacing.large)) {
            Text(
                text = stringResource(R.string.profile_stats_heading),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(spacing.medium))

            if (isLoadingStats) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = spacing.small),
                    horizontalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator()
                }
            } else {
                StatsRow(
                    observationCount = stats?.observationCount ?: user.observationCount,
                    friendCount = stats?.friendCount ?: user.friendCount
                )

                if (!stats?.badges.isNullOrEmpty()) {
                    Spacer(modifier = Modifier.height(spacing.medium))
                    Text(
                        text = stringResource(R.string.profile_badges_heading),
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold)
                    )

                    Spacer(modifier = Modifier.height(spacing.small))
                    BadgesRow(badges = stats?.badges ?: emptyList())
                }
            }
        }
    }
}

@Composable
private fun StatsRow(observationCount: Int, friendCount: Int, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        StatItem(
            icon = Icons.Outlined.Pets,
            title = stringResource(R.string.profile_stat_observations),
            value = observationCount
        )
        StatItem(
            icon = Icons.Outlined.Groups,
            title = stringResource(R.string.profile_stat_friends),
            value = friendCount
        )
    }
}

@Composable
private fun StatItem(
    icon: ImageVector,
    title: String,
    value: Int,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        M3Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary
        )
        Text(text = value.toString(), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(text = title, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun BadgesRow(badges: List<String>, modifier: Modifier = Modifier) {
    val spacing = LocalSpacing.current

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(spacing.extraSmall)) {
        badges.forEach { badge ->
            Text(
                text = "• $badge",
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

@Composable
private fun FavoriteSpeciesCard(favoriteSpecies: List<String>, modifier: Modifier = Modifier) {
    val spacing = LocalSpacing.current

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier.padding(spacing.large),
            verticalArrangement = Arrangement.spacedBy(spacing.small)
        ) {
            Text(
                text = stringResource(R.string.profile_favorites_heading),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            if (favoriteSpecies.isEmpty()) {
                Text(
                    text = stringResource(R.string.profile_no_favorites),
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                favoriteSpecies.forEach { species ->
                    Text(
                        text = "• $species",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionSection(
    onManageProfileClick: () -> Unit,
    onLogoutClick: () -> Unit,
    onDeleteAccountClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(spacing.medium)
    ) {
        MenuButtonItem(
            text = stringResource(R.string.manage_profile),
            iconRes = R.drawable.ic_manage_profile,
            onClick = onManageProfileClick
        )

        MenuButtonItem(
            text = stringResource(R.string.logout),
            iconRes = R.drawable.ic_logout,
            onClick = onLogoutClick
        )

        MenuButtonItem(
            text = stringResource(R.string.delete_account),
            iconRes = R.drawable.ic_delete_forever,
            onClick = onDeleteAccountClick
        )
    }
}

@Composable
private fun DeleteAccountDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier
) {
    AlertDialog(
        modifier = modifier,
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = stringResource(R.string.delete_account),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Text(text = stringResource(R.string.delete_account_confirmation))
        },
        confirmButton = {
            Button(
                fullWidth = false,
                onClick = onConfirm
            ) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            Button(
                fullWidth = false,
                type = "secondary",
                onClick = onDismiss
            ) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

@Composable
private fun LoadingIndicator(modifier: Modifier = Modifier) {
    CircularProgressIndicator(modifier = modifier)
}
