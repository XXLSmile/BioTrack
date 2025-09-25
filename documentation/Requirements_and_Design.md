# Requirements and Design

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| _Nothing to show_ |

---

## 2. Project Description

BioTrack – Wildlife Scanner & Collection App

BioTrack is designed for hikers, tourists, birdwatchers, animal lovers, and scientists such as botanists, entomologists, and zoologists. These users often encounter plants, animals, or insects in the wild but struggle to identify and document them in a structured, accessible way. Existing solutions are either fragmented (separate apps for plants, birds, or insects) or too technical for casual users.

The project aims to bridge this gap by providing a simple yet powerful mobile app that allows users to scan and identify wildlife instantly, store observations in personal or shared catalogs, and view them on a map. This helps both casual explorers and professional researchers keep track of biodiversity, share findings with friends or collaborators, and learn more about the natural world around them.

---

## 3. Requirements Specification

### **3.1. List of Features**
1. **Authentication**: To access the app, a user must sign in using the Google authentication service. New users should sign up before signing in. An authenticated user can sign out. Users can also remove their account.
2. **Wildlife Recognition**: A user can scan and recognize wildlife using their devices camera. The app uses an external API to process the image and identify the wildlife species. When identified, the user can see basic information about the wildlife, like its name, habitat, rarity etc. The user can then catalog the species, or share the species directly with a friend(s).
3. **Catalog**: A user can create a catalog and save scanned wildlife to the catalog. Each entry contains information about the species and when and where the species was scanned. Users can make multiple catalogs as well as share catalogs with friends, where they can catalog entries in real time.
4. **Manage Friends**: A user can add friends by searching for their username. A user can view their friends list, accept friend requests and remove friends. Based on species catalogged by a user, friend reccommendations will be suggested to the user based on catalog similarity to other users.

### **3.2. Use Case Diagram**

![use_case_diagram](images/Use%20Case%20Diagram%20(CPEN)2.drawio.png)

### **3.3. Actors Description**
1. **User**: The primary actor who interacts with the BioTrack app. Users can scan wildlife, view identifications, save observations to catalogs, manage their collections, and optionally share findings with friends or collaborators.
2. **External Authentication Service**: A third-party provider that verifies a user’s identity and manages secure login and account syncing across devices.
3. **External Image Recognition Service**: An API that processes photos uploaded by the user and returns likely species identifications along with confidence scores.
4. **Push Notification Service**: A cloud-based service that delivers real-time alerts to users such as friend activity updates.

### **3.4. Use Case Description**
- Use cases for feature 1: Authentication
1. **Sign-Up**: Create an account by registering with google authentication before accessing the app.
2. **Sign-In**: An existing user logs into the app using their google account to access features
3. **Sign-Out**: The user logs out of the app by logging out of their google account
4. **Remove Account**: the user deletes their google account from the app.
- Use cases for feature 2: Wildlife Recognition
5. **Get Picture**: The user takes a photo of wildlife using the apps camera feature or uploads a photo already in device storage.
6. **Scan Picture**: The app scans the picture and identifies the wildlife and description of the wildlife (eg. species type, mammel, rarity, endarngered) using an external recognition API.
- Use cases for feature 3: Catalog
7. **Create Catalog**: The user creates a personal collection to store the picture taken of the wildlife as well as the time and location of the sighting and the description of the wildlife and organize by species encountered wildlife. The user can title catalogs and make mulitple catalogs
8. **Delete Catalog**: The user deletes their catalog, permanently removing all stored encounters in said catalog.
9. **Catalog Scanned Picture**: After scanning, the user saves the identified species along with the time and location of the sighting as well as a description of the species to their catalog.
- Use cases for feature 4: Manage Friends
10. **Share Catalog**: The user can share one or multiple of their catalogs with friends. Friends can view the catalog or, if the catalog owner gives permission for collaboration, friends can contribute their own pictures to the catalog. The owner of the catalog can revoke collaboration permissions and remove friends from a catalog at any time.
11. **Share Scanned Picture**: The user can share a single scanned wildlife picture as well a brief description of the scanned wildlife directly with friends. The users friends will get a push notification when a scanned picture is shared with them.
12. **Add Friends**: The user can send or accept friend requests to connect with other app users. Users can search for usernames to add friends as well as remove friends from their friendslist. When users search for friends, there will be a reccommended list of friends the user can add based on catalog similarity.

### **3.5. Formal Use Case Specifications (5 Most Major Use Cases)**
<a name="uc1"></a>

#### Use Case 1: Get Picture

**Description**: The user takes a photo of wildlife using the apps camera feature or uploads a photo already in device storage.

**Primary actor(s)**: User 

**Preconditions**: The user is logged into the app and camera permissions are granted.

**Postconditions**: A photo is successfully taken and stored in device storage, ready for scanning.
    
**Main success scenario**:
1. The user selects the “Get Picture” option.
2. The app opens the built in camera function.
3. The user points the camera at wildlife and captures a photo.
4. The system confirms the photo was taken and stores it for further processing.

**Failure scenario(s)**:
- 1a. Camera permissions are denied.
    - 1a1. The system prompts the user to enable permissions in settings.

- 2a. The user cancels without taking a photo.
    - 2a1. The system returns to the previous screen without saving anything.
                
- 3a. Device storage is full.
    - 3a1. The system displays an error message and discards the photo.

<a name="uc2"></a>

#### Use Case 2: Scan Picture

**Description**: The system analyzes the uploaded photo and identifies the wildlife using an external recognition API.

**Primary actor(s)**: User 

**Preconditions**: he user has a photo stored in device storage.

**Postconditions**: The identified wildlife and metadata are displayed to the user.
    
**Main success scenario**:
1. The user selects “Scan Picture.”
2. The system sends the picture to the external recognition API.
3. The API processes the picture and returns the wildlife identification with metadata.
4. The system displays the species name, picture, and description (eg. species type, mammel, rarity, endarngered).

**Failure scenario(s)**:
- 1a. No internet connection.
    - 1a1. The system displays an error and asks the user to reconnect.

- 2a. The API cannot recognize the wildlife.
    - 2a1. The system displays a message: “Species not found,” with an option to retry.
                
- 2b. API request times out.
    - 2b1. The system prompts the user to retry scanning later.

<a name="uc3"></a>

#### Use Case 3: Catalog Scanned Image

**Description**: After scanning, the user saves the identified species along with the time and location of the sighting as well as a description of the species to their catalog.

**Primary actor(s)**: User

**Preconditions**: The user has successfully scanned a picture and received identification results.

**Postconditions**: The wildlife and encounter details are stored in the catalog.
    
**Main success scenario**:
1. The user chooses “Save to Catalog.”
2. The system adds the entry (species + description) to the user’s catalog.

**Failure scenario(s)**:
- 1a. User does not have a catalog.
    - 1a1. The system prompts the user to create a catalog.

- 2a. User cancels before saving
    - 2a1. The system discards the scanned entry.
                
- 3a. Device storage or database write fails.
    - 3a1. The system displays an error message and does not save the entry.

<a name="uc4"></a>

#### Use Case 4: Add Friends

**Description**: The user can send or accept friend requests to connect with other app users. Users can search for usernames to add friends as well as remove friends from their friendslist. When users search for friends, there will be a reccommended list of friends the user can add based on catalog similarity.

**Primary actor(s)**: User 

**Preconditions**: The user is logged into the app.

**Postconditions**: The friend request is sent or accepted, and the new friend is added to the user’s friend list.
    
**Main success scenario**:
1. The user selects “Add Friend.”
2. The system prompts the user to enter a friend’s username.
3. The system searches and locates the account.
4. The user sends a friend request.
5. The recipient accepts the request.
6. Both users see each other in their friend lists.

**Failure scenario(s)**:
- 1a. No input provided.
    - 1a1. The system displays an error: “Please enter a username.”

- 2a. No account matches the input.
    - 2a1. The system displays: “No user found.”
                
- 3a. Recipient rejects or ignores request.
    - 3a1. The system informs the sender that the request was not accepted.

<a name="uc5"></a>

#### Use Case 5: Share Scanned Picture

**Description**: The user can share a single scanned wildlife picture as well a brief description of the scanned wildlife directly with friends. The users friends will get a push notification when a scanned picture is shared with them.

**Primary actor(s)**: User 

**Preconditions**: The user has at least one scanned picture in their collection.

**Postconditions**: The shared picture is sent, and friends can view it from a push notification.
    
**Main success scenario**:
1. The user selects a scanned picture from their catalog.
2. The user chooses the option “Share with Friends”
3. The system displays the users list of friends.
4. The user selects recipient(s) and confirms sharing.
5. The system sends notifications to the selected friend(s).
6. Recipients view the shared picture and its details.

**Failure scenario(s)**:
- 1a. User cancels before confirming share.
    - 1a1. The system aborts the operation.

- 2a. No friends or groups are selected.
    - 2a1. The system displays an error message: “Please select at least one recipient.”
                
- 3a. Notification delivery fails.
    - 3a1. The system retries sending, or displays an error if unsuccessful.
    
### **3.6. Screen Mock-ups**


### **3.7. Non-Functional Requirements**
<a name="nfr1"></a>

1. **Recognition Latency**
    - **Description**: The system must return wildlife recognition results within ≤ 5 seconds for 95% of scans.
    - **Justification**: Real-time wildlife identification is a core value proposition; if results take too long, the app feels unusable in outdoor/field settings. The 5-second threshold balances API response times, network variability, and user patience.
2. **Offline Functionality**
    - **Description**: The app must allow users to capture photos and store them locally offline, then automatically queue recognition requests once an internet connection is restored.
    - **Justification**: Wildlife encounters often happen in remote areas with limited connectivity. Ensuring offline support prevents missed captures and maintains trust in the app’s reliability.
3. **Privacy & Data Protection**
    - **Description**: All personal data (friend lists, catalog entries, location metadata) must be stored securely in the cloud database with encryption. Users must be able to delete all their data upon account removal.
    - **Justification**: Users are sharing sensitive data such as GPS-tagged wildlife encounters. Protecting this data ensures compliance with privacy standards (e.g., GDPR) and builds user trust.

---

## 4. Designs Specification
### **4.1. Main Components**
1. **Species Identification**
    - **Purpose**: Receives an uploaded photo and returns the most likely species with confidence scores and metadata. It abstracts over multiple image recognition APIs and caches frequent results to reduce latency and cost.
    - **Interfaces**: 
        1. **[name]**
            - **Purpose**:
2. **Catalog**
    - **Purpose**: Creates and manages a user’s catalog of sightings, and maintains a list of unique species seen. Keeps domain logic server-side for consistency and offline-friendly syncing; cleaner than pushing all logic to the client.
    - **Interfaces**: 
        1. **[name]**
            - **Purpose**:
3. **User**
    - **Purpose**: Handles user profiles, OAuth login, friends.
    - **Interfaces**:
        1. **[name]**
            - **Purpose**:



### **4.2. Databases**
**MySQL (self-hosted on cloud VM)**
    - **Purpose**: Primary relational store: `users`, `sessions`, `friends`, `species`, `sightings`, `photos`. Chosen over MongoDB to benefit from strong relational integrity for joins (e.g., user<-->sightings, species<-->sightings).


### **4.3. External Modules**
1. **iNaturalist / Pl@ntNet / Kindwise (image Recognition APIs)**
    - **Purpose**: Perform image-based species identification and return candidate species with scores; we normalize these to a unified schema. We believe domain-trained models outperform generic vision APIs; avoids training our own model within course scope.
2. **Google Map**
    - **Purpose**: Display and record locations. Mature SDKs, reliable tiles, and strong mobile support.
3. **Firebase Cloud Messaging**
    - **Purpose**: Push notifications for friend requests and catalog sharing.
4. **Google Authentication**
    - **Purpose**: Create accounts and manage login.



### **4.4. Frameworks**
1. **Android (Kotlin) + Jetpack Compose + CameraX**
    - **Purpose**: Native UI and camera capture that meet course constraints; Compose for UI, CameraX for image acquisition.
    - **Reason**: Compliant to syllabus.
2. **Node.js (TypeScript) + Express**
    - **Purpose**: Implement the RESTful APIs with typing and middleware ecosystem.
    - **Reason**: Compliant to syllabus, easy to test and deploy.
3. **Azure Virtual Machine (Ubuntu) + Docker**
    - **Purpose**: Cloud deployment of the Node/TS services and MySQL database on a self-managed VM; Nginx for TLS termination and static photo serving.
    - **Reason**: Cloud is required and free Azure service can be requested from course staff. Docker simplifies reproducible grading.
4. **GitHub Actions**
    - **Purpose**: Build/test pipelines for Android app and Node back end; push Docker images and perform zero-downtime deploys.
    - **Reason**: Streamlines deployment, improves efficiency.


### **4.5. Dependencies Diagram**

![dependencies_diagram](images/CPEN321M2-DependencyDiagramV2.drawio.png)

### **4.6. Use Case Sequence Diagram (5 Most Major Use Cases)**
1. [**[WRITE_NAME_HERE]**](#uc1)\
[SEQUENCE_DIAGRAM_HERE]
2. ...


### **4.7. Design and Ways to Test Non-Functional Requirements**
1. [**[WRITE_NAME_HERE]**](#nfr1)
    - **Validation**: ...
2. ...
