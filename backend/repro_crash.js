const axios = require('axios');

async function crashTest() {
    try {
        console.log('Logging in...');
        const login = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'driver@example.com',
            password: 'password'
        });
        const token = login.data.token;
        console.log('Token OK.');

        // Get shipment
        const jobs = await axios.get('http://localhost:3000/api/data/assigned-shipments', {
            headers: { Authorization: `Bearer ${token}` }
        });

        const job = jobs.data.find(j => j.status === 'assigned' || j.status === 'in_transit');

        if (!job) {
            console.log('No active jobs to test.');
            return;
        }

        console.log(`Found Job: ${job.id} Status: ${job.status}`);
        console.log(`Expected OTP from DB: "${job.delivery_code}"`);

        console.log(`Completing shipment ${job.id}...`);

        const res = await axios.post(`http://localhost:3000/api/data/shipments/${job.id}/complete`, {
            otp: String(job.delivery_code),
            pod_url: 'crash_test_pod'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Complete Response:', res.status, res.data.status);

        // Simulate refresh
        console.log('Simulating refresh...');
        await axios.get('http://localhost:3000/api/data/assigned-shipments', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Refresh OK.');

    } catch (e) {
        console.error('CRASH TEST FAILED');
        if (e.code === 'ECONNREFUSED') {
            console.error('SERVER CRASHED (Connection Refused)');
        } else {
            console.error(e.message);
            if (e.response) console.error(e.response.data);
        }
    }
}

crashTest();
