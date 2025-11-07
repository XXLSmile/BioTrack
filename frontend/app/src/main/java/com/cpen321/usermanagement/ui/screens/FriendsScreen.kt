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
import com.cpen321.usermanagement.data.repository.FriendRecommendation
import java.util.Locale
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
    val handlers = rememberFriendsScreenHandlers(
        viewModel = viewModel,
        onUserSelected = onUserSelected,
        onClearMessage = viewModel::clearMessages
    )

    LaunchedEffect(Unit) {
        viewModel.refreshAll()
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> viewModel.refreshAll()
                Lifecycle.Event.ON_STOP -> viewModel.clearSearchState()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    FriendsScreenHost(uiState = uiState, handlers = handlers)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FriendsScreenHost(
    uiState: FriendUiState,
    handlers: FriendsScreenHandlers
) {
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.successMessage) {
        uiState.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            handlers.onClearMessage()
        }
    }

    LaunchedEffect(uiState.errorMessage) {
        uiState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            handlers.onClearMessage()
        }
    }

    FriendsScreenContent(
        uiState = uiState,
        handlers = handlers,
        snackbarHostState = snackbarHostState
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FriendsScreenContent(
    uiState: FriendUiState,
    handlers: FriendsScreenHandlers,
    snackbarHostState: SnackbarHostState
) {
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
                onQueryChange = handlers.onSearchQueryChange,
                onSearch = handlers.onSearch,
                isSearching = uiState.isSearching
            )

            FriendTabRow(selected = uiState.selectedTab, onTabSelected = handlers.onTabSelected)

            FriendTabContent(
                uiState = uiState,
                onRemoveFriend = handlers.onRemoveFriend,
                onAcceptRequest = handlers.onAcceptRequest,
                onDeclineRequest = handlers.onDeclineRequest,
                onCancelRequest = handlers.onCancelRequest,
                onUserSelected = handlers.onUserSelected
            )

            SearchResultsCard(
                uiState = uiState,
                onSendRequest = handlers.onSendRequest,
                onUserSelected = handlers.onUserSelected
            )

            RecommendationSection(
                recommendations = uiState.recommendations,
                isLoading = uiState.isLoadingRecommendations,
                onSendRequest = handlers.onSendRequest,
                onUserSelected = handlers.onUserSelected,
                onRefresh = handlers.onRefreshRecommendations
            )
        }
    }
}

@Composable
private fun FriendTabContent(
    uiState: FriendUiState,
    onRemoveFriend: (String) -> Unit,
    onAcceptRequest: (String) -> Unit,
    onDeclineRequest: (String) -> Unit,
    onCancelRequest: (String) -> Unit,
    onUserSelected: (PublicUserSummary) -> Unit
) {
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
            config = FriendRequestSectionConfig(
                emptyMessage = "No new requests",
                primaryActionText = "Accept",
                secondaryActionText = "Decline",
                primaryActionEnabled = true,
                userResolver = { it.requester },
                onPrimaryAction = onAcceptRequest,
                onSecondaryAction = onDeclineRequest,
                onUserSelected = onUserSelected
            )
        )
        FriendUiTab.SENT -> FriendRequestSection(
            requests = uiState.sentRequests,
            isLoading = uiState.isLoadingSentRequests,
            config = FriendRequestSectionConfig(
                emptyMessage = "No pending requests",
                primaryActionText = "Pending",
                secondaryActionText = "Cancel",
                primaryActionEnabled = false,
                userResolver = { it.addressee },
                onPrimaryAction = {},
                onSecondaryAction = onCancelRequest,
                onUserSelected = onUserSelected
            )
        )
    }
}

@Composable
private fun SearchResultsCard(
    uiState: FriendUiState,
    onSendRequest: (String) -> Unit,
    onUserSelected: (PublicUserSummary) -> Unit
) {
    if (uiState.searchResults.isEmpty()) return

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
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
    config: FriendRequestSectionConfig
) {
    FriendCardWrapper {
        when {
            isLoading -> LoadingPlaceholder()
            requests.isEmpty() -> EmptyState(message = config.emptyMessage)
            else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(requests) { request ->
                    val user = config.userResolver(request) ?: request.requester ?: request.addressee
                    FriendRequestRow(
                        request = request,
                        user = user,
                        config = FriendRequestRowConfig(
                            primaryActionText = config.primaryActionText,
                            secondaryActionText = config.secondaryActionText,
                            onPrimaryAction = { config.onPrimaryAction(request._id) },
                            onSecondaryAction = { config.onSecondaryAction(request._id) },
                            primaryActionEnabled = config.primaryActionEnabled,
                            onUserSelected = config.onUserSelected
                        )
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
private fun RecommendationSection(
    recommendations: List<FriendRecommendation>,
    isLoading: Boolean,
    onSendRequest: (String) -> Unit,
    onUserSelected: (PublicUserSummary) -> Unit,
    onRefresh: () -> Unit
) {
    if (!isLoading && recommendations.isEmpty()) {
        return
    }

    FriendCardWrapper {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Suggested friends",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Medium
            )
            TextButton(onClick = onRefresh) {
                Text("Refresh")
            }
        }

        when {
            isLoading -> {
                LoadingPlaceholder()
            }

            recommendations.isEmpty() -> {
                Text(
                    text = "No suggestions yet. Try refreshing later!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            else -> {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    recommendations.forEachIndexed { index, recommendation ->
                        RecommendationRow(
                            recommendation = recommendation,
                            isActionEnabled = true,
                            onSendRequest = onSendRequest,
                            onUserSelected = onUserSelected
                        )
                        if (index != recommendations.lastIndex) {
                            HorizontalDivider(
                                color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RecommendationRow(
    recommendation: FriendRecommendation,
    isActionEnabled: Boolean,
    onSendRequest: (String) -> Unit,
    onUserSelected: (PublicUserSummary) -> Unit
) {
    val summary = PublicUserSummary(
        _id = recommendation.userId,
        name = recommendation.name,
        username = recommendation.username,
        profilePicture = recommendation.profilePicture
    )

    val distanceText = recommendation.distanceKm?.let { distance ->
        when {
            distance < 0.1 -> "Less than 0.1 km away"
            else -> String.format(Locale.getDefault(), "%.1f km away", distance)
        }
    }

    val subtitle = distanceText ?: if (recommendation.locationMatch) "Nearby" else null

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        UserSummary(
            user = summary,
            subtitle = subtitle?.takeIf { it.isNotBlank() },
            onClick = summary.username?.let { { onUserSelected(summary) } }
        )
        IconButton(
            onClick = { onSendRequest(recommendation.userId) },
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
private fun FriendRequestRow(
    request: FriendRequestSummary,
    user: PublicUserSummary?,
    config: FriendRequestRowConfig
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (user != null) {
            UserSummary(
                user = user,
                subtitle = request.status.replaceFirstChar { it.uppercase() },
                onClick = user.username?.let { { config.onUserSelected(user) } }
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = config.onPrimaryAction,
                enabled = config.primaryActionEnabled,
                modifier = Modifier.weight(1f)
            ) {
                Text(config.primaryActionText)
            }
            OutlinedButton(
                onClick = config.onSecondaryAction,
                modifier = Modifier.weight(1f)
            ) {
                Text(config.secondaryActionText)
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

private data class FriendsScreenHandlers(
    val onSearchQueryChange: (String) -> Unit,
    val onSearch: () -> Unit,
    val onTabSelected: (FriendUiTab) -> Unit,
    val onSendRequest: (String) -> Unit,
    val onAcceptRequest: (String) -> Unit,
    val onDeclineRequest: (String) -> Unit,
    val onRemoveFriend: (String) -> Unit,
    val onCancelRequest: (String) -> Unit,
    val onRefreshRecommendations: () -> Unit,
    val onUserSelected: (PublicUserSummary) -> Unit,
    val onClearMessage: () -> Unit
)

@Composable
private fun rememberFriendsScreenHandlers(
    viewModel: FriendViewModel,
    onUserSelected: (PublicUserSummary) -> Unit,
    onClearMessage: () -> Unit
): FriendsScreenHandlers {
    return remember(viewModel, onUserSelected, onClearMessage) {
        FriendsScreenHandlers(
            onSearchQueryChange = viewModel::updateSearchQuery,
            onSearch = viewModel::searchUsers,
            onTabSelected = viewModel::switchTab,
            onSendRequest = viewModel::sendFriendRequest,
            onAcceptRequest = viewModel::acceptFriendRequest,
            onDeclineRequest = viewModel::declineFriendRequest,
            onRemoveFriend = viewModel::removeFriend,
            onCancelRequest = viewModel::cancelFriendRequest,
            onRefreshRecommendations = { viewModel.loadRecommendations() },
            onUserSelected = onUserSelected,
            onClearMessage = onClearMessage
        )
    }
}

private data class FriendRequestSectionConfig(
    val emptyMessage: String,
    val primaryActionText: String,
    val secondaryActionText: String,
    val primaryActionEnabled: Boolean,
    val userResolver: (FriendRequestSummary) -> PublicUserSummary?,
    val onPrimaryAction: (String) -> Unit,
    val onSecondaryAction: (String) -> Unit,
    val onUserSelected: (PublicUserSummary) -> Unit
)

private data class FriendRequestRowConfig(
    val primaryActionText: String,
    val secondaryActionText: String,
    val onPrimaryAction: () -> Unit,
    val onSecondaryAction: () -> Unit,
    val primaryActionEnabled: Boolean,
    val onUserSelected: (PublicUserSummary) -> Unit
)
