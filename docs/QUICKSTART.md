# Quick Start - Testing the System

This is a streamlined guide to get you testing quickly.

## 1. Start Everything

```bash
# Start Docker services
docker compose up -d

# Install dependencies (if not done)
npm install

# Start the application
npm run start:dev
```

## 2. Create Tenant Schema & Seed Data

```bash
# Create tenant schema and run migrations
psql postgresql://postgres:postgres@localhost:5433/multitenant_rbac -c "CREATE SCHEMA IF NOT EXISTS tenant_test;"

# Apply Prisma schema to tenant (one-time setup)
# This creates all tables in the tenant_test schema
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/multitenant_rbac?schema=tenant_test" npx prisma db push

# Run seed script to create roles, permissions, and test users
SEED_TENANT_ID=tenant_test npm run prisma:seed
```

**Expected Output:**
```
🌱 Seeding tenant: tenant_test
Creating roles...
✓ Roles created
Creating permissions...
✓ Permissions created
Assigning permissions to roles...
✓ Permissions assigned to roles
Creating test users...
  ✓ Created superadmin@test.com with role SUPER_ADMIN
  ✓ Created admin@test.com with role ADMIN
  ✓ Created manager@test.com with role MANAGER
  ✓ Created user@test.com with role USER

✅ Seed completed successfully!

📝 Test Users Created:
  superadmin@test.com - Password: Test@123 (SUPER_ADMIN)
  admin@test.com - Password: Test@123 (ADMIN)
  manager@test.com - Password: Test@123 (MANAGER)
  user@test.com - Password: Test@123 (USER)
```

## 3. Test Authentication

### Login as Super Admin
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "email": "superadmin@test.com",
    "password": "Test@123"
  }'
```

**Save the `accessToken` from the response.**

### Login as Regular User
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "email": "user@test.com",
    "password": "Test@123"
  }'
```

## 4. Test RBAC Guards

### Test 1: List Users (Requires `users:read` permission)

**As Super Admin (HAS permission):**
```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -H "X-Tenant-ID: tenant_test"
```
✅ **Expected:** Returns user list with pagination

**As Regular User (HAS permission):**
```bash
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "X-Tenant-ID: tenant_test"
```
✅ **Expected:** Returns user list (USER role has `users:read`)

### Test 2: Create User (Requires `ADMIN` or `SUPER_ADMIN` role)

**As Super Admin (HAS role):**
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "email": "newuser@test.com",
    "password": "NewUser@123",
    "firstName": "New",
    "lastName": "User"
  }'
```
✅ **Expected:** User created successfully

**As Regular User (NO role):**
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "X-Tenant-ID: tenant_test" \
  -d '{
    "email": "denied@test.com",
    "password": "Test@123",
    "firstName": "Denied",
    "lastName": "User"
  }'
```
❌ **Expected:** 
```json
{
  "statusCode": 403,
  "message": "User does not have required role(s): ADMIN, SUPER_ADMIN"
}
```

### Test 3: Delete User (Requires `SUPER_ADMIN` role + `users:delete` permission)

**As Admin (HAS permission but NOT role):**
```bash
curl -X DELETE http://localhost:3000/api/v1/users/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "X-Tenant-ID: tenant_test"
```
❌ **Expected:**
```json
{
  "statusCode": 403,
  "message": "User does not have required role(s): SUPER_ADMIN"
}
```

**As Super Admin (HAS both):**
```bash
curl -X DELETE http://localhost:3000/api/v1/users/USER_ID \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -H "X-Tenant-ID: tenant_test"
```
✅ **Expected:** User deleted (soft delete)

## 5. Test with Swagger UI

1. Open http://localhost:3000/api/docs
2. Click "Authorize"
3. Enter: `Bearer YOUR_ACCESS_TOKEN`
4. Try different endpoints with different user tokens

## Summary of Test Users

| Email | Password | Role | Has Permissions |
|-------|----------|------|-----------------|
| superadmin@test.com | Test@123 | SUPER_ADMIN | All permissions |
| admin@test.com | Test@123 | ADMIN | Create, Read, Update, List, Assign |
| manager@test.com | Test@123 | MANAGER | Read, Update, List (users only) |
| user@test.com | Test@123 | USER | Read only |

## Troubleshooting

**Application won't start:**
```bash
# Check Docker services
docker compose ps

# Check logs
docker compose logs -f postgres
npm run start:dev
```

**Seed fails:**
```bash
# Verify schema exists
psql postgresql://postgres:postgres@localhost:5433/multitenant_rbac -c "\dn"

# Apply Prisma schema first
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/multitenant_rbac?schema=tenant_test" npx prisma db push
```

**Authentication fails:**
- Verify user was created by seed script
- Check password is exactly `Test@123`
- Ensure `X-Tenant-ID` header is `tenant_test`

## Next: Full Testing Guide

For comprehensive testing including multi-tenancy, see `docs/TESTING_GUIDE.md`
