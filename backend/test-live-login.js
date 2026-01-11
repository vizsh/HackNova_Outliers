const axios = require('axios');

const url = 'http://localhost:3000/api/auth/login';
const credentials = {
    email: 'operator@example.com',
    password: 'password'
};

console.log(`Testing Login API: ${url}`);
console.log('Sending credentials:', credentials);

axios.post(url, credentials)
    .then(res => {
        console.log('SUCCESS!');
        console.log('Status:', res.status);
        console.log('Token:', res.data.token ? 'Received (Hidden)' : 'Missing');
        console.log('Role:', res.data.role);
    })
    .catch(err => {
        console.error('FAILURE!');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        } else if (err.request) {
            console.error('No Response (Network Error). is server running on 3000?');
        } else {
            console.error('Error:', err.message);
        }
    });
