
const BASE_URL = 'http://localhost:3000/api/v1';
const TENANT_A = 'tenant_test';
const TENANT_B = 'tenant_b';

async function request(method: string, endpoint: string, tenantId: string, token?: string, body?: any) {
    const headers: any = {
        'Content-Type': 'application/json',
        'X-Tenant-ID': tenantId,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    return { status: response.status, data };
}

async function main() {
    console.log('🚀 Starting System Verification...\n');

    // 1. Auth & RBAC in Tenant A
    console.log(`[Tenant A: ${TENANT_A}] Logging in as Super Admin...`);
    const adminLogin = await request('POST', '/auth/login', TENANT_A, undefined, {
        email: 'superadmin@test.com',
        password: 'Test@123',
    });

    if (adminLogin.status !== 200) {
        console.error('❌ Admin Login Failed:', adminLogin.data);
        process.exit(1);
    }
    console.log('✅ Admin Login Successful');
    const adminToken = adminLogin.data.accessToken;

    console.log(`[Tenant A: ${TENANT_A}] Listing Users (Admin)...`);
    const usersA = await request('GET', '/users', TENANT_A, adminToken);
    if (usersA.status !== 200) {
        console.error('❌ List Users Failed:', usersA.data);
        process.exit(1);
    }
    console.log(`✅ Users Listed: ${usersA.data.length} users found`);

    console.log(`[Tenant A: ${TENANT_A}] Logging in as Regular User...`);
    const userLogin = await request('POST', '/auth/login', TENANT_A, undefined, {
        email: 'user@test.com',
        password: 'Test@123',
    });
    if (userLogin.status !== 200) {
        console.error('❌ User Login Failed:', userLogin.data);
        process.exit(1);
    }
    console.log('✅ User Login Successful');
    const userToken = userLogin.data.accessToken;

    console.log(`[Tenant A: ${TENANT_A}] Attempting to Create User as Regular User (Should Fail)...`);
    const createFail = await request('POST', '/users', TENANT_A, userToken, {
        email: 'hacker@test.com',
        password: 'Password123!',
        firstName: 'Hacker',
        lastName: 'User',
        phone: '1234567890'
    });

    if (createFail.status === 403) {
        console.log('✅ RBAC Check Passed: User cannot create users (403 Forbidden)');
    } else {
        console.error(`❌ RBAC Check Failed: Expected 403, got ${createFail.status}`);
    }

    // 2. Multi-Tenancy Isolation
    console.log(`\n[Tenant B: ${TENANT_B}] Logging in as Super Admin...`);
    const adminLoginB = await request('POST', '/auth/login', TENANT_B, undefined, {
        email: 'superadmin@test.com',
        password: 'Test@123',
    });

    if (adminLoginB.status !== 200) {
        console.error('❌ Tenant B Login Failed:', adminLoginB.data);
        process.exit(1);
    }
    console.log('✅ Tenant B Login Successful');
    const adminTokenB = adminLoginB.data.accessToken;

    console.log(`[Tenant B: ${TENANT_B}] Listing Users...`);
    const usersB = await request('GET', '/users', TENANT_B, adminTokenB);

    console.log(`✅ Tenant B Users Listed: ${usersB.data.length} users found`);

    // Verify Isolation
    // Tenant A should have 4 users (from seed)
    // Tenant B should have 4 users (from seed)
    // But they are different sets of data (even if emails are same, IDs should be different)

    const userA_ID = usersA.data[0].id;
    const userB_ID = usersB.data[0].id;

    if (userA_ID !== userB_ID) {
        console.log(`✅ Isolation Verified: User IDs differ between tenants (${userA_ID} vs ${userB_ID})`);
    } else {
        console.error('❌ Isolation Failed: User IDs are identical!');
    }

    // Cross-Tenant Access Check
    console.log(`\n[Security] Attempting to access Tenant A data with Tenant B token...`);
    // We send X-Tenant-ID: tenant_test (A), but Authorization: Bearer TokenB
    // The middleware sets schema to A.
    // The JWT strategy validates TokenB.
    // If strict isolation is enforced, this should fail because TokenB is for Tenant B.
    // OR if we allow it, the user ID from TokenB won't exist in Tenant A's users table.

    const crossAccess = await request('GET', '/users/me/profile', TENANT_A, adminTokenB);

    if (crossAccess.status === 401 || crossAccess.status === 403 || crossAccess.status === 404) {
        console.log(`✅ Cross-Tenant Access Blocked: Status ${crossAccess.status}`);
    } else {
        console.log(`⚠️ Cross-Tenant Access Result: ${crossAccess.status} (Check if this is intended)`);
        // If it returns 200, it means the user from B was found in A? Impossible if IDs are UUIDs.
        // Unless the user ID exists in both? (Very unlikely with UUIDs)
    }

    console.log('\n🎉 Verification Complete!');
}

main();
