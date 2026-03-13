# Backend API Structure

This folder contains the API interfaces and placeholder functions for connecting to your external SQL database.

## Folder Structure

```
src/backend/
├── api/
│   ├── index.ts           # Export all API modules
│   ├── auth.ts            # Authentication endpoints
│   ├── users.ts           # User management endpoints
│   ├── accounts.ts        # Account/Profile management
│   ├── documentRequests.ts # Document request handling
│   ├── feedback.ts        # Feedback collection
│   ├── notifications.ts   # Push notifications
│   ├── announcements.ts   # System announcements
│   └── analytics.ts       # Analytics and reporting
├── config.ts              # API configuration and helpers
└── README.md              # This file
```

## Database Tables Needed

Your SQL database should have these tables:

### users
- id (primary key)
- email (unique)
- password_hash
- created_at
- updated_at

### accounts (profiles)
- id (primary key)
- user_id (foreign key to users)
- username
- first_name
- last_name
- middle_name
- contact_number
- grade_level
- section
- avatar_url
- role ('student' | 'admin')
- created_at
- updated_at

### document_requests
- id (primary key)
- user_id (foreign key to users)
- request_number
- status ('pending' | 'processing' | 'approved' | 'completed' | 'rejected')
- purpose
- notes
- created_at
- updated_at

### document_request_items
- id (primary key)
- request_id (foreign key to document_requests)
- document_type
- quantity
- unit_price
- total_price

### feedback
- id (primary key)
- user_id (foreign key to users)
- rating
- comment
- category ('general' | 'service' | 'website' | 'other')
- created_at

### notifications
- id (primary key)
- user_id (foreign key to users)
- title
- message
- type ('info' | 'success' | 'warning' | 'error')
- is_read (boolean)
- created_at

### announcements
- id (primary key)
- title
- content
- type ('info' | 'success' | 'warning')
- is_active (boolean)
- created_by (foreign key to users)
- created_at
- updated_at

## How to Use

1. Update `config.ts` with your API base URL
2. Implement each API function in the respective files
3. Replace the `throw new Error()` calls with actual `fetch()` or your preferred HTTP client

Example implementation:

```typescript
// In auth.ts
export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await fetch('YOUR_API_URL/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },
};
```
