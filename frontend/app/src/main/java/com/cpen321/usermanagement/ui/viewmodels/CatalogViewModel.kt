package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogData
import com.cpen321.usermanagement.data.repository.CatalogRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.util.LinkedHashSet

@HiltViewModel
class CatalogViewModel @Inject constructor(
    private val repository: CatalogRepository
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


    fun linkEntryToCatalog(catalogId: String, entryId: String) {
        viewModelScope.launch {
            try {
                val success = repository.linkEntryToCatalog(catalogId, entryId)
                if (success) {
                    loadCatalogs() // refresh
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
                _catalogDetail.value = detail?.let { data ->
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
                    data.copy(entries = dedupedEntries)
                }
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

}
