const axios = require('axios');

async function testLogin() {
    try {
        console.log('Attempting login for driver@example.com...');
        const res = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'driver@example.com',
            password: 'password'
        });
        console.log('Login Success!');
        console.log('Token:', res.data.token ? 'Yes' : 'No');
        console.log('Role:', res.data.role);
    } catch (err) {
        console.error('Login Failed!');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        } else {
            console.error('Error:', err.message);
        }
    }
}

testLogin();
