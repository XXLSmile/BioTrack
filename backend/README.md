# BioTrack Backend

TypeScript/Express API for the BioTrack wildlife recognition app.  
The service handles Google-based authentication, user profiles, species recognition via iNaturalist, and catalog management.

---

## Getting Started

### Prerequisites
- Node.js 20+ (tested with v20 and v22)
- npm 9+
- MongoDB instance (local or hosted)
- Google OAuth client (to verify ID tokens)

### Installation
```bash
cd backend
npm install
```

Create a `.env` file in `backend/` with at least:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/biotrack
GOOGLE_CLIENT_ID=<your-google-client-id>
JWT_SECRET=<random-long-secret>
```

### Run
```bash
# Type-check
npm run build

# Development (ts-node + nodemon)
npm run dev

# Production build + start
npm run build
npm start
```

API is served beneath `http://localhost:3000/api` by default.

---

## Authentication

All protected routes require `Authorization: Bearer <JWT>` issued by the sign-in endpoint.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | No | Accepts a Google ID token, creates a user, returns JWT + profile. |
| POST | `/api/auth/signin` | No | Validates an existing user with Google ID token, returns JWT + profile. |
| POST | `/api/auth/logout` | Yes | Placeholder logout; returns message (token invalidation not persisted). |

**Request** (`/api/auth/signup` & `/signin`)
```json
{
  "idToken": "google-oauth-id-token"
}
```

**Response**
```json
{
  "message": "User signed in successfully",
  "data": {
    "token": "jwt-token",
    "user": {
      "_id": "...",
      "email": "user@example.com",
      "name": "User Name",
      "username": "username",
      "observationCount": 0,
      "speciesDiscovered": 0,
      "friendCount": 0,
      "badges": [],
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

## User Routes (`/api/user`) – Auth Required

| Method | Path | Body / Query | Description |
| --- | --- | --- | --- |
| GET | `/profile` | — | Current user profile. |
| POST | `/profile` | `{ name?, username?, location?, region?, isPublicProfile?, favoriteSpecies?[] }` | Update profile fields. |
| DELETE | `/profile` | — | Permanently delete the user account. |
| GET | `/stats` | — | Observation, species, friend counts, badges. |
| GET | `/check-username` | `?username=john_doe` | Validate availability & format. |
| GET | `/search` | `?query=alex` | Public profile search by name. |
| GET | `/username/:username` | — | Fetch profile by username (respects privacy). |
| GET | `/profile/:username` | — | Alternate route to fetch by display name. |
| GET | `/name/:username` | — | Case-insensitive name lookup. |
| GET | `/:userId` | — | Fetch by Mongo `_id`. |
| POST | `/favorite-species` | `{ "speciesName": "American Robin" }` | Add species to favorites. |
| DELETE | `/favorite-species` | `{ "speciesName": "American Robin" }` | Remove species from favorites. |

All responses follow:
```json
{
  "message": "Some status text",
  "data": { ... } // when applicable
}
```

---

## Recognition Routes (`/api/recognition`)

| Method | Path | Auth | Body | Description |
| --- | --- | --- | --- | --- |
| POST | `/` | No | `multipart/form-data` field `image` (+ optional `latitude`, `longitude`) | Runs iNaturalist image recognition and returns candidate species. |
| POST | `/save` | Yes | Same form-data | Recognize, persist catalog entry (stores image, metadata). |
| GET | `/catalog` | Yes | — | Shortcut to fetch the authenticated user’s catalog entries. |
| GET | `/image/:entryId` | Yes | — | Streams stored image buffer for a catalog entry. |

**Recognition success response**
```json
{
  "message": "Species recognized successfully",
  "data": {
    "species": {
      "id": 12345,
      "scientificName": "Corvus brachyrhynchos",
      "commonName": "American Crow",
      "rank": "species",
      "taxonomy": "Aves",
      "wikipediaUrl": "https://en.wikipedia.org/wiki/American_crow",
      "imageUrl": "https://..."
    },
    "confidence": 0.91,
    "alternatives": [
      {
        "scientificName": "...",
        "commonName": "...",
        "confidence": 0.42
      }
    ]
  }
}
```

`/save` returns:
```json
{
  "message": "Species recognized and saved to catalog successfully",
  "data": {
    "catalogEntry": { ... },
    "recognition": { ...same as above... }
  }
}
```

---

## Friend Routes (`/api/friends`) – Auth Required

| Method | Path | Body / Query | Description |
| --- | --- | --- | --- |
| GET | `/` | — | List friends (accepted friendships) with basic profile info. |
| GET | `/requests` | `?type=incoming` (default) or `type=outgoing` | List pending incoming or outgoing requests. |
| POST | `/requests` | `{ "targetUserId": "<userId>" }` | Send a friend request to another user. |
| PATCH | `/requests/:requestId` | `{ "action": "accept" \| "decline" }` | Respond to a pending friend request. |
| DELETE | `/:friendshipId` | — | Remove an existing friendship. |

**Send request example**
```json
POST /api/friends/requests
{
  "targetUserId": "665fa4c12f5eab3c6a02d917"
}
```

**Accept request example**
```json
PATCH /api/friends/requests/665fb1bf2f5eab3c6a02d920
{
  "action": "accept"
}
```

Responses follow the standard pattern:
```json
{
  "message": "Friend request sent successfully",
  "data": {
    "request": {
      "_id": "...",
      "requester": "...",
      "addressee": "...",
      "status": "pending",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

## Catalog Routes (`/api/catalogs`) – Auth Required

| Method | Path | Body | Description |
| --- | --- | --- | --- |
| GET | `/` | — | List user’s catalogs. |
| POST | `/` | `{ "name": "Spring Birds", "description": "..." }` | Create catalog. |
| GET | `/:catalogId` | — | Retrieve catalog (with entries). |
| PATCH | `/:catalogId` | `{ "name"?, "description"?, "isPublic"?, ... }` | Update catalog. |
| DELETE | `/:catalogId` | — | Delete catalog and its entries. |
| POST | `/:catalogId/entries` | `{ speciesId, speciesName?, confidence?, notes?, latitude?, longitude?, capturedAt?, imageUrl? }` | Add observation entry. |
| PATCH | `/:catalogId/entries/:entryId` | `{ notes?, confidence?, latitude?, longitude?, capturedAt?, imageUrl? }` | Update entry. |
| DELETE | `/:catalogId/entries/:entryId` | — | Remove entry. |

Each catalog response:
```json
{
  "message": "Catalog created successfully",
  "data": {
    "catalog": {
      "_id": "...",
      "name": "Spring Birds",
      "description": "...",
      "userId": "...",
      "entries": [ ... ],
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

Entry response (`POST /entries` / `PATCH /entries/:entryId`):
```json
{
  "message": "Catalog entry added successfully",
  "data": {
    "catalog": {
      "_id": "...",
      "entries": [
        {
          "_id": "...",
          "speciesName": "American Crow",
          "confidence": 0.91,
          "notes": "Perched on cedar tree",
          "latitude": 49.28,
          "longitude": -123.12,
          "capturedAt": "2024-05-01T19:24:00.000Z",
          "createdAt": "...",
          "updatedAt": "..."
        }
      ]
    }
  }
}
```

---

## Admin (Dev-Only) Routes (`/api/admin`)

> These endpoints are intended for local testing and should be disabled in production.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/users` | List first 50 users (strips Google IDs). |
| GET | `/users/:userId` | Fetch a single user by ID. |
| GET | `/stats` | Basic database statistics. |
| POST | `/create-user` | Create a test user (see controller for payload). |

---

## Error Responses

Errors use standard HTTP codes with a JSON payload:
```json
{
  "message": "Human-readable explanation",
  "errors": [ ...optional field-wise details... ]
}
```

Validation errors come from Zod schemas in `validation.middleware.ts`.

---

## Testing With Postman / cURL
1. Sign up/sign in to retrieve the JWT.
2. Set `Authorization: Bearer <token>` for all protected routes.
3. Recognition endpoints require `multipart/form-data`; key must be named `image`.
4. For catalog entry creation via recognition, call `/api/recognition/save`.

---

## Project Scripts
| Command | Description |
| --- | --- |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm run start` | Run compiled JS from `dist/`. |
| `npm run dev` | Watch mode (ts-node + nodemon). |
| `npm run format` | Prettier check. |
| `npm run format:fix` | Prettier write. |
