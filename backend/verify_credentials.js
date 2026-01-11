const bcrypt = require('bcryptjs');

const password = 'password';
const hash = bcrypt.hashSync(password, 10);

console.log('Test Password:', password);
console.log('Generated Hash:', hash);

const match = bcrypt.compareSync(password, hash);
console.log('Immediate Compare Result:', match);

// Mock Users from db/index.js logic
const users = [
    { id: 1, email: 'operator@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'operator' },
    { id: 2, email: 'driver@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'driver' },
    { id: 3, email: 'customer@example.com', password_hash: bcrypt.hashSync('password', 10), role: 'customer' }
];

console.log('--- Mock DB Users ---');
users.forEach(u => {
    const isMatch = bcrypt.compareSync('password', u.password_hash);
    console.log(`User: ${u.email} | Role: ${u.role} | Password 'password' Valid: ${isMatch}`);
});
