<div align="center">

# BioTrack – Wildlife Scanner & Collection App

Identify wildlife from photos, map your sightings, and build shared catalogs with friends – powered by an Android client, a TypeScript/Express backend, and external recognition + mapping APIs.

</div>

---

## Table of Contents

- [BioTrack – Wildlife Scanner \& Collection App](#biotrack--wildlife-scanner--collection-app)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Architecture](#architecture)
  - [Features](#features)
  - [Tech Stack](#tech-stack)
  - [Getting Started](#getting-started)
    - [Backend (Node.js / Express)](#backend-nodejs--express)
      - [Prerequisites](#prerequisites)
      - [Setup](#setup)
      - [Run](#run)
    - [Frontend (Android / Kotlin)](#frontend-android--kotlin)
      - [Prerequisites](#prerequisites-1)
      - [Setup](#setup-1)
      - [Build \& Run](#build--run)
  - [Running the Full System](#running-the-full-system)
  - [API Overview](#api-overview)
  - [Testing](#testing)
    - [Backend](#backend)
    - [Frontend](#frontend)
  - [Project Documentation](#project-documentation)

---

## Overview

BioTrack is built for hikers, tourists, birdwatchers, and researchers who want to:

- Quickly identify plants, animals, and insects from photos.
- Store observations (species, time, and location) in personal catalogs.
- Collaborate with friends through shared catalogs and social features.

The app combines on-device photo capture, a recognition backend, and social collaboration tools to make biodiversity tracking approachable for both casual users and scientists.

---

## Architecture

This repository is a mono-repo containing:

- `backend/` – TypeScript/Express API
  - Handles authentication (Google Sign-In + JWT).
  - Manages users, friends, catalogs, and observations.
  - Integrates with external recognition and geocoding APIs.
  - Exposes REST endpoints under `/api`.
- `frontend/` – Android app (Kotlin)
  - Captures or uploads wildlife photos.
  - Calls the backend API for recognition and catalog actions.
  - Displays maps and location metadata for observations.
  - Supports social features like friends and shared catalogs.
- `documentation/` – Course deliverables
  - Requirements, design, testing, and review reports.

High level flow:

1. User signs in with Google on the Android app.
2. App sends photos and metadata to the backend.
3. Backend forwards to the external recognition API and geocoding services.
4. Results are stored in MongoDB and shown in personal or shared catalogs.

---

## Features

- **Google authentication** – Sign up/sign in with Google; remove account at any time.
- **Wildlife recognition** – Upload or capture an image and get a predicted species with confidence and alternatives.
- **Catalogs** – Organize sightings into catalogs with species, timestamps, and locations.
- **Shared catalogs** – Collaborate with friends; edit catalogs together in real time.
- **Friends & recommendations** – Search and add friends, manage requests, and get friend suggestions.
- **Maps & locations** – Plot observations using Google Maps tiles and geocoding.
- **Notifications** – Receive push notifications for friend requests and key events.

---

## Tech Stack

- **Frontend**
  - Android, Kotlin
  - Android SDK 33+
  - Google Maps SDK
  - Firebase (Cloud Messaging, other services)

- **Backend**
  - Node.js 20+, TypeScript, Express
  - MongoDB (Atlas or local)
  - Socket.IO for live updates
  - External recognition API (Zyla Labs Animal Recognition)
  - Google APIs (Geocoding, Identity)

- **Tooling**
  - Jest for unit and integration tests
  - Prettier for formatting
  - Docker & docker-compose for containerized backend

---

## Getting Started

### Backend (Node.js / Express)

#### Prerequisites

- Node.js 20+ (tested with v20 and v22)
- npm 9+
- MongoDB instance (local or hosted)
- Google OAuth client ID for sign-in

#### Setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/biotrack
GOOGLE_CLIENT_ID=<your-google-client-id>
JWT_SECRET=<random-long-secret>
# Google Geocoding / Maps API key
GOOGLE_GEOCODING_API_KEY=<your-google-geocoding-or-maps-api-key>
```

If you are using external services (recognition, geocoding, Firebase, etc.), add the corresponding keys here as well.

#### Run

```bash
# Type-check & build
npm run build

# Development (watch mode)
npm run dev

# Production build + start
npm run build
npm start
```

By default the API is served at:

- Base URL: `http://localhost:3000`
- REST prefix: `http://localhost:3000/api`

You can also use the provided `Dockerfile` / `docker-compose.yml` in `backend/` to containerize the service.

---

### Frontend (Android / Kotlin)

Detailed setup instructions are in `frontend/README.md`. The summary is below.

#### Prerequisites

- Android Studio (latest)
- Java 11 or higher
- Android SDK with API level 33+ (Android 13)
- Kotlin 2.0.0
- Gradle 8.6.1+

#### Setup

1. Open `frontend/` in Android Studio.
2. Let Android Studio sync Gradle and download dependencies (or run `./gradlew build` once).
3. Ensure you have an emulator/device with Android 13 (API level 33).
4. Update `local.properties` in `frontend/` with your paths and API configuration:

   ```properties
   sdk.dir=/path/to/Android/Sdk
   API_BASE_URL="http://10.0.2.2:3000/api/"
   IMAGE_BASE_URL="http://10.0.2.2:3000/"
   GOOGLE_CLIENT_ID="xxxxxxx.apps.googleusercontent.com"
   MAPS_API_KEY="your-google-maps-api-key"
   ```

   - On a physical device, replace `10.0.2.2` with your machine’s LAN IP.

5. Ensure Google Play Services are up to date on the emulator (for Google Sign-In).

#### Build & Run

- **Debug**: Use the green “Run” button in Android Studio to build and deploy to an emulator/device.
- **Release**: Build → Generate Signed Bundle / APK → APK, then install the generated APK manually.

---

## Running the Full System

1. **Start MongoDB** (local or configure Atlas connection).
2. **Start the backend**: `cd backend && npm run dev` (or `npm start` after `npm run build`).
3. **Configure the Android app**:
   - Point `API_BASE_URL` and `IMAGE_BASE_URL` to the backend.
   - Ensure `GOOGLE_CLIENT_ID` matches the backend configuration.
4. **Run the Android app** on an emulator or device.

At this point you should be able to:

- Sign in with Google.
- Capture or upload wildlife photos.
- View recognition results and save them into catalogs.
- Add friends and share catalogs/observations.

---

## API Overview

The backend exposes REST endpoints under `/api`. Full details (paths, methods, example payloads) are documented in `backend/Endpoints.md`. The main groups are:

- **Authentication** (`/api/auth`)
  - `POST /signup`, `POST /signin`, `POST /logout`
- **User** (`/api/user`)
  - Manage profile, stats, favorite species, and user lookup.
- **Recognition** (`/api/recognition`)
  - Upload images for recognition, save observations, re-run recognition, and fetch recent entries.
- **Friends** (`/api/friends`)
  - List friends, send/accept/decline friend requests, and unfriend.
- **Catalogs** (`/api/catalogs`)
  - Create/update/delete catalogs, link/unlink entries, and manage sharing/collaborators.

For quick manual testing, you can use Postman or cURL as described at the bottom of `backend/Endpoints.md`.

---

## Testing

### Backend

From `backend/`:

```bash
# Unit & integration tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Non-functional requirement tests
npm run test:nfr
```

### Frontend

Run Android instrumentation/unit tests from Android Studio using the standard test runner, or via Gradle tasks (`./gradlew test` / `./gradlew connectedAndroidTest`).

---

## Project Documentation

Additional design and process documentation is available in `documentation/`:

- `Requirements_and_Design.md` – Functional & non-functional requirements, use cases, and architecture.
- `M3_DevelopmentInfo.md` – Deployment details and scope alignment.
- `Testing_And_Code_Review.md` – Test strategy, coverage, and review process.
- `M4_RinkRivals_Review.md` – Peer review and reflection.

These documents give more context on design decisions, API choices, and quality practices used in BioTrack.
