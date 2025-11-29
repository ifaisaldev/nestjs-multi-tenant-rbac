const BASE_URL = 'http://localhost:3000/api/v1';

async function testTenantCreation() {
    console.log('🧪 Testing Tenant Creation...\n');

    // Test 1: Create a new tenant
    console.log('[Test 1] Creating new tenant "demo-company"...');
    const createResponse = await fetch(`${BASE_URL}/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Demo Company',
            slug: 'demo-company',
            domain: 'demo.example.com',
            adminEmail: 'admin@democompany.com',
            adminFirstName: 'Demo',
            adminLastName: 'Admin',
            adminPassword: 'SecureP@ss123',
        }),
    });

    const createData = await createResponse.json();
    console.log(`Status: ${createResponse.status}`);
    console.log('Response:', JSON.stringify(createData, null, 2));

    if (createResponse.status === 201) {
        console.log('✅ Tenant created successfully!\n');

        // Test 2: Try to login as the admin user
        console.log('[Test 2] Logging in as tenant admin...');
        const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-ID': 'tenant_demo_company',
            },
            body: JSON.stringify({
                email: 'admin@democompany.com',
                password: 'SecureP@ss123',
            }),
        });

        const loginData = await loginResponse.json();
        console.log(`Status: ${loginResponse.status}`);

        if (loginResponse.status === 200) {
            console.log('✅ Admin login successful!');
            console.log(`Access Token: ${loginData.accessToken.substring(0, 50)}...`);
        } else {
            console.log('❌ Admin login failed:', loginData);
        }
    } else {
        console.log('❌ Tenant creation failed');
    }

    console.log('\n🎉 Test complete!');
}

testTenantCreation().catch(console.error);
