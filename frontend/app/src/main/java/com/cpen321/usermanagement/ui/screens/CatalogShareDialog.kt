package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Row
import androidx.compose.ui.Alignment
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.data.remote.dto.FriendSummary
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareUiState

@Composable
fun CatalogShareDialogHost(
    showDialog: Boolean,
    catalogName: String?,
    state: CatalogShareUiState,
    onInvite: (String, String) -> Unit,
    onChangeRole: (String, String) -> Unit,
    onRevoke: (String) -> Unit,
    onDismiss: () -> Unit
) {
    if (showDialog) {
        ShareCatalogDialog(
            catalogName = catalogName,
            state = state,
            onInvite = onInvite,
            onChangeRole = onChangeRole,
            onRevoke = onRevoke,
            onDismiss = onDismiss
        )
    }
}

@Composable
private fun ShareCatalogDialog(
    catalogName: String?,
    state: CatalogShareUiState,
    onInvite: (String, String) -> Unit,
    onChangeRole: (String, String) -> Unit,
    onRevoke: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val scrollState = rememberScrollState()
    val inviteState = rememberShareInviteState(state)
    val messageState = remember { ShareDialogMessageState(state) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { ShareDialogTitle(catalogName) },
        text = {
            ShareDialogBody(
                state = state,
                scrollState = scrollState,
                inviteState = inviteState,
                onInvite = onInvite,
                onChangeRole = onChangeRole,
                onRevoke = onRevoke
            )
        },
        confirmButton = {
            TextButton(onClick = onDismiss, enabled = !state.isProcessing) {
                Text("Close")
            }
        },
        dismissButton = messageState.error?.let { error ->
            {
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    )
}

@Composable
private fun ShareDialogTitle(catalogName: String?) {
    Text(
        text = buildString {
            append("Share Catalog")
            if (!catalogName.isNullOrBlank()) {
                append(": ")
                append(catalogName)
            }
        },
        style = MaterialTheme.typography.titleLarge
    )
}

@Composable
private fun ShareDialogBody(
    state: CatalogShareUiState,
    scrollState: androidx.compose.foundation.ScrollState,
    inviteState: ShareInviteState,
    onInvite: (String, String) -> Unit,
    onChangeRole: (String, String) -> Unit,
    onRevoke: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        ShareDialogInviteSection(state, inviteState, onInvite)
        HorizontalDivider()
        ShareDialogCollaboratorsSection(state, onChangeRole, onRevoke)
    }
}

@Composable
private fun ShareDialogInviteSection(
    state: CatalogShareUiState,
    inviteState: ShareInviteState,
    onInvite: (String, String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text = "Invite a friend", style = MaterialTheme.typography.titleMedium)
        if (state.friends.isEmpty()) {
            Text(
                text = "Add friends to invite them to your catalog.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ShareDialogFriendSelector(
                    state = state,
                    inviteState = inviteState,
                    enabled = !state.isProcessing
                )
                ShareDialogRoleSelector(inviteState = inviteState, enabled = !state.isProcessing)
                Button(
                    onClick = {
                        inviteState.selectedFriend?.user?._id?.let { userId ->
                            onInvite(userId, inviteState.selectedRole)
                        }
                    },
                    enabled = inviteState.selectedFriend != null && !state.isProcessing,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Send invitation")
                }
            }
        }
    }
}

@Composable
private fun ShareDialogFriendSelector(
    state: CatalogShareUiState,
    inviteState: ShareInviteState,
    enabled: Boolean
) {
    OutlinedButton(
        onClick = { inviteState.friendMenuExpanded = true },
        enabled = enabled,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(inviteState.friendDisplay())
    }
    DropdownMenu(
        expanded = inviteState.friendMenuExpanded,
        onDismissRequest = { inviteState.friendMenuExpanded = false }
    ) {
        state.friends.forEach { friend ->
            DropdownMenuItem(
                text = { Text(inviteState.friendDisplay(friend)) },
                onClick = {
                    inviteState.selectedFriend = friend
                    inviteState.friendMenuExpanded = false
                }
            )
        }
    }
}

@Composable
private fun ShareDialogRoleSelector(
    inviteState: ShareInviteState,
    enabled: Boolean
) {
    OutlinedButton(
        onClick = { inviteState.roleMenuExpanded = true },
        enabled = enabled,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text("Role: ${inviteState.roleLabel}")
    }
    DropdownMenu(
        expanded = inviteState.roleMenuExpanded,
        onDismissRequest = { inviteState.roleMenuExpanded = false }
    ) {
        inviteState.roleOptions.forEach { role ->
            DropdownMenuItem(
                text = { Text(role.replaceFirstChar { it.uppercase() }) },
                onClick = {
                    inviteState.selectedRole = role
                    inviteState.roleMenuExpanded = false
                }
            )
        }
    }
}

@Composable
private fun ShareDialogCollaboratorsSection(
    state: CatalogShareUiState,
    onChangeRole: (String, String) -> Unit,
    onRevoke: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(text = "Collaborators", style = MaterialTheme.typography.titleMedium)
        if (state.collaborators.isEmpty()) {
            Text(
                text = "No collaborators yet.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(state.collaborators) { collaborator ->
                    CollaboratorRow(
                        collaborator = collaborator,
                        onChangeRole = onChangeRole,
                        onRevoke = onRevoke
                    )
                }
            }
        }
    }
}

@Composable
private fun CollaboratorRow(
    collaborator: CatalogShareEntry,
    onChangeRole: (String, String) -> Unit,
    onRevoke: (String) -> Unit
) {
    val inviter = collaborator.invitedBy
    val invitee = collaborator.invitee
    val roleLabel = collaborator.role.replaceFirstChar { it.uppercase() }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = invitee?.name ?: invitee?.username ?: inviter?.name ?: inviter?.username ?: "Unknown",
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "Role: $roleLabel",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        RowActions(collaborator, onChangeRole, onRevoke)
    }
}

@Composable
private fun RowActions(
    collaborator: CatalogShareEntry,
    onChangeRole: (String, String) -> Unit,
    onRevoke: (String) -> Unit
) {
    val menuExpanded = remember { mutableStateOf(false) }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Text(
            text = collaborator.status.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.bodySmall
        )
        IconButton(onClick = { menuExpanded.value = true }) {
            Icon(imageVector = Icons.Default.MoreVert, contentDescription = "Collaborator actions")
        }
        DropdownMenu(
            expanded = menuExpanded.value,
            onDismissRequest = { menuExpanded.value = false }
        ) {
            DropdownMenuItem(
                text = { Text("Promote to editor") },
                onClick = {
                    menuExpanded.value = false
                    onChangeRole(collaborator._id, "editor")
                }
            )
            DropdownMenuItem(
                text = { Text("Set as viewer") },
                onClick = {
                    menuExpanded.value = false
                    onChangeRole(collaborator._id, "viewer")
                }
            )
            DropdownMenuItem(
                text = { Text("Remove") },
                onClick = {
                    menuExpanded.value = false
                    onRevoke(collaborator._id)
                }
            )
        }
    }
}

private class ShareDialogMessageState(state: CatalogShareUiState) {
    val error: String? = state.errorMessage
}

@Composable
private fun rememberShareInviteState(state: CatalogShareUiState): ShareInviteState {
    return remember(state.friends) {
        ShareInviteState(state.friends.firstOrNull())
    }
}

private class ShareInviteState(initialFriend: FriendSummary?) {
    var selectedFriend: FriendSummary? = initialFriend
    var selectedRole: String = "viewer"
    var friendMenuExpanded: Boolean = false
    var roleMenuExpanded: Boolean = false

    val roleOptions = listOf("viewer", "editor")
    val roleLabel: String get() = selectedRole.replaceFirstChar { it.uppercase() }

    fun friendDisplay(friend: FriendSummary? = selectedFriend): String {
        val user = friend?.user ?: return "Select a friend"
        return user.name ?: user.username ?: "Unknown"
    }
}
