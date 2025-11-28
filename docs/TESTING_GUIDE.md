# Testing Guide - Multi-Tenant RBAC System

This guide covers testing the complete authentication and RBAC system end-to-end.

## Prerequisites

1. **Start Docker Services**
```bash
docker compose up -d
```

2. **Install Dependencies & Start Server**
```bash
npm install
npm run start:dev
```

3. **Create Test Tenant Schema** (if not exists)
```sql
-- Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5433/multitenant_rbac

-- Create a test tenant schema
CREATE SCHEMA IF NOT EXISTS tenant_test;

-- Grant permissions
GRANT ALL ON SCHEMA tenant_test TO postgres;
```

4. **Run Prisma Migrations for Tenant Schema**
```bash
# You'll need to modify DATABASE_URL temporarily to include schema
# Or use raw SQL to create tables in tenant_test schema
```

---

## Test Workflow

### 1. Register a User (Public Endpoint)

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "email": "admin@test.com",
    "password": "Admin@123",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@test.com",
    "firstName": "Admin",
    "lastName": "User",
    "status": "PENDING_VERIFICATION",
    "createdAt": "timestamp"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": "15m"
}
```

### 2. Login (Public Endpoint)

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "email": "admin@test.com",
    "password": "Admin@123"
  }'
```

Save the `accessToken` for subsequent requests.

### 3. Test Protected Route - Get Current User Profile

```bash
curl http://localhost:3000/api/v1/users/me/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Tenant-ID: tenant_test"
```

**Expected:** Returns current user data (no guards on this route)

### 4. Test Permission Guard - List Users

**Setup Required:** User needs `users:read` permission

```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Tenant-ID: tenant_test"
```

**Without Permission:**
```json
{
  "statusCode": 403,
  "message": "Missing required permission(s): users:read"
}
```

**With Permission:** Returns paginated user list

### 5. Test Role Guard - Create User

**Setup Required:** User needs `ADMIN` or `SUPER_ADMIN` role

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "email": "user2@test.com",
    "password": "User@123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Without Role:**
```json
{
  "statusCode": 403,
  "message": "User does not have required role(s): ADMIN, SUPER_ADMIN"
}
```

### 6. Test Combined Guards - Delete User

**Setup Required:** User needs `SUPER_ADMIN` role AND `users:delete` permission

```bash
curl -X DELETE http://localhost:3000/api/v1/users/USER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Tenant-ID: tenant_test"
```

**Without Either:**
```json
{
  "statusCode": 403,
  "message": "User does not have required role(s): SUPER_ADMIN"
}
```

OR

```json
{
  "statusCode": 403,
  "message": "Missing required permission(s): users:delete"
}
```

### 7. Test Refresh Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

**Expected:** Returns new access and refresh tokens

### 8. Test Logout

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "X-Tenant-ID: tenant_test"
```

**Expected:** Invalidates all user sessions

---

## Database Setup for Testing

Since we don't have seed data yet, you'll need to manually set up roles and permissions:

### 1. Create Roles (in tenant schema)

```sql
SET search_path TO tenant_test;

INSERT INTO roles (id, name, display_name, description, is_system, priority)
VALUES
  (gen_random_uuid(), 'SUPER_ADMIN', 'Super Administrator', 'Full system access', true, 100),
  (gen_random_uuid(), 'ADMIN', 'Administrator', 'Tenant administration', true, 80),
  (gen_random_uuid(), 'MANAGER', 'Manager', 'Team management', true, 50),
  (gen_random_uuid(), 'USER', 'User', 'Basic access', true, 10);
```

### 2. Create Permissions

```sql
INSERT INTO permissions (id, resource, action, description)
VALUES
  (gen_random_uuid(), 'users', 'create', 'Create new users'),
  (gen_random_uuid(), 'users', 'read', 'View users'),
  (gen_random_uuid(), 'users', 'update', 'Update users'),
  (gen_random_uuid(), 'users', 'delete', 'Delete users'),
  (gen_random_uuid(), 'users', 'list', 'List all users');
```

### 3. Assign Permissions to Roles

```sql
-- Get role and permission IDs
 SELECT id, name FROM roles;
SELECT id, resource, action FROM permissions;

-- Assign all permissions to SUPER_ADMIN
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN';

-- Assign read permissions to USER
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'USER' AND p.action = 'read';
```

### 4. Assign Role to User

```sql
-- Get user ID
SELECT id, email FROM users;

-- Assign SUPER_ADMIN role
INSERT INTO user_roles (id, user_id, role_id, assigned_at)
VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID',
  (SELECT id FROM roles WHERE name = 'SUPER_ADMIN'),
  NOW()
);
```

---

## Testing Multi-Tenancy

### 1. Create Another Tenant Schema

```sql
CREATE SCHEMA IF NOT EXISTS tenant_company1;
GRANT ALL ON SCHEMA tenant_company1 TO postgres;
```

### 2. Test Isolation

- Register user in `tenant_test`
- Register user in `tenant_company1` with same email
- Verify they can both login independently
- Verify users in one tenant cannot access data from another

---

## Swagger UI Testing

1. Open: http://localhost:3000/api/docs
2. Click "Authorize" button
3. Enter: `Bearer YOUR_ACCESS_TOKEN`
4. Also add `X-Tenant-ID` header
5. Try all endpoints interactively

---

## Common Issues

### 1. "User not authenticated" on protected routes
- Check if JWT token is valid
- Verify `Authorization` header format: `Bearer TOKEN`
- Ensure token hasn't expired (15min default)

### 2. "Missing required permission"
- Verify user has been assigned a role
- Verify role has the required permission
- Check permission resource and action match exactly

### 3. "User does not have required role"
- Verify user has been assigned the required role via `user_roles` table
- Role names are case-sensitive

### 4. Database connection errors
- Verify Docker services are running: `docker compose ps`
- Check DATABASE_URL in `.env` points to port 5433
- Verify tenant schema exists

---

## Next Steps After Testing

1. Create seed scripts to automate role/permission setup
2. Add automated tests (unit, integration, e2e)
3. Implement tenant middleware for automatic tenant resolution
4. Add GraphQL layer
5. Implement CQRS patterns for complex operations
