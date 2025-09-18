# BioTrack

# Requirements and Design

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| | ||

---

## 2. Project Description

[WRITE_PROJECT_DESCRIPTION_HERE]

---

## 3. Requirements Specification

### **3.1. List of Features**

1. **Authentication**: To access app features, a user must Sign In using their using Google Authentication Service first. New users should Sign Up before Signing In. An authenticated user can Sign Out. Users can also remove their account and manage their profile information.

2. **Scan and Image recognition**: A user can use their device camera to capture photos of living creatures. The app processes these images using an external living creatures identification API to recognize and identify the species. The app displays the identification results including species name, scientific name, and relevant information about the animal. Users can save these identifications to their personal collection.

3. **Manage Friends**: A user can add friends by searching for other users or u. Users can create friend groups to organize their connections. A user can view their list of friends and groups. Users can also remove friends or leave groups they no longer wish to be part of.

4. **Friend Recommendation**: The app analyzes user living creatures catalogs and preferences to suggest potential friends with similar interests. Recommendations are based on catalog similarity, shared species encounters, and geographic proximity. Users can view recommended friends and choose to send friend requests or ignore recommendations.

5. **Sharing with Friends**: Users get instant notifications when friends discover rare creatures. They can search through their friends' community to see who found what and where it happened. The app shows a complete map of friends' creature encounters with locations, dates, and photos. Users can explore their friends' discovery history and stay updated on exciting rare finds in their network.


### **3.2. Use Case Diagram**


### **3.3. Actors Description**
1. **[WRITE_NAME_HERE]**: ...
2. **[WRITE_NAME_HERE]**: ...

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
1. **[WRITE_NAME_HERE]**
    - **Purpose**: ...
    - **Interfaces**: 
        1. ...
            - **Purpose**: ...
        2. ...
2. ...


### **4.2. Databases**
1. **[WRITE_NAME_HERE]**
    - **Purpose**: ...
2. ...


### **4.3. External Modules**
1. **[WRITE_NAME_HERE]** 
    - **Purpose**: ...
2. ...


### **4.4. Frameworks**
1. **[WRITE_NAME_HERE]**
    - **Purpose**: ...
    - **Reason**: ...
2. ...


### **4.5. Dependencies Diagram**


### **4.6. Use Case Sequence Diagram (5 Most Major Use Cases)**
1. [**[WRITE_NAME_HERE]**](#uc1)\
[SEQUENCE_DIAGRAM_HERE]
2. ...


### **4.7. Design and Ways to Test Non-Functional Requirements**
1. [**[WRITE_NAME_HERE]**](#nfr1)
    - **Validation**: ...
2. ...
