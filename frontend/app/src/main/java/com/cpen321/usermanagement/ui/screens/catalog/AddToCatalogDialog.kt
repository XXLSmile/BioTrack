package com.cpen321.usermanagement.ui.screens.catalog

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogViewModel


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
        buildCatalogOptions(catalogs, additionalCatalogs, excludeCatalogId)
    }
    var selectedCatalogId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(combinedCatalogs) {
        selectedCatalogId = resolveInitialSelection(selectedCatalogId, combinedCatalogs)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            AddCatalogConfirmButton(
                isSaving = isSaving,
                canSave = selectedCatalogId != null,
                onConfirm = { selectedCatalogId?.let(onSave) }
            )
        },
        dismissButton = {
            TextButton(onClick = { if (!isSaving) onDismiss() }, enabled = !isSaving) {
                Text("Cancel")
            }
        },
        title = { Text("Save to Catalog") },
        text = {
            CatalogOptionsList(
                catalogs = combinedCatalogs,
                selectedId = selectedCatalogId,
                onSelect = { selectedCatalogId = it }
            )
        }
    )
}

@Composable
private fun AddCatalogConfirmButton(
    isSaving: Boolean,
    canSave: Boolean,
    onConfirm: () -> Unit
) {
    TextButton(onClick = onConfirm, enabled = canSave && !isSaving) {
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
}

@Composable
private fun CatalogOptionsList(
    catalogs: List<CatalogOption>,
    selectedId: String?,
    onSelect: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (catalogs.isEmpty()) {
            Text("No available catalogs. Create a new one first!")
            return
        }
        catalogs.forEach { catalog ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                RadioButton(
                    selected = selectedId == catalog.id,
                    onClick = { onSelect(catalog.id) }
                )
                Text(catalog.name)
            }
        }
    }
}

private fun buildCatalogOptions(
    baseCatalogs: List<Catalog>,
    additionalCatalogs: List<CatalogOption>,
    excludeCatalogId: String?
): List<CatalogOption> {
    val base = baseCatalogs
        .map { CatalogOption(it._id, it.name) }
        .filter { it.id != excludeCatalogId }
    val extras = additionalCatalogs.filter { option ->
        option.id != excludeCatalogId && base.none { it.id == option.id }
    }
    return (base + extras).distinctBy { it.id }
}

private fun resolveInitialSelection(
    currentSelection: String?,
    catalogs: List<CatalogOption>
): String? {
    return when {
        catalogs.isEmpty() -> null
        currentSelection == null -> catalogs.first().id
        catalogs.none { it.id == currentSelection } -> catalogs.firstOrNull()?.id
        else -> currentSelection
    }
}
