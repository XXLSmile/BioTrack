package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.surfaceColorAtElevation
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.cpen321.usermanagement.data.remote.dto.FriendSummary
import com.cpen321.usermanagement.data.remote.dto.FriendRequestSummary
import com.cpen321.usermanagement.data.remote.dto.PublicUserSummary
import com.cpen321.usermanagement.ui.viewmodels.FriendUiState
import com.cpen321.usermanagement.ui.viewmodels.FriendUiTab
import com.cpen321.usermanagement.ui.viewmodels.FriendViewModel

@Composable
fun FriendsScreen(
    viewModel: FriendViewModel = hiltViewModel(),
    onUserSelected: (PublicUserSummary) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsState()
    val lifecycleOwner = LocalLifecycleOwner.current

    LaunchedEffect(Unit) {
        viewModel.refreshAll()
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.refreshAll()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    FriendsScreenContent(
        uiState = uiState,
        onSearchQueryChange = viewModel::updateSearchQuery,
        onSearch = viewModel::searchUsers,
        onTabSelected = viewModel::switchTab,
        onSendRequest = viewModel::sendFriendRequest,
        onAcceptRequest = viewModel::acceptFriendRequest,
        onDeclineRequest = viewModel::declineFriendRequest,
        onRemoveFriend = viewModel::removeFriend,
        onCancelRequest = viewModel::cancelFriendRequest,
        onClearMessage = viewModel::clearMessages,
        onUserSelected = onUserSelected
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FriendsScreenContent(
    uiState: FriendUiState,
    onSearchQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    onTabSelected: (FriendUiTab) -> Unit,
    onSendRequest: (String) -> Unit,
    onAcceptRequest: (String) -> Unit,
    onDeclineRequest: (String) -> Unit,
    onRemoveFriend: (String) -> Unit,
    onCancelRequest: (String) -> Unit,
    onClearMessage: () -> Unit,
    onUserSelected: (PublicUserSummary) -> Unit,
) {
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.successMessage) {
        uiState.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            onClearMessage()
        }
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            onClearMessage()
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .padding(paddingValues)
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            SearchBar(
                query = uiState.searchQuery,
                onQueryChange = onSearchQueryChange,
                onSearch = onSearch,
                isSearching = uiState.isSearching
            )

            FriendTabRow(selected = uiState.selectedTab, onTabSelected = onTabSelected)

            when (uiState.selectedTab) {
                FriendUiTab.FRIENDS -> FriendListSection(
                    friends = uiState.friends,
                    isLoading = uiState.isLoadingFriends,
                    onRemoveFriend = onRemoveFriend,
                    emptyMessage = "No friends yet\nSearch above to connect with other users",
                    onUserSelected = onUserSelected
                )
                FriendUiTab.REQUESTS -> FriendRequestSection(
                    requests = uiState.incomingRequests,
                    isLoading = uiState.isLoadingRequests,
                    onAccept = onAcceptRequest,
                    onDecline = onDeclineRequest,
                    emptyMessage = "No new requests",
                    primaryActionText = "Accept",
                    secondaryActionText = "Decline",
                    primaryActionEnabled = true,
                    userResolver = { it.requester },
                    onUserSelected = onUserSelected
                )
                FriendUiTab.SENT -> FriendRequestSection(
                    requests = uiState.sentRequests,
                    isLoading = uiState.isLoadingSentRequests,
                    onAccept = {},
                    onDecline = onCancelRequest,
                    emptyMessage = "No pending requests",
                    primaryActionText = "Pending",
                    secondaryActionText = "Cancel",
                    primaryActionEnabled = false,
                    userResolver = { it.addressee },
                    onUserSelected = onUserSelected
                )
            }

            if (uiState.searchResults.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    ),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Search results",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Medium
                        )
                        HorizontalDivider(
                            color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f),
                            thickness = 1.dp
                        )
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.heightIn(max = 280.dp)
                        ) {
                            items(uiState.searchResults) { user ->
                                SearchResultRow(
                                    user = user,
                                    onSendRequest = onSendRequest,
                                    isActionEnabled = uiState.canSendRequest(user._id),
                                    onUserSelected = onUserSelected
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    isSearching: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = onQueryChange,
                placeholder = { Text("Search for friends…") },
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 8.dp),
                singleLine = true,
                shape = RoundedCornerShape(16.dp)
            )
            IconButton(
                onClick = onSearch,
                enabled = !isSearching && query.isNotBlank(),
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.primary)
                    .size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search friends",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    }
}

@Composable
private fun FriendTabRow(
    selected: FriendUiTab,
    onTabSelected: (FriendUiTab) -> Unit
) {
    val tabs = FriendUiTab.values()
    val selectedIndex = tabs.indexOf(selected)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Color(0xFFF4F4F8))
            .padding(6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        tabs.forEach { tab ->
            val isSelected = tab == selected
            val background = if (isSelected) MaterialTheme.colorScheme.primary else Color.Transparent
            val contentColor = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant

            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(18.dp))
                    .background(background)
                    .clickable { onTabSelected(tab) }
                    .padding(vertical = 10.dp, horizontal = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = tab.label,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.labelLarge,
                    color = contentColor
                )
            }
        }
    }
}

@Composable
private fun FriendListSection(
    friends: List<FriendSummary>,
    isLoading: Boolean,
    onRemoveFriend: (String) -> Unit,
    emptyMessage: String,
    onUserSelected: (PublicUserSummary) -> Unit
) {
    FriendCardWrapper {
        when {
            isLoading -> LoadingPlaceholder()
            friends.isEmpty() -> EmptyState(message = emptyMessage)
            else -> LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(friends) { friend ->
                    FriendRow(friend, onRemoveFriend, onUserSelected)
                }
            }
        }
    }
}

@Composable
private fun FriendRequestSection(
    requests: List<FriendRequestSummary>,
    isLoading: Boolean,
    onAccept: (String) -> Unit,
    onDecline: (String) -> Unit,
    emptyMessage: String,
    primaryActionText: String,
    secondaryActionText: String,
    primaryActionEnabled: Boolean = true,
    userResolver: (FriendRequestSummary) -> PublicUserSummary?,
    onUserSelected: (PublicUserSummary) -> Unit
) {
    FriendCardWrapper {
        when {
            isLoading -> LoadingPlaceholder()
            requests.isEmpty() -> EmptyState(message = emptyMessage)
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(requests) { request ->
                    FriendRequestRow(
                        request = request,
                        user = userResolver(request) ?: request.requester ?: request.addressee,
                        primaryActionText = primaryActionText,
                        secondaryActionText = secondaryActionText,
                        onPrimaryAction = { onAccept(request._id) },
                        onSecondaryAction = { onDecline(request._id) },
                        primaryActionEnabled = primaryActionEnabled,
                        onUserSelected = onUserSelected
                    )
                }
            }
        }
    }
}

@Composable
private fun FriendCardWrapper(content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF7F7FA))
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            content()
        }
    }
}

@Composable
private fun LoadingPlaceholder() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(160.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "Loading …",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun EmptyState(message: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
    Icon(
        imageVector = Icons.Outlined.Group,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.size(64.dp)
    )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun FriendRow(
    friend: FriendSummary,
    onRemoveFriend: (String) -> Unit,
    onUserSelected: (PublicUserSummary) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        UserSummary(
            user = friend.user,
            subtitle = "Friends since ${friend.since}",
            onClick = friend.user.username?.let { { onUserSelected(friend.user) } }
        )
        IconButton(onClick = { onRemoveFriend(friend.friendshipId) }) {
            Icon(
                imageVector = Icons.Rounded.Delete,
                contentDescription = "Remove friend",
                tint = MaterialTheme.colorScheme.error
            )
        }
    }
}

@Composable
private fun FriendRequestRow(
    request: FriendRequestSummary,
    user: PublicUserSummary?,
    primaryActionText: String,
    secondaryActionText: String,
    onPrimaryAction: () -> Unit,
    onSecondaryAction: () -> Unit,
    primaryActionEnabled: Boolean,
    onUserSelected: (PublicUserSummary) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (user != null) {
            UserSummary(
                user = user,
                subtitle = request.status.replaceFirstChar { it.uppercase() },
                onClick = user.username?.let { { onUserSelected(user) } }
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = onPrimaryAction,
                enabled = primaryActionEnabled,
                modifier = Modifier.weight(1f)
            ) {
                Text(primaryActionText)
            }
            OutlinedButton(
                onClick = onSecondaryAction,
                modifier = Modifier.weight(1f)
            ) {
                Text(secondaryActionText)
            }
        }
    }
}

@Composable
private fun SearchResultRow(
    user: PublicUserSummary,
    onSendRequest: (String) -> Unit,
    isActionEnabled: Boolean,
    onUserSelected: (PublicUserSummary) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !user.username.isNullOrBlank()) {
                user.username?.let { onUserSelected(user) }
            },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        UserSummary(
            user = user,
            onClick = user.username?.let { { onUserSelected(user) } }
        )
        IconButton(
            onClick = { onSendRequest(user._id) },
            enabled = isActionEnabled,
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(
                    if (isActionEnabled)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f)
                )
        ) {
            Icon(
                imageVector = Icons.Default.PersonAdd,
                contentDescription = "Send friend request",
                tint = if (isActionEnabled)
                    MaterialTheme.colorScheme.onPrimary
                else
                    MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun UserSummary(
    user: PublicUserSummary,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    val rowModifier = onClick?.let { modifier.clickable(onClick = it) } ?: modifier

    Row(
        modifier = rowModifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Outlined.Person,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Column(
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = user.name ?: user.username ?: "Unknown user",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
