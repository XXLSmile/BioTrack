package com.cpen321.usermanagement.ui.viewmodels.catalog

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogData
import com.cpen321.usermanagement.data.remote.socket.CatalogSocketEvent
import com.cpen321.usermanagement.data.remote.socket.CatalogSocketService
import com.cpen321.usermanagement.data.repository.CatalogRepository
import com.cpen321.usermanagement.data.repository.RecognitionRepository
import com.cpen321.usermanagement.data.repository.RepositoryException
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.LinkedHashSet
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import java.io.IOException
import retrofit2.HttpException

@HiltViewModel
class CatalogViewModel @Inject constructor(
    private val repository: CatalogRepository,
    private val recognitionRepository: RecognitionRepository,
    private val socketService: CatalogSocketService
) : ViewModel() {

    companion object {
        private const val TAG = "CatalogViewModel"
    }

    private val _catalogs = MutableStateFlow<List<Catalog>>(emptyList())
    val catalogs: StateFlow<List<Catalog>> = _catalogs.asStateFlow()

    private val _catalogDetail = MutableStateFlow<CatalogData?>(null)
    val catalogDetail: StateFlow<CatalogData?> = _catalogDetail.asStateFlow()

    private var activeCatalogId: String? = null

    init {
        observeSocketEvents()
        loadCatalogs()
    }

    private fun observeSocketEvents() {
        viewModelScope.launch {
            socketService.events.collect { event ->
                when (event) {
                    is CatalogSocketEvent.EntriesUpdated -> handleEntriesUpdated(event)
                    is CatalogSocketEvent.MetadataUpdated -> handleMetadataUpdated(event)
                    is CatalogSocketEvent.CatalogDeleted -> handleCatalogDeleted(event)
                    is CatalogSocketEvent.Error -> Log.w(TAG, "Socket error: ${event.message}")
                }
            }
        }
    }

    fun loadCatalogs() {
        viewModelScope.launch {
            try {
                _catalogs.value = repository.getCatalogs()
            } catch (e: RepositoryException) {
                logCatalogError("Failed to load catalogs", e)
            } catch (e: IOException) {
                logCatalogError("Failed to load catalogs due to network error", e)
            } catch (e: HttpException) {
                logCatalogError("Failed to load catalogs: HTTP ${e.code()}", e)
            }
        }
    }

    fun createCatalog(name: String, description: String? = null) {
        viewModelScope.launch {
            try {
                val created = repository.createCatalog(name, description)
                if (created != null) {
                    _catalogs.value = _catalogs.value + created
                }
            } catch (e: RepositoryException) {
                logCatalogError("Failed to create catalog", e)
            } catch (e: IOException) {
                logCatalogError("Failed to create catalog due to network error", e)
            } catch (e: HttpException) {
                logCatalogError("Failed to create catalog: HTTP ${e.code()}", e)
            }
        }
    }

    fun loadCatalogDetail(catalogId: String) {
        viewModelScope.launch {
            try {
                if (activeCatalogId != catalogId) {
                    activeCatalogId?.let { socketService.leaveCatalog(it) }
                    activeCatalogId = catalogId
                    socketService.joinCatalog(catalogId)
                        .onFailure { error ->
                            Log.w(TAG, "Failed to join catalog room $catalogId", error)
                        }
                }

                val detail = repository.getCatalogById(catalogId)
                applyCatalogData(detail)
            } catch (e: RepositoryException) {
                logCatalogError("Failed to load catalog detail", e)
                _catalogDetail.value = null
            } catch (e: IOException) {
                logCatalogError("Failed to load catalog detail due to network error", e)
                _catalogDetail.value = null
            } catch (e: HttpException) {
                logCatalogError("Failed to load catalog detail: HTTP ${e.code()}", e)
                _catalogDetail.value = null
            }
        }
    }

    fun deleteCatalog(catalogId: String) {
        viewModelScope.launch {
            try {
                val success = repository.deleteCatalog(catalogId)
                if (success) {
                    _catalogs.value = _catalogs.value.filterNot { it._id == catalogId }
                    if (activeCatalogId == catalogId) {
                        activeCatalogId = null
                        _catalogDetail.value = null
                    }
                    socketService.leaveCatalog(catalogId)
                }
            } catch (e: RepositoryException) {
                logCatalogError("Failed to delete catalog", e)
            } catch (e: IOException) {
                logCatalogError("Failed to delete catalog due to network error", e)
            } catch (e: HttpException) {
                logCatalogError("Failed to delete catalog: HTTP ${e.code()}", e)
            }
        }
    }

    fun addEntryToCatalog(
        targetCatalogId: String,
        entryId: String,
        currentCatalogId: String?,
        onComplete: (Boolean, String?) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val updatedCatalog = repository.linkEntryToCatalog(targetCatalogId, entryId)
                loadCatalogs()
                when {
                    currentCatalogId == null -> Unit
                    currentCatalogId == targetCatalogId && updatedCatalog != null -> applyCatalogData(updatedCatalog)
                    else -> currentCatalogId?.let { loadCatalogDetail(it) }
                }
                onComplete(true, null)
            } catch (e: RepositoryException) {
                logCatalogError("Failed to add entry to catalog", e)
                onComplete(false, e.message)
            } catch (e: IOException) {
                logCatalogError("Failed to add entry to catalog due to network error", e)
                onComplete(false, "Network error")
            } catch (e: HttpException) {
                logCatalogError("Failed to add entry to catalog: HTTP ${e.code()}", e)
                onComplete(false, "Server error")
            }
        }
    }

    fun removeEntryFromCatalog(
        catalogId: String,
        entryId: String,
        onComplete: (Boolean, String?) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val updatedCatalog = repository.unlinkEntryFromCatalog(catalogId, entryId)
                loadCatalogs()
                if (updatedCatalog != null) {
                    applyCatalogData(updatedCatalog)
                } else {
                    loadCatalogDetail(catalogId)
                }
                onComplete(true, null)
            } catch (e: RepositoryException) {
                logCatalogError("Failed to remove entry from catalog", e)
                onComplete(false, e.message)
            } catch (e: IOException) {
                logCatalogError("Failed to remove entry from catalog due to network error", e)
                onComplete(false, "Network error")
            } catch (e: HttpException) {
                logCatalogError("Failed to remove entry from catalog: HTTP ${e.code()}", e)
                onComplete(false, "Server error")
            }
        }
    }

    fun deleteEntry(
        entryId: String,
        currentCatalogId: String?,
        onComplete: (Boolean, String?) -> Unit
    ) {
        viewModelScope.launch {
            recognitionRepository.deleteEntry(entryId)
                .onSuccess {
                    loadCatalogs()
                    currentCatalogId?.let { loadCatalogDetail(it) }
                    onComplete(true, null)
                }
                .onFailure { error ->
                    Log.e(TAG, "Failed to delete entry", error)
                    onComplete(false, error.message)
                }
        }
    }

    private fun applyCatalogData(data: CatalogData?) {
        _catalogDetail.value = data?.let(::dedupeCatalogEntries)
    }

    private fun dedupeCatalogEntries(data: CatalogData): CatalogData {
        val dedupedEntries = data.entries?.let { list ->
            val seen = LinkedHashSet<String>()
            list.filter { entry ->
                val key = buildString {
                    append(entry.entry._id ?: "")
                    append("|")
                    append(entry.linkedAt ?: "")
                }
                seen.add(key)
            }
        }
        return data.copy(entries = dedupedEntries)
    }

    private fun handleEntriesUpdated(event: CatalogSocketEvent.EntriesUpdated) {
        val current = _catalogDetail.value ?: return
        if (current.catalog._id != event.catalogId) {
            return
        }
        val updated = current.copy(entries = event.entries)
        applyCatalogData(updated)
    }

    private fun handleMetadataUpdated(event: CatalogSocketEvent.MetadataUpdated) {
        val updatedCatalog = event.catalog
        _catalogs.value = _catalogs.value.map { catalog ->
            if (catalog._id == updatedCatalog._id) updatedCatalog else catalog
        }

        val current = _catalogDetail.value
        if (current?.catalog?._id == event.catalogId) {
            val updated = current.copy(catalog = updatedCatalog)
            applyCatalogData(updated)
        }
    }

    private fun logCatalogError(message: String, throwable: Throwable) {
        Log.e(TAG, message, throwable)
    }

    private fun handleCatalogDeleted(event: CatalogSocketEvent.CatalogDeleted) {
        val removedId = event.catalogId
        _catalogs.value = _catalogs.value.filterNot { it._id == removedId }
        if (activeCatalogId == removedId) {
            activeCatalogId = null
            _catalogDetail.value = null
        }
        socketService.leaveCatalog(removedId)
    }

    override fun onCleared() {
        activeCatalogId?.let { socketService.leaveCatalog(it) }
        super.onCleared()
    }
}
