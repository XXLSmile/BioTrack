# BioTrack Backend API



---


Server runs at: `http://localhost:3000`

---

## 📡 API Endpoints

### **Base URL**
- Local: `http://localhost:3000/api`
- Production: `http://4.206.208.211/api`

---

## 🔐 Authentication Routes

**Base:** `/api/auth`

### **Sign Up with Google**
```
POST /api/auth/signup
```

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (201):**
```json
{
  "message": "User signed up successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "67066f8e9a1b2c3d4e5f6a7b",
      "email": "matt@gmail.com",
      "name": "Matt Zhang",
      "profilePicture": "https://...",
      "observationCount": 0,
      "speciesDiscovered": 0,
      "badges": [],
      "friendCount": 0,
      "isPublicProfile": true,
      "favoriteSpecies": []
    }
  }
}
```

**Errors:**
- `401` - Invalid Google token
- `409` - User already exists, please sign in instead

---

### **Sign In with Google**
```
POST /api/auth/signin
```

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (200):**
```json
{
  "message": "User signed in successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "67066f8e9a1b2c3d4e5f6a7b",
      "email": "matt@gmail.com",
      "name": "Matt Zhang",
      "observationCount": 42,
      "speciesDiscovered": 15,
      "badges": ["Explorer", "Bird Watcher"],
      ...
    }
  }
}
```

**Errors:**
- `401` - Invalid Google token
- `404` - User not found, please sign up first

---

### **Logout**
```
POST /api/auth/logout
```

**Response (200):**
```json
{
  "message": "User logged out successfully"
}
```

---

### **Test Login (Development Only)**
```
POST /api/auth/test-login
```

**Only available when `NODE_ENV=development`**

**Request:**
```json
{
  "email": "test@example.com",
  "name": "Test User"
}
```

**Response (200):**
```json
{
  "message": "🧪 Test login successful (DEV ONLY)",
  "data": {
    "token": "eyJhbGci...",
    "user": { ... }
  }
}
```

---

## 👤 User Profile Routes

**Base:** `/api/user`

### **Get Own Profile** 
```
GET /api/user/profile
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "message": "Profile fetched successfully",
  "data": {
    "user": {
      "_id": "67066f8e9a1b2c3d4e5f6a7b",
      "googleId": "102611066244428768445",
      "email": "matt@gmail.com",
      "name": "Matt Zhang",
      "profilePicture": "https://...",
      "observationCount": 42,
      "speciesDiscovered": 15,
      "favoriteSpecies": ["American Robin", "Bald Eagle"],
      "location": "Vancouver, BC",
      "region": "Pacific Northwest",
      "isPublicProfile": true,
      "badges": ["First Sighting", "Explorer", "Bird Watcher"],
      "friendCount": 8,
      "createdAt": "2024-09-15T10:30:00.000Z",
      "updatedAt": "2024-10-09T17:45:00.000Z"
    }
  }
}
```

---

### **Update Own Profile** 
```
POST /api/user/profile
Authorization: Bearer <JWT_TOKEN>
```

**Request:**
```json
{
  "name": "Matt Zhang",
  "location": "Vancouver, BC",
  "region": "Pacific Northwest",
  "isPublicProfile": true,
  "favoriteSpecies": ["Robin", "Eagle"]
}
```

**All fields optional**

**Response (200):**
```json
{
  "message": "User info updated successfully",
  "data": {
    "user": { ... }
  }
}
```

---

### **Delete Own Profile** 
```
DELETE /api/user/profile
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "message": "User deleted successfully"
}
```


---

### **View User by Username**
```
GET /api/user/profile/:username
```

**Example:**
```
GET /api/user/profile/Matt Zhang
GET /api/user/profile/John Doe
```

**Response (200):**
```json
{
  "message": "User profile fetched successfully",
  "data": {
    "user": {
      "_id": "67066f8e9a1b2c3d4e5f6a7b",
      "name": "Matt Zhang",
      "profilePicture": "https://...",
      "location": "Vancouver, BC",
      "region": "Pacific Northwest",
      "observationCount": 42,
      "speciesDiscovered": 15,
      "badges": ["Explorer"],
      "friendCount": 8,
      "createdAt": "2024-09-15T10:30:00.000Z"
    }
  }
}
```

**Note:** Email and googleId are **not** exposed for privacy

**Errors:**
- `404` - User not found
- `403` - This profile is private

---

### **View User by Name (Alternative)**
```
GET /api/user/name/:username
```

Same as `/api/user/profile/:username`

---

### **View User by ID**
```
GET /api/user/:userId
```

**Example:**
```
GET /api/user/67066f8e9a1b2c3d4e5f6a7b
```

**Response:** Same as username lookup

---

### **Search Users**
```
GET /api/user/search?query=<searchTerm>
```

**Example:**
```
GET /api/user/search?query=matt
GET /api/user/search?query=vancouver
```

**Response (200):**
```json
{
  "message": "Search completed successfully",
  "data": {
    "users": [
      {
        "_id": "67066f8e9a1b2c3d4e5f6a7b",
        "name": "Matt Zhang",
        "profilePicture": "https://...",
        "location": "Vancouver, BC",
        "observationCount": 42,
        "speciesDiscovered": 15
      },
      {
        "_id": "67066f8e9a1b2c3d4e5f6a7c",
        "name": "Matthew Smith",
        "profilePicture": "https://...",
        "location": "Seattle, WA",
        "observationCount": 25,
        "speciesDiscovered": 10
      }
    ],
    "count": 2
  }
}
```

**Note:** Only returns public profiles

---

### **Add Favorite Species** 🔒
```
POST /api/user/favorite-species
Authorization: Bearer <JWT_TOKEN>
```

**Request:**
```json
{
  "speciesName": "American Robin"
}
```

**Response (200):**
```json
{
  "message": "Favorite species added successfully"
}
```

---

### **Remove Favorite Species** 🔒
```
DELETE /api/user/favorite-species
Authorization: Bearer <JWT_TOKEN>
```

**Request:**
```json
{
  "speciesName": "American Robin"
}
```

**Response (200):**
```json
{
  "message": "Favorite species removed successfully"
}
```

---

## 🎨 Hobbies Routes

**Base:** `/api/hobbies` 🔒

### **Get All Hobbies**
```
GET /api/hobbies
Authorization: Bearer <JWT_TOKEN>
```

**Response (200):**
```json
{
  "hobbies": ["Reading", "Hiking", "Photography", ...]
}
```

### **Update User Hobbies**
```
PUT /api/hobbies/:hobbyId
Authorization: Bearer <JWT_TOKEN>
```

---

## 📸 Media Routes

**Base:** `/api/media` 🔒

### **Upload Image**
```
POST /api/media/upload
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data
```

**Request:**
```
Form Data:
- image: <file> (JPEG, PNG, max 5MB)
```

**Response (200):**
```json
{
  "message": "Image uploaded successfully",
  "data": {
    "imageUrl": "/uploads/1728487200-123456789.jpg"
  }
}
```

### **Delete Image**
```
DELETE /api/media/:mediaId
Authorization: Bearer <JWT_TOKEN>
```

---

## 🛠️ Admin Routes (Development Only)

**Base:** `/api/admin`

⚠️ **No authentication required - REMOVE IN PRODUCTION!**

### **List All Users**
```
GET /api/admin/users
```

**Response (200):**
```json
{
  "message": "Users fetched successfully",
  "count": 10,
  "data": [
    {
      "_id": "67066f8e9a1b2c3d4e5f6a7b",
      "email": "matt@gmail.com",
      "name": "Matt Zhang",
      "observationCount": 42,
      ...
    }
  ]
}
```

### **Get User by ID**
```
GET /api/admin/users/:userId
```

### **Database Stats**
```
GET /api/admin/stats
```

**Response (200):**
```json
{
  "message": "Database stats",
  "data": {
    "totalUsers": 42,
    "database": "biotrack",
    "collections": ["users", "observations", "species"]
  }
}
```

---

## 🔑 Authentication

Most routes require a JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**How to get a token:**
1. Sign up or sign in with Google
2. Extract the `token` from the response
3. Include in all subsequent requests

---

## 📋 Complete Route Summary

### **Auth (4 routes)**
- `POST /api/auth/signup` - Sign up with Google
- `POST /api/auth/signin` - Sign in with Google
- `POST /api/auth/logout` - Logout
- `POST /api/auth/test-login` - Test login (dev only)

### **User (11 routes)**
- `GET /api/user/profile` 🔒 - Get own profile
- `POST /api/user/profile` 🔒 - Update profile
- `DELETE /api/user/profile` 🔒 - Delete account
- `GET /api/user/stats` 🔒 - Get stats
- `GET /api/user/profile/:username` - View user by name
- `GET /api/user/name/:username` - View user by name (alt)
- `GET /api/user/:userId` - View user by ID
- `GET /api/user/search?query=name` - Search users
- `POST /api/user/favorite-species` 🔒 - Add favorite
- `DELETE /api/user/favorite-species` 🔒 - Remove favorite

### **Hobbies (2 routes)**
- `GET /api/hobbies` 🔒 - Get all hobbies
- `PUT /api/hobbies/:hobbyId` 🔒 - Update user hobbies

### **Media (2 routes)**
- `POST /api/media/upload` 🔒 - Upload image
- `DELETE /api/media/:mediaId` 🔒 - Delete image

### **Admin (3 routes - Dev only)**
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:userId` - Get user by ID
- `GET /api/admin/stats` - Database stats

**Total: 22 routes**

🔒 = Requires authentication

---

## 🌍 Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/biotrack
JWT_SECRET=your-secret-key-change-in-production
GOOGLE_CLIENT_ID=628415973752-7m3vbpjba56r1vfiai7tam8jbqn7i4ri.apps.googleusercontent.com
```

---

## 🧪 Testing

### **With Postman:**

1. **Sign up/Sign in:**
   ```
   POST http://localhost:3000/api/auth/test-login
   Body: { "email": "test@test.com", "name": "Test User" }
   ```

2. **Copy the token from response**

3. **Test authenticated routes:**
   ```
   GET http://localhost:3000/api/user/profile
   Authorization: Bearer YOUR_TOKEN_HERE
   ```

### **View Database:**

```bash
# MongoDB Shell
mongosh biotrack

# MongoDB Compass
mongodb://localhost:27017/biotrack

# Browser (admin endpoints)
http://localhost:3000/api/admin/users
```

---

## 📦 Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** MongoDB + Mongoose
- **Auth:** Google OAuth + JWT
- **File Upload:** Multer
- **Validation:** Zod

---

## 🚀 Deployment

Automatically deploys to Azure VM when pushing to `main` branch:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

GitHub Actions handles deployment automatically.

**Production URL:** `http://4.206.208.211/api`

---

## 📝 Notes

- Admin routes should be removed or protected in production
- JWT tokens expire after 19 hours
- Image uploads are stored in `uploads/` directory
- MongoDB data persists in Docker volume `mongo-data`
