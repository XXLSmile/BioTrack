package com.cpen321.usermanagement.ui.components

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.style.TextAlign
import com.cpen321.usermanagement.BuildConfig
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import com.cpen321.usermanagement.data.model.Entry
import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.ui.screens.ObservationDetailContent
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun EntryDetailDialog(
    entry: RemoteCatalogEntry,
    isProcessing: Boolean,
    errorMessage: String?,
    canRemoveFromCatalog: Boolean,
    onDismiss: () -> Unit,
    onAddToCatalog: (() -> Unit)?,
    onRemoveFromCatalog: (() -> Unit)?,
    onDeleteEntry: (() -> Unit)?
) {
    val observation = entry.toRecentObservation()
    val linkedAt = entry.linkedAt?.let(::formatIsoToPrettyDate)

    AlertDialog(
        onDismissRequest = { if (!isProcessing) onDismiss() },
        confirmButton = {
            TextButton(
                onClick = {
                    if (!isProcessing) {
                        onDismiss()
                    }
                },
                enabled = !isProcessing
            ) {
                Text("Close")
            }
        },
        text = {
            val scrollState = rememberScrollState()
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                ObservationDetailContent(
                    observation = observation,
                    modifier = Modifier.fillMaxWidth()
                )

                linkedAt?.let {
                    Text(
                        text = "Linked: $it",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (!errorMessage.isNullOrBlank()) {
                    Text(
                        text = errorMessage,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center
                    )
                }

                HorizontalDivider()

                val actions = remember(onAddToCatalog, onRemoveFromCatalog, onDeleteEntry) {
                    listOfNotNull(
                        onAddToCatalog?.let { "add" to it },
                        if (canRemoveFromCatalog) onRemoveFromCatalog?.let { "remove" to it } else null,
                        onDeleteEntry?.let { "delete" to it }
                    )
                }

                if (actions.isNotEmpty()) {
                    var actionsExpanded by remember { mutableStateOf(false) }
                    LaunchedEffect(isProcessing) {
                        if (isProcessing) {
                            actionsExpanded = false
                        }
                    }

                    Box(
                        modifier = Modifier.fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        TextButton(
                            onClick = { actionsExpanded = true },
                            enabled = !isProcessing
                        ) {
                            Text("More actions")
                        }

                        DropdownMenu(
                            expanded = actionsExpanded,
                            onDismissRequest = { actionsExpanded = false }
                        ) {
                            actions.forEach { (key, action) ->
                                when (key) {
                                    "add" -> DropdownMenuItem(
                                        text = { Text("Add to another catalog") },
                                        onClick = {
                                            actionsExpanded = false
                                            action()
                                        },
                                        enabled = !isProcessing
                                    )

                                    "remove" -> DropdownMenuItem(
                                        text = { Text("Remove from this catalog") },
                                        onClick = {
                                            actionsExpanded = false
                                            action()
                                        },
                                        enabled = !isProcessing
                                    )

                                    "delete" -> DropdownMenuItem(
                                        text = {
                                            Text(
                                                text = "Delete observation",
                                                color = MaterialTheme.colorScheme.error
                                            )
                                        },
                                        onClick = {
                                            actionsExpanded = false
                                            action()
                                        },
                                        enabled = !isProcessing
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    )
}

@Composable
fun ConfirmEntryActionDialog(
    action: EntryAction,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    val (title, description, confirmText) = when (action) {
        is EntryAction.Remove -> Triple(
            "Remove observation",
            "Remove this observation from the current catalog? The observation will remain saved.",
            "Remove"
        )
        is EntryAction.Delete -> Triple(
            "Delete observation",
            "Delete this observation permanently? The observation will be removed from all catalogs.",
            "Delete"
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(description) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(confirmText)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

sealed interface EntryAction {
    val entry: RemoteCatalogEntry

    data class Remove(override val entry: RemoteCatalogEntry) : EntryAction
    data class Delete(override val entry: RemoteCatalogEntry) : EntryAction
}

fun formatIsoToPrettyDate(iso: String): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
        val date = sdf.parse(iso)
        val out = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
        out.format(date!!)
    } catch (e: Exception) {
        iso.take(10)
    }
}

fun RecentObservation.toCatalogEntry(): RemoteCatalogEntry {
    val entry = Entry(
        _id = id,
        species = title,
        confidence = confidence,
        imageUrl = imageUrl,
        userId = null,
        speciesId = null,
        imageMimeType = null,
        latitude = latitude,
        longitude = longitude,
        city = city,
        province = province,
        notes = notes,
        createdAt = createdAtIso,
        updatedAt = createdAtIso
    )
    return RemoteCatalogEntry(
        entry = entry,
        linkedAt = createdAtIso,
        addedBy = null
    )
}

fun RemoteCatalogEntry.toRecentObservation(): RecentObservation {
    val item = entry
    val resolvedImage = resolveImageUrl(item.imageUrl)
    val title = item.species?.takeIf { it.isNotBlank() } ?: "Observation"
    val subtitle = item.notes?.takeIf { it.isNotBlank() } ?: ""
    return RecentObservation(
        id = item._id,
        title = title,
        subtitle = subtitle,
        city = item.city,
        province = item.province,
        imageUrl = resolvedImage,
        notes = item.notes,
        confidence = item.confidence,
        latitude = item.latitude,
        longitude = item.longitude,
        speciesCommonName = item.species,
        speciesScientificName = item.species,
        createdAtIso = item.createdAt
    )
}

fun resolveImageUrl(rawUrl: String?): String? {
    if (rawUrl.isNullOrBlank()) return null

    val baseUrl = BuildConfig.IMAGE_BASE_URL.trimEnd('/')

    return try {
        val uri = Uri.parse(rawUrl)
        val host = uri.host?.lowercase(Locale.ROOT)
        when {
            uri.scheme.isNullOrBlank() -> {
                "$baseUrl/${rawUrl.trimStart('/')}"
            }
            host == "localhost" || host == "127.0.0.1" -> {
                val path = uri.path ?: ""
                val fullPath = if (path.startsWith("/")) path else "/$path"
                "$baseUrl$fullPath"
            }
            else -> rawUrl
        }
    } catch (e: Exception) {
        "$baseUrl/${rawUrl.trimStart('/')}"
    }
}
