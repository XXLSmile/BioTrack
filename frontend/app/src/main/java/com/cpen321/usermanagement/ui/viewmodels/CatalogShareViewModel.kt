package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.data.remote.dto.FriendSummary
import com.cpen321.usermanagement.data.repository.CatalogRepository
import com.cpen321.usermanagement.data.repository.FriendRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class CatalogShareViewModel @Inject constructor(
    private val catalogRepository: CatalogRepository,
    private val friendRepository: FriendRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CatalogShareUiState())
    val uiState: StateFlow<CatalogShareUiState> = _uiState.asStateFlow()

    fun loadCollaborators(catalogId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, successMessage = null) }
            catalogRepository.listCollaborators(catalogId)
                .onSuccess { collaborators ->
                    _uiState.update { state -> state.copy(isLoading = false, collaborators = collaborators) }
                }
                .onFailure { error ->
                    _uiState.update { state ->
                        state.copy(
                            isLoading = false,
                            errorMessage = error.localizedMessage ?: "Failed to fetch collaborators"
                        )
                    }
                }
        }
    }

    fun loadFriendsIfNeeded() {
        if (_uiState.value.friends.isNotEmpty()) return
        viewModelScope.launch {
            friendRepository.fetchFriends()
                .onSuccess { response ->
                    _uiState.update { it.copy(friends = response.friends) }
                }
                .onFailure { error ->
                    _uiState.update { it.copy(errorMessage = error.localizedMessage ?: "Failed to load friends") }
                }
        }
    }

    fun inviteCollaborator(catalogId: String, inviteeId: String, role: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true, errorMessage = null, successMessage = null) }
            catalogRepository.inviteCollaborator(catalogId, inviteeId, role)
                .onSuccess {
                    _uiState.update { it.copy(isProcessing = false, successMessage = "Invitation sent") }
                    loadCollaborators(catalogId)
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isProcessing = false,
                            errorMessage = error.localizedMessage ?: "Failed to invite collaborator"
                        )
                    }
                }
        }
    }

    fun updateCollaboratorRole(catalogId: String, shareId: String, newRole: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true, errorMessage = null, successMessage = null) }
            catalogRepository.updateCollaborator(catalogId, shareId, role = newRole)
                .onSuccess {
                    _uiState.update { it.copy(isProcessing = false, successMessage = "Collaborator updated") }
                    loadCollaborators(catalogId)
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isProcessing = false,
                            errorMessage = error.localizedMessage ?: "Failed to update collaborator"
                        )
                    }
                }
        }
    }

    fun revokeCollaborator(catalogId: String, shareId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true, errorMessage = null, successMessage = null) }
            catalogRepository.updateCollaborator(catalogId, shareId, action = "revoke")
                .onSuccess {
                    _uiState.update { it.copy(isProcessing = false, successMessage = "Invitation revoked") }
                    loadCollaborators(catalogId)
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isProcessing = false,
                            errorMessage = error.localizedMessage ?: "Failed to revoke invitation"
                        )
                    }
                }
        }
    }

    fun loadSharedWithMe() {
        viewModelScope.launch {
            catalogRepository.listSharedWithMe()
                .onSuccess { shares ->
                    val accepted = shares.filter { it.status == "accepted" }
                    _uiState.update { it.copy(sharedCatalogs = accepted) }
                }
                .onFailure { error ->
                    _uiState.update { it.copy(errorMessage = error.localizedMessage ?: "Failed to load shared catalogs") }
                }
        }
    }

    fun loadPendingInvitations() {
        viewModelScope.launch {
            catalogRepository.listPendingInvitations()
                .onSuccess { invites ->
                    val pending = invites.filter { it.status == "pending" }
                    _uiState.update { it.copy(pendingInvitations = pending) }
                }
                .onFailure { error ->
                    _uiState.update { it.copy(errorMessage = error.localizedMessage ?: "Failed to load invitations") }
                }
        }
    }

    fun respondToInvitation(shareId: String, action: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isProcessing = true, errorMessage = null, successMessage = null) }
            catalogRepository.respondToInvitation(shareId, action)
                .onSuccess {
                    val message = if (action == "accept") "Invitation accepted" else "Invitation declined"
                    _uiState.update { it.copy(isProcessing = false, successMessage = message) }
                    loadPendingInvitations()
                    loadSharedWithMe()
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isProcessing = false,
                            errorMessage = error.localizedMessage ?: "Failed to respond to invitation"
                        )
                    }
                }
        }
    }

    fun clearMessages() {
        _uiState.update { it.copy(errorMessage = null, successMessage = null) }
    }
}

data class CatalogShareUiState(
    val collaborators: List<CatalogShareEntry> = emptyList(),
    val friends: List<FriendSummary> = emptyList(),
    val pendingInvitations: List<CatalogShareEntry> = emptyList(),
    val sharedCatalogs: List<CatalogShareEntry> = emptyList(),
    val isLoading: Boolean = false,
    val isProcessing: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
)
