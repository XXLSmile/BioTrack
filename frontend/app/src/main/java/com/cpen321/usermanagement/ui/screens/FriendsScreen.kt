package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.data.remote.dto.FriendSummary
import com.cpen321.usermanagement.data.remote.dto.FriendRequestSummary
import com.cpen321.usermanagement.data.remote.dto.PublicUserSummary
import com.cpen321.usermanagement.ui.viewmodels.FriendUiState
import com.cpen321.usermanagement.ui.viewmodels.FriendUiTab
import com.cpen321.usermanagement.ui.viewmodels.FriendViewModel

@Composable
fun FriendsScreen(viewModel: FriendViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    FriendsScreenContent(
        uiState = uiState,
        onSearchQueryChange = viewModel::updateSearchQuery,
        onSearch = viewModel::searchUsers,
        onTabSelected = viewModel::switchTab,
        onSendRequest = viewModel::sendFriendRequest,
        onAcceptRequest = viewModel::acceptFriendRequest,
        onDeclineRequest = viewModel::declineFriendRequest,
        onRemoveFriend = viewModel::removeFriend,
        onCancelRequest = viewModel::cancelFriendRequest
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
) {
    Scaffold(
        modifier = Modifier.fillMaxSize(),
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
                    emptyMessage = "No friends yet\nSearch above to connect with other users"
                )
                FriendUiTab.REQUESTS -> FriendRequestSection(
                    requests = uiState.incomingRequests,
                    isLoading = uiState.isLoadingRequests,
                    onAccept = onAcceptRequest,
                    onDecline = onDeclineRequest,
                    emptyMessage = "No new requests",
                    primaryActionText = "Accept",
                    secondaryActionText = "Decline"
                )
                FriendUiTab.SENT -> FriendRequestSection(
                    requests = uiState.sentRequests,
                    isLoading = uiState.isLoadingSentRequests,
                    onAccept = {},
                    onDecline = onCancelRequest,
                    emptyMessage = "No pending requests",
                    primaryActionText = "Pending",
                    secondaryActionText = "Cancel",
                    primaryActionEnabled = false
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
                        Divider()
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.heightIn(max = 280.dp)
                        ) {
                            items(uiState.searchResults) { user ->
                                SearchResultRow(
                                    user = user,
                                    onSendRequest = onSendRequest,
                                    isActionEnabled = uiState.canSendRequest(user._id)
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
    TabRow(
        selectedTabIndex = selectedIndex,
        containerColor = Color(0xFFF4F4F8),
        contentColor = MaterialTheme.colorScheme.primary,
        indicator = {},
        divider = {}
    ) {
        tabs.forEachIndexed { index, tab ->
            Tab(
                selected = index == selectedIndex,
                onClick = { onTabSelected(tab) },
                modifier = Modifier
                    .padding(horizontal = 4.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(16.dp)),
                selectedContentColor = MaterialTheme.colorScheme.onPrimary,
                unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant
            ) {
                Box(
                    modifier = Modifier
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .background(
                            color = if (index == selectedIndex)
                                MaterialTheme.colorScheme.primary else Color.Transparent,
                            shape = RoundedCornerShape(16.dp)
                        )
                ) {
                    Text(
                        text = tab.label,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            }
        }
    }
}

@Composable
private fun FriendListSection(
    friends: List<FriendSummary>,
    isLoading: Boolean,
    onRemoveFriend: (String) -> Unit,
    emptyMessage: String
) {
    FriendCardWrapper {
        when {
            isLoading -> LoadingPlaceholder()
            friends.isEmpty() -> EmptyState(message = emptyMessage)
            else -> LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(friends) { friend ->
                    FriendRow(friend, onRemoveFriend)
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
    primaryActionEnabled: Boolean = true
) {
    FriendCardWrapper {
        when {
            isLoading -> LoadingPlaceholder()
            requests.isEmpty() -> EmptyState(message = emptyMessage)
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(requests) { request ->
                    FriendRequestRow(
                        request = request,
                        primaryActionText = primaryActionText,
                        secondaryActionText = secondaryActionText,
                        onPrimaryAction = { onAccept(request._id) },
                        onSecondaryAction = { onDecline(request._id) },
                        primaryActionEnabled = primaryActionEnabled
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
private fun FriendRow(friend: FriendSummary, onRemoveFriend: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        UserSummary(
            user = friend.user,
            subtitle = "Friends since ${friend.since}"
        )
        TextButton(onClick = { onRemoveFriend(friend.friendshipId) }) {
            Text(text = "Remove", color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun FriendRequestRow(
    request: FriendRequestSummary,
    primaryActionText: String,
    secondaryActionText: String,
    onPrimaryAction: () -> Unit,
    onSecondaryAction: () -> Unit,
    primaryActionEnabled: Boolean
) {
    val user = request.requester ?: request.addressee
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (user != null) {
            UserSummary(
                user = user,
                subtitle = request.status.replaceFirstChar { it.uppercase() }
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
    isActionEnabled: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        UserSummary(user = user)
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
    subtitle: String? = null
) {
    Row(
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
