try {
    const db = require('./db');
    console.log('DB Module Loaded Successfully');
    db.query('SELECT * FROM users').then(res => console.log('Users:', res.rows.length));
} catch (e) {
    console.error('Failed to load DB:', e);
}
