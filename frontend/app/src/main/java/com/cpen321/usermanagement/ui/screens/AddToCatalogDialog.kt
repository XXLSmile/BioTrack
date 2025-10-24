package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel


data class CatalogOption(

    val id: String,
    val name: String
)
@Composable
fun AddToCatalogDialog(
    viewModel: CatalogViewModel,
    isSaving: Boolean,
    onSave: (catalogId: String) -> Unit,
    onDismiss: () -> Unit,
    excludeCatalogId: String? = null,
    additionalCatalogs: List<CatalogOption> = emptyList()
) {
    val catalogs by viewModel.catalogs.collectAsState()
    val combinedCatalogs = remember(catalogs, additionalCatalogs, excludeCatalogId) {
        val base = catalogs.map { CatalogOption(it._id, it.name) }
            .filter { it.id != excludeCatalogId }
        val extras = additionalCatalogs.filter { option ->
            option.id != excludeCatalogId && base.none { it.id == option.id }
        }
        (base + extras).distinctBy { it.id }
    }
    var selectedCatalogId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(combinedCatalogs) {
        if (selectedCatalogId == null && combinedCatalogs.isNotEmpty()) {
            selectedCatalogId = combinedCatalogs.first().id
        } else if (selectedCatalogId != null && combinedCatalogs.none { it.id == selectedCatalogId }) {
            selectedCatalogId = combinedCatalogs.firstOrNull()?.id
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    selectedCatalogId?.let { onSave(it) }
                },
                enabled = selectedCatalogId != null && !isSaving
            ) {
                if (isSaving) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp
                        )
                        Text("Saving…")
                    }
                } else {
                    Text("Save")
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = {
                    if (!isSaving) {
                        onDismiss()
                    }
                },
                enabled = !isSaving
            ) { Text("Cancel") }
        },
        title = { Text("Save to Catalog") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (combinedCatalogs.isEmpty()) {
                    Text("No available catalogs. Create a new one first!")
                } else {
                    combinedCatalogs.forEach { catalog ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            RadioButton(
                                selected = selectedCatalogId == catalog.id,
                                onClick = { selectedCatalogId = catalog.id }
                            )
                            Text(catalog.name)
                        }
                    }
                }
            }
        }
    )
}