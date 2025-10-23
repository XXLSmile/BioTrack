package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.remote.dto.FriendRequestSummary
import com.cpen321.usermanagement.data.remote.dto.FriendSummary
import com.cpen321.usermanagement.data.remote.dto.PublicUserSummary
import com.cpen321.usermanagement.data.repository.FriendRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class FriendUiTab(val label: String) {
    FRIENDS("Friends"),
    REQUESTS("Requests"),
    SENT("Sent")
}

data class FriendUiState(
    val friends: List<FriendSummary> = emptyList(),
    val incomingRequests: List<FriendRequestSummary> = emptyList(),
    val sentRequests: List<FriendRequestSummary> = emptyList(),
    val searchResults: List<PublicUserSummary> = emptyList(),
    val searchQuery: String = "",
    val isSearching: Boolean = false,
    val isLoadingFriends: Boolean = false,
    val isLoadingRequests: Boolean = false,
    val isLoadingSentRequests: Boolean = false,
    val selectedTab: FriendUiTab = FriendUiTab.FRIENDS,
    val errorMessage: String? = null,
    val successMessage: String? = null
) {
    fun canSendRequest(userId: String): Boolean {
        val alreadyFriend = friends.any { it.user._id == userId }
        val alreadyIncoming = incomingRequests.any { it.requester?._id == userId }
        val alreadyOutgoing = sentRequests.any { it.addressee?._id == userId }
        return !alreadyFriend && !alreadyIncoming && !alreadyOutgoing
    }
}

@HiltViewModel
class FriendViewModel @Inject constructor(
    private val friendRepository: FriendRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(FriendUiState())
    val uiState: StateFlow<FriendUiState> = _uiState.asStateFlow()

    init {
        refreshAll()
    }

    fun refreshAll() {
        refreshFriends()
        refreshIncomingRequests()
        refreshSentRequests()
    }

    fun updateSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
    }

    fun searchUsers() {
        val query = _uiState.value.searchQuery.trim()
        if (query.isEmpty()) return
        viewModelScope.launch {
            _uiState.update { it.copy(isSearching = true, searchResults = emptyList(), errorMessage = null) }
            friendRepository.searchUsers(query)
                .onSuccess { result ->
                    _uiState.update {
                        it.copy(
                            isSearching = false,
                            searchResults = result.users,
                            errorMessage = null
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isSearching = false,
                            errorMessage = error.localizedMessage ?: "Failed to search users"
                        )
                    }
                }
        }
    }

    fun switchTab(tab: FriendUiTab) {
        _uiState.update { it.copy(selectedTab = tab) }
        when (tab) {
            FriendUiTab.FRIENDS -> refreshFriends()
            FriendUiTab.REQUESTS -> refreshIncomingRequests()
            FriendUiTab.SENT -> refreshSentRequests()
        }
    }

    fun sendFriendRequest(targetUserId: String) {
        viewModelScope.launch {
            friendRepository.sendFriendRequest(targetUserId)
                .onSuccess {
                    refreshIncomingRequests()
                    refreshSentRequests()
                    _uiState.update { it.copy(successMessage = "Friend request sent") }
                }
                .onFailure { error ->
                    _uiState.update { it.copy(errorMessage = error.localizedMessage ?: "Failed to send request") }
                }
        }
    }

    fun acceptFriendRequest(requestId: String) {
        respondToRequest(requestId, "accept") {
            refreshFriends()
            refreshIncomingRequests()
        }
    }

    fun declineFriendRequest(requestId: String) {
        respondToRequest(requestId, "decline") {
            refreshIncomingRequests()
        }
    }

    fun cancelFriendRequest(requestId: String) {
        respondToRequest(requestId, "decline") {
            refreshSentRequests()
        }
    }

    fun removeFriend(friendshipId: String) {
        viewModelScope.launch {
            friendRepository.removeFriend(friendshipId)
                .onSuccess {
                    refreshFriends()
                    _uiState.update { it.copy(successMessage = "Friend removed") }
                }
                .onFailure { error ->
                    _uiState.update { it.copy(errorMessage = error.localizedMessage ?: "Failed to remove friend") }
                }
        }
    }

    fun clearMessages() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }

    fun clearSearchState() {
        _uiState.update {
            it.copy(
                searchQuery = "",
                searchResults = emptyList(),
                isSearching = false
            )
        }
    }

    private fun refreshFriends() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingFriends = true) }
            friendRepository.fetchFriends()
                .onSuccess { response ->
                    _uiState.update {
                        it.copy(
                            friends = response.friends,
                            isLoadingFriends = false
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoadingFriends = false,
                            errorMessage = error.localizedMessage ?: "Failed to load friends"
                        )
                    }
                }
        }
    }

    private fun refreshIncomingRequests() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingRequests = true) }
            friendRepository.fetchFriendRequests(null)
                .onSuccess { response ->
                    _uiState.update {
                        it.copy(
                            incomingRequests = response.requests,
                            isLoadingRequests = false
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoadingRequests = false,
                            errorMessage = error.localizedMessage ?: "Failed to load requests"
                        )
                    }
                }
        }
    }

    private fun refreshSentRequests() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingSentRequests = true) }
            friendRepository.fetchFriendRequests("outgoing")
                .onSuccess { response ->
                    _uiState.update {
                        it.copy(
                            sentRequests = response.requests,
                            isLoadingSentRequests = false
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoadingSentRequests = false,
                            errorMessage = error.localizedMessage ?: "Failed to load sent requests"
                        )
                    }
                }
        }
    }

    private fun respondToRequest(
        requestId: String,
        action: String,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            friendRepository.respondToRequest(requestId, action)
                .onSuccess {
                    onSuccess()
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(errorMessage = error.localizedMessage ?: "Failed to update request")
                    }
                }
        }
    }
}
