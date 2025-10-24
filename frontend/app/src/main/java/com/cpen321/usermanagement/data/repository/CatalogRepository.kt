package com.cpen321.usermanagement.data.repository

import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogData
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.data.model.InviteCollaboratorBody
import com.cpen321.usermanagement.data.model.RespondInvitationBody
import com.cpen321.usermanagement.data.model.UpdateCollaboratorBody
import com.cpen321.usermanagement.data.remote.api.CatalogApi
import javax.inject.Inject

class CatalogRepository @Inject constructor(
    private val api: CatalogApi
) {

    suspend fun getCatalogs(): List<Catalog> {
        val response = api.listCatalogs()
        return response.body()?.data?.catalogs ?: emptyList()
    }

    suspend fun createCatalog(name: String, description: String? = null): Catalog? {
        val payload = mutableMapOf("name" to name)
        if (!description.isNullOrBlank()) {
            payload["description"] = description
        }
        val response = api.createCatalog(payload)
        return response.body()?.data?.catalog
    }

    suspend fun linkEntryToCatalog(catalogId: String, entryId: String): CatalogData? {
        val response = api.linkEntry(catalogId, entryId)
        return response.body()?.data
    }

    suspend fun unlinkEntryFromCatalog(catalogId: String, entryId: String): CatalogData? {
        val response = api.unlinkEntry(catalogId, entryId)
        return response.body()?.data
    }

    suspend fun getCatalogById(catalogId: String): com.cpen321.usermanagement.data.model.CatalogData? {
        val response = api.getCatalog(catalogId)
        return response.body()?.data
    }


    suspend fun listCollaborators(catalogId: String): Result<List<CatalogShareEntry>> = runCatching {
        val response = api.listCollaborators(catalogId)
        if (response.isSuccessful) {
            response.body()?.data?.collaborators ?: emptyList()
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to load collaborators")
        }
    }

    suspend fun inviteCollaborator(
        catalogId: String,
        inviteeId: String,
        role: String
    ): Result<CatalogShareEntry?> = runCatching {
        val response = api.inviteCollaborator(catalogId, InviteCollaboratorBody(inviteeId, role))
        if (response.isSuccessful) {
            response.body()?.data?.invitation
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to invite collaborator")
        }
    }

    suspend fun updateCollaborator(
        catalogId: String,
        shareId: String,
        role: String? = null,
        action: String? = null
    ): Result<CatalogShareEntry?> = runCatching {
        val response = api.updateCollaborator(catalogId, shareId, UpdateCollaboratorBody(role = role, action = action))
        if (response.isSuccessful) {
            response.body()?.data?.invitation
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to update collaborator")
        }
    }

    suspend fun listSharedWithMe(): Result<List<CatalogShareEntry>> = runCatching {
        val response = api.listSharedWithMe()
        if (response.isSuccessful) {
            response.body()?.data?.shares ?: emptyList()
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to load shared catalogs")
        }
    }

    suspend fun listPendingInvitations(): Result<List<CatalogShareEntry>> = runCatching {
        val response = api.listPendingInvitations()
        if (response.isSuccessful) {
            response.body()?.data?.shares ?: emptyList()
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to load invitations")
        }
    }

    suspend fun respondToInvitation(shareId: String, action: String): Result<CatalogShareEntry?> = runCatching {
        val response = api.respondToInvitation(shareId, RespondInvitationBody(action))
        if (response.isSuccessful) {
            response.body()?.data?.invitation
        } else {
            throw Exception(response.errorBody()?.string() ?: "Failed to respond to invitation")
        }
    }

    suspend fun deleteCatalog(catalogId: String): Boolean {
        return try {
            val response = api.deleteCatalog(catalogId)
            response.isSuccessful
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

}
