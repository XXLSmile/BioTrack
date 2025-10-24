package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogData
import com.cpen321.usermanagement.data.repository.CatalogRepository
import com.cpen321.usermanagement.data.repository.RecognitionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.util.LinkedHashSet

@HiltViewModel
class CatalogViewModel @Inject constructor(
    private val repository: CatalogRepository,
    private val recognitionRepository: RecognitionRepository
) : ViewModel() {

    private val _catalogs = MutableStateFlow<List<Catalog>>(emptyList())
    val catalogs: StateFlow<List<Catalog>> = _catalogs.asStateFlow()

    // NEW: catalog detail state (contains catalog + entries for a single catalog)
    private val _catalogDetail = MutableStateFlow<CatalogData?>(null)
    val catalogDetail: StateFlow<CatalogData?> = _catalogDetail.asStateFlow()

    init {
        loadCatalogs()
    }

    fun loadCatalogs() {
        viewModelScope.launch {
            try {
                _catalogs.value = repository.getCatalogs()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun createCatalog(name: String, description: String? = null) {
        viewModelScope.launch {
            try {
                println("Attempting to create catalog: $name")
                val created = repository.createCatalog(name, description)
                println("Created catalog: $created") 
                if (created != null) {
                    _catalogs.value = _catalogs.value + created
                } else {
                    println("Catalog creation failed (null returned)")
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }


    fun loadCatalogDetail(catalogId: String) {
        viewModelScope.launch {
            try {
                val detail = repository.getCatalogById(catalogId)
                applyCatalogData(detail)
            } catch (e: Exception) {
                e.printStackTrace()
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
                }
            } catch (e: Exception) {
                e.printStackTrace()
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
                    else -> loadCatalogDetail(currentCatalogId)
                }
                onComplete(true, null)
            } catch (e: Exception) {
                e.printStackTrace()
                onComplete(false, e.message)
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
            } catch (e: Exception) {
                e.printStackTrace()
                onComplete(false, e.message)
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
                    error.printStackTrace()
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
                    append("|")
                    append(entry.entry.imageUrl ?: "")
                }
                seen.add(key)
            }
        }
        return data.copy(entries = dedupedEntries)
    }

}
