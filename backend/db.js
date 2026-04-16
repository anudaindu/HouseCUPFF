require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Initialize the database — create the votes table if it doesn't exist.
 */
async function initDB() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS votes (
                id          SERIAL PRIMARY KEY,
                ticket      VARCHAR(50)  NOT NULL UNIQUE,
                seat        VARCHAR(5)   NOT NULL UNIQUE,
                school      VARCHAR(100) NOT NULL,
                candidate   VARCHAR(150) NOT NULL,
                voted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            );
        `);
        // Safely add ticket column if table existed before this update
        try {
            await client.query(`ALTER TABLE votes ADD COLUMN ticket VARCHAR(50) UNIQUE;`);
        } catch (e) {}
        console.log('[DB] votes table ready.');
    } finally {
        client.release();
    }
}

module.exports = { pool, initDB };
