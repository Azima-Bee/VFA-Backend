# FlatMate Backend REST API Documentation (Step 12L Full System)

Base URL: `http://localhost:5000/api`

All protected endpoints require an Authorization Header:
```http
Authorization: Bearer <jwt_token>
```

---

## 1. Health & Status Endpoints

### 1.1 Service Health Check
- **Method**: `GET`
- **Endpoint**: `/health`
- **Auth Required**: No
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2026-09-30T16:00:00.000Z",
  "service": "flatmate-backend"
}
```

### 1.2 Database Connectivity Check
- **Method**: `GET`
- **Endpoint**: `/health/db`
- **Auth Required**: No
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "database": "connected",
  "message": "Database connected successfully"
}
```

---

## 2. Authentication Endpoints

### 2.1 Student Registration
- **Method**: `POST`
- **Endpoint**: `/auth/register`
- **Auth Required**: No
- **Request Body**:
```json
{
  "full_name": "Aarav Sharma",
  "email": "aarav@college.edu",
  "password": "Password@123",
  "phone": "9876543210"
}
```
- **Responses**:
  - `201 Created`: User registered successfully
  - `400 Bad Request`: Missing required fields / password < 6 characters
  - `409 Conflict`: Email already registered

### 2.2 User / Admin Login
- **Method**: `POST`
- **Endpoint**: `/auth/login`
- **Auth Required**: No
- **Request Body**:
```json
{
  "email": "aarav@college.edu",
  "password": "Password@123"
}
```
- **Responses**:
  - `200 OK`: Returns JWT token & user profile object (`id`, `full_name`, `email`, `role`, `account_status`, `verification_status`)
  - `401 Unauthorized`: Invalid credentials
  - `403 Forbidden`: Account suspended

### 2.3 Get Current Authenticated User
- **Method**: `GET`
- **Endpoint**: `/auth/me`
- **Auth Required**: Yes (`Bearer <token>`)
- **Responses**:
  - `200 OK`: User details
  - `401 Unauthorized`: Missing or invalid token
  - `403 Forbidden`: Account suspended

---

## 3. Student Profile Endpoints

### 3.1 Create or Update Profile
- **Method**: `PUT`
- **Endpoint**: `/profile`
- **Auth Required**: Yes (`student` or `admin`)
- **Request Body**:
```json
{
  "college_name": "IIT Indore",
  "course": "Computer Science",
  "year_of_study": "3rd Year",
  "gender": "male",
  "age": 21,
  "bio": "Calm, studious flatmate",
  "city": "Indore",
  "profile_image": "https://example.com/avatar.jpg"
}
```
- **Responses**:
  - `200 OK` / `201 Created`: Profile created/updated
  - `400 Bad Request`: Validation failure (gender, age, field length)

### 3.2 Get Own Profile
- **Method**: `GET`
- **Endpoint**: `/profile`
- **Auth Required**: Yes
- **Responses**:
  - `200 OK`: Profile details
  - `404 Not Found`: Profile not yet created

### 3.3 Get Another Student's Profile
- **Method**: `GET`
- **Endpoint**: `/profile/:userId`
- **Auth Required**: Yes
- **Responses**:
  - `200 OK`: Public student profile
  - `404 Not Found`: Profile not found

---

## 4. Student ID Verification Endpoints

### 4.1 Submit Verification Request
- **Method**: `POST`
- **Endpoint**: `/verification`
- **Auth Required**: Yes
- **Request Body**:
```json
{
  "document_type": "student_id",
  "document_url": "https://example.com/docs/student_id.pdf",
  "university_email": "student@college.edu",
  "student_id_number": "STU2026"
}
```
- **Responses**:
  - `201 Created`: Verification submitted (status: `pending`)
  - `400 Bad Request`: Invalid document type or URL
  - `409 Conflict`: Verification already pending or verified

### 4.2 Get Own Verification History
- **Method**: `GET`
- **Endpoint**: `/verification`
- **Auth Required**: Yes
- **Response**: `200 OK` with list of user verifications

### 4.3 Get Safe Verification Status of Another User
- **Method**: `GET`
- **Endpoint**: `/verification/:userId`
- **Auth Required**: Yes
- **Response**: `200 OK` with `{ status, verified_at }` (Document URL hidden for privacy)

### 4.4 Admin Review Verification Status
- **Method**: `PATCH`
- **Endpoint**: `/verification/:id/status`
- **Auth Required**: Yes (`admin` role required)
- **Request Body**:
```json
{
  "status": "verified"
}
```
- **Responses**:
  - `200 OK`: Status updated (notifies student user)
  - `403 Forbidden`: Non-admin student access rejected

---

## 5. Housing Listings Endpoints

### 5.1 Create Listing
- **Method**: `POST`
- **Endpoint**: `/listings`
- **Auth Required**: Yes
- **Request Body**:
```json
{
  "title": "2BHK Shared Apartment near Campus",
  "description": "Furnished room with attached washroom",
  "property_type": "flat",
  "city": "Indore",
  "address": "Vijay Nagar",
  "monthly_rent": 8500,
  "security_deposit": 15000,
  "gender_preference": "any",
  "furnished": "fully",
  "image_url": "https://example.com/flat.jpg"
}
```
- **Responses**:
  - `201 Created`: Listing created
  - `400 Bad Request`: Validation failure

### 5.2 Get Listings (with Filters)
- **Method**: `GET`
- **Endpoint**: `/listings?city=Indore&property_type=flat&gender_preference=any&min_rent=5000&max_rent=15000`
- **Auth Required**: Yes
- **Response**: `200 OK` with array of matching listings

### 5.3 Get Listing by ID
- **Method**: `GET`
- **Endpoint**: `/listings/:id`
- **Auth Required**: Yes
- **Response**: `200 OK`

### 5.4 Update Own Listing
- **Method**: `PUT`
- **Endpoint**: `/listings/:id`
- **Auth Required**: Yes (Listing Owner only)
- **Responses**:
  - `200 OK`: Listing updated
  - `403 Forbidden`: Non-owner attempt

### 5.5 Delete Own Listing
- **Method**: `DELETE`
- **Endpoint**: `/listings/:id`
- **Auth Required**: Yes (Listing Owner only)
- **Responses**:
  - `200 OK`: Listing deleted
  - `403 Forbidden`: Non-owner attempt

---

## 6. Connections & Roommate Requests Endpoints

### 6.1 Send Connection Request
- **Method**: `POST`
- **Endpoint**: `/connections/:userId`
- **Auth Required**: Yes
- **Responses**:
  - `201 Created`: Request sent (status: `pending`)
  - `400 Bad Request`: Self-connection attempt / Invalid user
  - `409 Conflict`: Duplicate request or already connected

### 6.2 Get Authenticated User Connections
- **Method**: `GET`
- **Endpoint**: `/connections`
- **Auth Required**: Yes
- **Response**: `200 OK` with incoming, outgoing, and accepted connections

### 6.3 Accept Connection Request
- **Method**: `PATCH`
- **Endpoint**: `/connections/:id/accept`
- **Auth Required**: Yes (Receiver only)
- **Responses**:
  - `200 OK`: Connection accepted (messaging unlocked)
  - `403 Forbidden`: Unauthorized user

### 6.4 Reject Connection Request
- **Method**: `PATCH`
- **Endpoint**: `/connections/:id/reject`
- **Auth Required**: Yes (Receiver only)
- **Response**: `200 OK`

### 6.5 Block Connection
- **Method**: `PATCH`
- **Endpoint**: `/connections/:id/block`
- **Auth Required**: Yes
- **Response**: `200 OK`

### 6.6 Delete Connection
- **Method**: `DELETE`
- **Endpoint**: `/connections/:id`
- **Auth Required**: Yes
- **Response**: `200 OK`

---

## 7. Messaging Endpoints

### 7.1 Send Message
- **Method**: `POST`
- **Endpoint**: `/messages`
- **Auth Required**: Yes
- **Request Body**:
```json
{
  "receiver_id": 2,
  "message": "Hey! Are you still looking for a flatmate?"
}
```
- **Responses**:
  - `201 Created`: Message sent
  - `403 Forbidden`: Messaging attempted between unconnected/unaccepted users

### 7.2 Get Conversation Summary
- **Method**: `GET`
- **Endpoint**: `/messages`
- **Auth Required**: Yes
- **Response**: `200 OK` with latest message per conversation partner

### 7.3 Get Conversation with User
- **Method**: `GET`
- **Endpoint**: `/messages/:userId`
- **Auth Required**: Yes
- **Responses**:
  - `200 OK`: Full message history
  - `403 Forbidden`: Users not connected

### 7.4 Mark Message as Read
- **Method**: `PATCH`
- **Endpoint**: `/messages/:id/read`
- **Auth Required**: Yes (Receiver only)
- **Response**: `200 OK`

---

## 8. Notifications Endpoints

### 8.1 Get Own Notifications
- **Method**: `GET`
- **Endpoint**: `/notifications`
- **Auth Required**: Yes
- **Response**: `200 OK` with list of user notifications

### 8.2 Mark Notification as Read
- **Method**: `PATCH`
- **Endpoint**: `/notifications/:id/read`
- **Auth Required**: Yes (Notification Owner only)
- **Responses**:
  - `200 OK`: Marked as read
  - `403 Forbidden`: Non-owner attempt

### 8.3 Delete Notification
- **Method**: `DELETE`
- **Endpoint**: `/notifications/:id`
- **Auth Required**: Yes (Notification Owner only)
- **Responses**:
  - `200 OK`: Notification deleted
  - `403 Forbidden`: Non-owner attempt

---

## 9. Safety & Abuse Reports Endpoints

### 9.1 Submit Safety Report
- **Method**: `POST`
- **Endpoint**: `/reports`
- **Auth Required**: Yes
- **Request Body**:
```json
{
  "reported_user_id": 5,
  "listing_id": null,
  "reason": "Inappropriate messages",
  "description": "User sent unsolicited spam."
}
```
- **Responses**:
  - `201 Created`: Report submitted (status: `pending`)
  - `400 Bad Request`: Missing target or reason

### 9.2 Get Submitted Reports (Own)
- **Method**: `GET`
- **Endpoint**: `/reports`
- **Auth Required**: Yes
- **Response**: `200 OK` with user's submitted reports

### 9.3 Admin View All Reports
- **Method**: `GET`
- **Endpoint**: `/reports/admin`
- **Auth Required**: Yes (`admin` role required)
- **Response**: `200 OK` with all platform reports

### 9.4 Admin Update Report Status
- **Method**: `PATCH`
- **Endpoint**: `/reports/:id/status`
- **Auth Required**: Yes (`admin` role required)
- **Request Body**:
```json
{
  "status": "resolved"
}
```
- **Response**: `200 OK`

---

## 10. Administrator Moderation Portal Endpoints

### 10.1 Get System Metrics & Statistics
- **Method**: `GET`
- **Endpoint**: `/admin/stats`
- **Auth Required**: Yes (`admin` role required)
- **Response**: `200 OK`
```json
{
  "success": true,
  "stats": {
    "totalStudents": 15,
    "verifiedStudents": 8,
    "pendingVerifications": 3,
    "rejectedVerifications": 1,
    "activeListings": 12,
    "totalListings": 14,
    "totalConnections": 20,
    "pendingConnections": 5,
    "reportsCount": 2,
    "suspendedUsers": 0
  }
}
```

### 10.2 Get All Users
- **Method**: `GET`
- **Endpoint**: `/admin/users`
- **Auth Required**: Yes (`admin` role required)
- **Response**: `200 OK` with list of users, profiles, account & verification statuses

### 10.3 Suspend or Reactivate Student Account
- **Method**: `PATCH`
- **Endpoint**: `/admin/users/:id/status`
- **Auth Required**: Yes (`admin` role required)
- **Request Body**:
```json
{
  "status": "suspended"
}
```
- **Responses**:
  - `200 OK`: Account status updated (`active` or `suspended`)
  - `400 Bad Request`: Admin cannot suspend their own account

### 10.4 Get All Student Verification Requests
- **Method**: `GET`
- **Endpoint**: `/admin/verifications`
- **Auth Required**: Yes (`admin` role required)
- **Response**: `200 OK` with student verification queue

### 10.5 Get All Property Listings
- **Method**: `GET`
- **Endpoint**: `/admin/listings`
- **Auth Required**: Yes (`admin` role required)
- **Response**: `200 OK` with all listings and owner details

### 10.6 Update Listing Moderation Status
- **Method**: `PATCH`
- **Endpoint**: `/admin/listings/:id/status`
- **Auth Required**: Yes (`admin` role required)
- **Request Body**:
```json
{
  "status": "active"
}
```
- **Response**: `200 OK`

### 10.7 Delete Listing as Admin
- **Method**: `DELETE`
- **Endpoint**: `/admin/listings/:id`
- **Auth Required**: Yes (`admin` role required)
- **Response**: `200 OK`

### 10.8 Admin Audit Logs
- **Method**: `GET`
- **Endpoint**: `/admin/audit-logs`
- **Auth Required**: Yes (`admin` role required)
- **Response**: `200 OK` with chronologically ordered administrative audit trail records
```json
{
  "success": true,
  "count": 5,
  "logs": [
    {
      "id": 1,
      "admin_id": 1,
      "admin_name": "System Administrator",
      "admin_email": "admin@college.edu",
      "action": "APPROVE_VERIFICATION",
      "target_type": "verification",
      "target_id": 12,
      "details": "Verification for student ID 4 was verified",
      "created_at": "2026-09-30T16:20:00.000Z"
    }
  ]
}
```

