#!/bin/bash

# Database Seed Script
# Creates roles, permissions, and test users for a tenant

set -e

TENANT_ID=${1:-tenant_test}

echo "🌱 Starting database seed for tenant: $TENANT_ID"
echo ""

# Check if schema exists
SCHEMA_EXISTS=$(psql $DATABASE_URL -tAc "SELECT 1 FROM pg_namespace WHERE nspname = '$TENANT_ID'")

if [ -z "$SCHEMA_EXISTS" ]; then
  echo "❌ Schema $TENANT_ID does not exist!"
  echo "Creating schema..."
  psql $DATABASE_URL -c "CREATE SCHEMA IF NOT EXISTS $TENANT_ID;"
  psql $DATABASE_URL -c "GRANT ALL ON SCHEMA $TENANT_ID TO postgres;"
  echo "✓ Schema created"
  echo ""
  
  echo "Running Prisma migrations for tenant schema..."
  # Note: You'll need to manually run migrations for tenant schemas
  # or use a custom migration script
  echo "⚠️  Please ensure Prisma migrations are applied to $TENANT_ID schema"
  echo ""
fi

# Run seed script
echo "Running seed script..."
SEED_TENANT_ID=$TENANT_ID npx ts-node prisma/seeds/seed.ts

echo ""
echo "✅ Seed completed successfully!"
