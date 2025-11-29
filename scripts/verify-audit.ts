
const BASE_URL = 'http://localhost:3000/api/v1';
const TENANT_ID = 'audit-verification-tenant';

async function request(method: string, endpoint: string, token?: string, body?: any) {
    const headers: any = {
        'Content-Type': 'application/json',
        'X-Tenant-ID': TENANT_ID,
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
    console.log('🚀 Starting Audit System Verification...\n');

    // 1. Login as Super Admin
    console.log(`[Step 1] Logging in as Super Admin...`);
    const adminLogin = await request('POST', '/auth/login', undefined, {
        email: 'admin@audit.test',
        password: 'Password123!',
    });

    if (adminLogin.status !== 200) {
        console.error('❌ Admin Login Failed:', adminLogin.data);
        process.exit(1);
    }
    console.log('✅ Admin Login Successful');
    const adminToken = adminLogin.data.accessToken;

    // 2. Create a User (Should trigger audit log)
    console.log(`\n[Step 2] Creating a new user to trigger audit log...`);
    const newUserEmail = `audit_test_${Date.now()}@test.com`;
    const createUser = await request('POST', '/users', adminToken, {
        email: newUserEmail,
        password: 'Password123!',
        firstName: 'Audit',
        lastName: 'Test',
        phone: '1234567890'
    });

    if (createUser.status !== 201) {
        console.error('❌ Create User Failed:', createUser.data);
        process.exit(1);
    }
    console.log('✅ User Created Successfully');
    const newUserId = createUser.data.id;

    // 3. Update the User (Should trigger audit log)
    console.log(`\n[Step 3] Updating the user to trigger audit log...`);
    const updateUser = await request('PUT', `/users/${newUserId}`, adminToken, {
        firstName: 'Audit Updated',
    });

    if (updateUser.status !== 200) {
        console.error('❌ Update User Failed:', updateUser.data);
        process.exit(1);
    }
    console.log('✅ User Updated Successfully');

    // 4. Delete the User (Should trigger audit log)
    console.log(`\n[Step 4] Deleting the user to trigger audit log...`);
    const deleteUser = await request('DELETE', `/users/${newUserId}`, adminToken);

    if (deleteUser.status !== 204) {
        console.error('❌ Delete User Failed:', deleteUser.status);
        process.exit(1);
    }
    console.log('✅ User Deleted Successfully');

    // 5. Verify Audit Logs
    console.log(`\n[Step 5] Verifying Audit Logs...`);
    // Wait a bit for async logging if any (though it seems synchronous in service)
    await new Promise(r => setTimeout(r, 1000));

    const logs = await request('GET', '/audit-logs?limit=50', adminToken);

    if (logs.status !== 200) {
        console.error('❌ Fetch Audit Logs Failed:', logs.data);
        process.exit(1);
    }

    const logEntries = logs.data.data;
    console.log(`Fetched ${logEntries.length} audit logs.`);

    // Check for LOGIN
    const loginLog = logEntries.find((l: any) => l.action === 'LOGIN' && l.user.email === 'admin@audit.test');
    if (loginLog) console.log('✅ Found LOGIN log');
    else console.error('❌ Missing LOGIN log');

    // Check for CREATE user
    const createLog = logEntries.find((l: any) => l.action === 'CREATE' && l.resource === 'users' && l.resourceId === newUserId);
    if (createLog) console.log('✅ Found USER CREATE log');
    else {
        console.error('❌ Missing USER CREATE log');
        console.log('Available actions:', logEntries.map((l: any) => l.action));
    }

    // Check for UPDATE user
    const updateLog = logEntries.find((l: any) => l.action === 'UPDATE' && l.resource === 'users' && l.resourceId === newUserId);
    if (updateLog) console.log('✅ Found USER UPDATE log');
    else console.error('❌ Missing USER UPDATE log');

    // Check for DELETE user
    const deleteLog = logEntries.find((l: any) => l.action === 'DELETE' && l.resource === 'users' && l.resourceId === newUserId);
    if (deleteLog) console.log('✅ Found USER DELETE log');
    else console.error('❌ Missing USER DELETE log');

    // 6. RBAC Test
    console.log(`\n[Step 6] Testing RBAC on Audit Logs...`);
    // Login as regular user
    // First create a regular user
    const regularUserEmail = `regular_${Date.now()}@test.com`;
    const createRegular = await request('POST', '/users', adminToken, {
        email: regularUserEmail,
        password: 'Password123!',
        firstName: 'Regular',
        lastName: 'User',
        phone: '1234567890'
    });

    // Login as regular user
    const userLogin = await request('POST', '/auth/login', undefined, {
        email: regularUserEmail,
        password: 'Password123!',
    });
    const userToken = userLogin.data.accessToken;

    const userLogsAccess = await request('GET', '/audit-logs', userToken);
    if (userLogsAccess.status === 403) {
        console.log('✅ RBAC Verified: Regular user cannot access audit logs (403)');
    } else {
        console.error(`❌ RBAC Failed: Expected 403, got ${userLogsAccess.status}`);
    }

    // 7. My Logs Test
    console.log(`\n[Step 7] Testing My Logs...`);
    const myLogs = await request('GET', '/audit-logs/my-logs', userToken);
    if (myLogs.status === 200) {
        console.log(`✅ My Logs Access Successful. Found ${myLogs.data.data.length} logs.`);
        // Should at least have LOGIN log
        const myLoginLog = myLogs.data.data.find((l: any) => l.action === 'LOGIN');
        if (myLoginLog) console.log('✅ Found own LOGIN log');
        else console.warn('⚠️ No LOGIN log found for user (might be first login?)');
    } else {
        console.error(`❌ My Logs Access Failed: ${myLogs.status}`);
    }

    console.log('\n🎉 Audit Verification Complete!');
}

main();
