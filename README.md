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


### **3.2. Use Case Diagram**


### **3.3. Actors Description**
1. **User**: The primary actor who interacts with the BioTrack app. Users can scan wildlife, view identifications, save observations to catalogs, manage their collections, and optionally share findings with friends or collaborators.
2. **External Authentication Service**: A third-party provider that verifies a user’s identity and manages secure login and account syncing across devices.
3. **External Image Recognition Service**: An API that processes photos uploaded by the user and returns likely species identifications along with confidence scores.
4. **Push Notification Service**: A cloud-based service that delivers real-time alerts to users such as friend activity updates.

### **3.4. Use Case Description**
- Use cases for feature 1: [WRITE_FEATURE_1_NAME_HERE]
1. **[WRITE_NAME_HERE]**: ...
2. **[WRITE_NAME_HERE]**: ...
- Use cases for feature 2: [WRITE_FEATURE_2_NAME_HERE]
3. **[WRITE_NAME_HERE]**: ...
4. **[WRITE_NAME_HERE]**: ...
...

### **3.5. Formal Use Case Specifications (5 Most Major Use Cases)**
<a name="uc1"></a>

#### Use Case 1: [WRITE_USE_CASE_1_NAME_HERE]

**Description**: ...

**Primary actor(s)**: ... 
    
**Main success scenario**:
1. ...
2. ...

**Failure scenario(s)**:
- 1a. ...
    - 1a1. ...
    - 1a2. ...

- 1b. ...
    - 1b1. ...
    - 1b2. ...
                
- 2a. ...
    - 2a1. ...
    - 2a2. ...

...

<a name="uc2"></a>

#### Use Case 2: [WRITE_USE_CASE_2_NAME_HERE]
...

### **3.6. Screen Mock-ups**


### **3.7. Non-Functional Requirements**
<a name="nfr1"></a>

1. **[WRITE_NAME_HERE]**
    - **Description**: ...
    - **Justification**: ...
2. ...

---

## 4. Designs Specification
### **4.1. Main Components**
1. **Species Identification**
    - **Purpose**: Receives an uploaded photo and returns the most likely species with confidence scores and metadata. It abstracts over multiple image recognition APIs and caches frequent results to reduce latency and cost.
    - **Interfaces**: 
        1. `POST /identify`
            - **Purpose**: Run identification, normalize API responses, persist a summarized species candidate set, and return top results along with relavant info.
2. **Catalog**
    - **Purpose**: Creates and manages a user’s catalog of sightings, and maintains a list of unique species seen. Keeps domain logic server-side for consistency and offline-friendly syncing; cleaner than pushing all logic to the client.
    - **Interfaces**: 
        1. `POST /sightings`
            - **Purpose**: Create a sighting from an identification result, stores data like image, location, time, etc.
        2. `GET /sightings?user_id=…`
            - **Purpose**: List/filter a user’s sightings with pagination and bounding-box map filters.
        3. `GET /collection/summary`
            - **Purpose**: Return aggregates (unique species count, streaks, badges progress).
3. **User**
    - **Purpose**: Handles user profiles, OAuth login, friends.
    - **Interfaces**:
        1. `GET /me`
            - **Purpose**: Return the authenticated user profile and settings.
        2. `POST /friends/{add|accept|remove}`
            - **Purpose**: Manage friend relationships.



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
    - **Reason**: Streamlines delivery without relying on disallowed managed back-ends; improves reliability for grading.


### **4.5. Dependencies Diagram**

![dependicies_diagram](documentation/images/CPEN321M2-DependencyDiagram.drawio.pdf)

### **4.6. Use Case Sequence Diagram (5 Most Major Use Cases)**
1. [**[WRITE_NAME_HERE]**](#uc1)\
[SEQUENCE_DIAGRAM_HERE]
2. ...


### **4.7. Design and Ways to Test Non-Functional Requirements**
1. [**[WRITE_NAME_HERE]**](#nfr1)
    - **Validation**: ...
2. ...
