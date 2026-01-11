const axios = require('axios');

async function debugDriver() {
    try {
        // 1. Login
        console.log('Logging in as Driver...');
        const auth = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'driver@example.com',
            password: 'password'
        });
        const token = auth.data.token;
        console.log('Login Success. Token received.');

        // 2. Fetch Shipments
        console.log('Fetching Shipments...');
        const res = await axios.get('http://localhost:3000/api/data/shipments', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const allShipments = res.data;
        console.log(`Total Shipments Fetched: ${allShipments.length}`);

        // 3. Simulate Frontend Filter
        // const active = res.data.filter(s => (s.status === 'assigned' || s.status === 'in_transit') && s.driver_id === 2);

        console.log('--- Raw Shipment Dump for Driver ID 2 ---');
        const driverShipments = allShipments.filter(s => s.driver_id === 2);
        driverShipments.forEach(s => {
            console.log(`[${s.id}] ${s.tracking_number} | Status: ${s.status} | DriverID: ${s.driver_id}`);
        });

        const active = driverShipments.filter(s => s.status === 'assigned' || s.status === 'in_transit');
        console.log(`--- Active Jobs Count (Frontend Logic): ${active.length} ---`);

        if (active.length === 0) {
            console.log('ISSUE FOUND: No active shipments for Driver 2.');
        } else {
            console.log('DATA OK: Driver should see these jobs.');
        }

    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

debugDriver();
