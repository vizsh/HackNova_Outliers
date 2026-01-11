require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');
const db = require('../db');

const schemaPath = path.join(__dirname, '../db/schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

(async () => {
    try {
        console.log('Running schema migration...');
        await db.query(schemaSql);
        console.log('Schema migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running schema migration:', err);
        process.exit(1);
    }
})();
