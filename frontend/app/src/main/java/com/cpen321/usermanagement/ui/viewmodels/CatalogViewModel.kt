package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class Catalog(
    val id: String,
    val name: String,
    val entries: MutableList<CatalogEntry> = mutableListOf()
)

data class CatalogEntry(
    val id: String,
    val speciesName: String,
    val description: String,
    val imageUrl: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val location: String? = null
)

@HiltViewModel
class CatalogViewModel @Inject constructor() : ViewModel() {

    private val _catalogs = MutableStateFlow<List<Catalog>>(emptyList())
    val catalogs: StateFlow<List<Catalog>> = _catalogs.asStateFlow()

    init {
        loadSampleCatalogs()
    }

    private fun loadSampleCatalogs() {
        viewModelScope.launch {
            _catalogs.value = listOf(
                Catalog(
                    id = "1",
                    name = "Birds of Summer",
                    entries = mutableListOf(
                        CatalogEntry(
                            id = UUID.randomUUID().toString(),
                            speciesName = "Blue Jay",
                            description = "A bright blue songbird with a noisy call.",
                            imageUrl = null,
                            location = "Backyard"
                        )
                    )
                ),
                Catalog(
                    id = "2",
                    name = "Forest Mammals",
                    entries = mutableListOf()
                )
            )
        }
    }

    fun createCatalog(name: String) {
        val newCatalog = Catalog(
            id = UUID.randomUUID().toString(),
            name = name
        )
        _catalogs.value = _catalogs.value + newCatalog
    }

    fun deleteCatalog(catalogId: String) {
        _catalogs.value = _catalogs.value.filterNot { it.id == catalogId }
    }

    fun getCatalogById(catalogId: String) = flowOf(
        _catalogs.value.find { it.id == catalogId }
    )

    fun addEntryToCatalog(
        catalogId: String,
        speciesName: String,
        description: String,
        imageUrl: String? = null,
        location: String? = null
    ) {
        val updated = _catalogs.value.map { catalog ->
            if (catalog.id == catalogId) {
                val newEntry = CatalogEntry(
                    id = UUID.randomUUID().toString(),
                    speciesName = speciesName,
                    description = description,
                    imageUrl = imageUrl,
                    location = location
                )
                catalog.copy(entries = (catalog.entries + newEntry).toMutableList())
            } else catalog
        }
        _catalogs.value = updated
    }
}
