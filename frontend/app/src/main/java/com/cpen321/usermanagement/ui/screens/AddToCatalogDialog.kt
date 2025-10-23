package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel

@Composable
fun AddToCatalogDialog(
    viewModel: CatalogViewModel,
    isSaving: Boolean,
    onSave: (catalogId: String) -> Unit,
    onDismiss: () -> Unit
) {
    val catalogs by viewModel.catalogs.collectAsState()
    var selectedCatalogId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(catalogs) {
        if (selectedCatalogId == null && catalogs.isNotEmpty()) {
            selectedCatalogId = catalogs.first()._id
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
                if (catalogs.isEmpty()) {
                    Text("No catalogs yet. Create one first!")
                } else {
                    catalogs.forEach { catalog ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            RadioButton(
                                selected = selectedCatalogId == catalog._id,
                                onClick = { selectedCatalogId = catalog._id }
                            )
                            Text(catalog.name)
                        }
                    }
                }
            }
        }
    )
}
