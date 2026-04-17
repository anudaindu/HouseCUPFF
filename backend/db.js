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
            CREATE TABLE IF NOT EXISTS schools (
                id          SERIAL PRIMARY KEY,
                name        VARCHAR(100) NOT NULL UNIQUE,
                logo_url    TEXT
            );

            CREATE TABLE IF NOT EXISTS candidates (
                id              SERIAL PRIMARY KEY,
                character_name  VARCHAR(150) NOT NULL,
                actor_name      VARCHAR(150) NOT NULL,
                school_id       INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                image_url       TEXT
            );

            CREATE TABLE IF NOT EXISTS votes (
                id          SERIAL PRIMARY KEY,
                ticket      VARCHAR(50)  NOT NULL UNIQUE,
                seat        VARCHAR(5)   NOT NULL UNIQUE,
                school      VARCHAR(100) NOT NULL,
                candidate   VARCHAR(150) NOT NULL,
                voted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
            );
        `);
        console.log('[DB] votes table ready.');
    } finally {
        client.release();
    }
}

module.exports = { pool, initDB };
