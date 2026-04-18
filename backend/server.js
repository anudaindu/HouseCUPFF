require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'COLDTHEATRE7';

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Valid seat IDs (mirror of frontend layout) ──────────────────────────────
const layout = [
    { row: 'A', blocks: [4, 10, 4] },
    { row: 'B', blocks: [4, 10, 4] },
    { row: 'C', blocks: [5, 10, 5] },
    { row: 'D', blocks: [5, 10, 5] },
    { row: 'E', blocks: [5, 10, 5] },
    { row: 'F', blocks: [5, 11, 5] },
    { row: 'G', blocks: [5, 11, 5] },
    { row: 'H', blocks: [6, 11, 6] },
    { row: 'J', blocks: [6, 12, 6] },
    { row: 'K', blocks: [6, 12, 6] },
    { row: 'L', blocks: [4, 13, 6] },
    { row: 'M', blocks: [5, 14, 5] },
    { row: 'N', blocks: [5, 14, 5] },
    { row: 'O', blocks: [5, 15, 5] },
    { row: 'P', blocks: [5, 15, 5] },
    { row: 'Q', blocks: [0, 25, 0] }
];

const validSeats = new Set();
layout.forEach(({ row, blocks }) => {
    let num = 1;
    blocks.forEach(count => {
        for (let i = 0; i < count; i++) {
            validSeats.add(`${row}${num}`);
            num++;
        }
    });
});

// ── Public Data Endpoint ─────────────────────────────────────────────────────
// Fetches all schools and candidates for the voting app
app.get('/api/public/data', async (req, res) => {
    try {
        const schools = await pool.query('SELECT * FROM schools ORDER BY name ASC');
        const candidates = await pool.query(`
            SELECT c.*, s.name as school_name 
            FROM candidates c 
            JOIN schools s ON c.school_id = s.id 
            ORDER BY c.character_name ASC
        `);
        const settingsRaw = await pool.query('SELECT * FROM settings');
        const settings = {};
        settingsRaw.rows.forEach(s => settings[s.key] = s.value);

        res.json({
            schools: schools.rows,
            candidates: candidates.rows,
            settings: settings
        });
    } catch (err) {
        console.error('[DATA FETCH ERROR]', err);
        res.status(500).json({ error: 'Failed to fetch platform data.' });
    }
});

// ── POST /api/vote ──────────────────────────────────────────────────────────
// Body: { ticket: "T123", seat: "A3", school: "...", candidate: "Romeo (Renal Perera)" }
app.post('/api/vote', async (req, res) => {
    // Check if voting window is open
    try {
        const settingsRaw = await pool.query('SELECT * FROM settings');
        const settings = {};
        settingsRaw.rows.forEach(s => settings[s.key] = s.value);
        
        const now = new Date();
        const start = new Date(settings.voting_start);
        const end = new Date(settings.voting_end);

        if (now < start) {
            return res.status(403).json({ error: 'Voting has not started yet.' });
        }
        if (now > end) {
            return res.status(403).json({ error: 'Voting is now closed.' });
        }
    } catch (err) {
        console.error('[WINDOW CHECK ERROR]', err);
    }

    const { ticket, seat, school, candidate } = req.body;

    // 1. Input presence check
    if (!ticket || !seat || !school || !candidate) {
        return res.status(400).json({
            error: 'Missing fields. Please provide ticket, seat, school, and candidate.'
        });
    }

    const normTicket = ticket.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(normTicket)) {
        return res.status(400).json({ error: 'Invalid ticket format. Alphanumeric characters only.' });
    }

    const normSeat = seat.trim().toUpperCase();

    // 2. Validate seat exists in the theatre map
    if (!validSeats.has(normSeat)) {
        return res.status(400).json({ error: `Seat "${normSeat}" is not a valid seat in this venue.` });
    }

    // 3. Validate school and candidate against DB
    try {
        const check = await pool.query(`
            SELECT c.id FROM candidates c 
            JOIN schools s ON c.school_id = s.id 
            WHERE s.name = $1 AND (c.character_name || ' (' || c.actor_name || ')') = $2
        `, [school.trim(), candidate.trim()]);

        if (check.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid school or candidate selection.' });
        }
    } catch (err) {
        console.error('[VALIDATION ERROR]', err);
        return res.status(500).json({ error: 'Server validation failed.' });
    }

    // 5. Insert — the UNIQUE constraint catches duplicates
    try {
        await pool.query(
            `INSERT INTO votes (ticket, seat, school, candidate) VALUES ($1, $2, $3, $4)`,
            [normTicket, normSeat, school.trim(), candidate.trim()]
        );
        return res.status(201).json({ message: 'Vote recorded successfully!' });
    } catch (err) {
        // PostgreSQL unique violation code
        if (err.code === '23505') {
            if (err.constraint && err.constraint.includes('ticket')) {
                return res.status(409).json({
                    error: `Ticket ${normTicket} has already been used to vote.`
                });
            }
            return res.status(409).json({
                error: `Seat ${normSeat} has already been used to vote. Each seat can only vote once.`
            });
        }
        console.error('[VOTE ERROR]', err);
        return res.status(500).json({ error: 'An internal error occurred. Please try again.' });
    }
});

// ── GET /api/admin/results ──────────────────────────────────────────────────
// Query: ?password=xxx
app.get('/api/admin/results', async (req, res) => {
    if (req.query.password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized. Wrong admin password.' });
    }

    try {
        const byCandidate = await pool.query(`SELECT candidate, COUNT(*) AS votes FROM votes GROUP BY candidate ORDER BY votes DESC`);
        const bySchool = await pool.query(`SELECT candidate, school, COUNT(*) AS votes FROM votes GROUP BY candidate, school ORDER BY candidate, votes DESC`);
        const total = await pool.query(`SELECT COUNT(*) AS total FROM votes`);
        const allVotes = await pool.query(`SELECT id, ticket, seat, school, candidate, voted_at FROM votes ORDER BY voted_at DESC`);

        return res.json({
            totalVotes: parseInt(total.rows[0].total),
            byCandidate: byCandidate.rows,
            bySchool: bySchool.rows,
            allVotes: allVotes.rows
        });
    } catch (err) {
        console.error('[RESULTS ERROR]', err);
        return res.status(500).json({ error: 'Failed to retrieve results.' });
    }
});

// ── DELETE /api/admin/votes/:id ─────────────────────────────────────────────
app.delete('/api/admin/votes/:id', async (req, res) => {
    const auth = req.headers.authorization || `Bearer ${req.query.password}`;
    const token = auth.replace('Bearer ', '');
    
    if (token !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized. Wrong admin password.' });
    }

    try {
        await pool.query('DELETE FROM votes WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'Vote deleted successfully.' });
    } catch (err) {
        console.error('[DELETE VOTE ERROR]', err);
        res.status(500).json({ error: 'Failed to delete vote.' });
    }
});

// ── Admin Management Endpoints ──────────────────────────────────────────────

// Save School (Create or Update)
app.post('/api/admin/schools', async (req, res) => {
    if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).send('Unauthorized');
    const { id, name, logo_url } = req.body;
    try {
        if (id) {
            await pool.query('UPDATE schools SET name = $1, logo_url = $2 WHERE id = $3', [name, logo_url, id]);
        } else {
            await pool.query('INSERT INTO schools (name, logo_url) VALUES ($1, $2)', [name, logo_url]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/schools/:id', async (req, res) => {
    if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).send('Unauthorized');
    try {
        await pool.query('DELETE FROM schools WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save Candidate (Create or Update)
app.post('/api/admin/candidates', async (req, res) => {
    if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).send('Unauthorized');
    const { id, character_name, actor_name, school_id, image_url } = req.body;
    try {
        if (id) {
            await pool.query(
                'UPDATE candidates SET character_name=$1, actor_name=$2, school_id=$3, image_url=$4 WHERE id=$5',
                [character_name, actor_name, school_id, image_url, id]
            );
        } else {
            await pool.query(
                'INSERT INTO candidates (character_name, actor_name, school_id, image_url) VALUES ($1,$2,$3,$4)',
                [character_name, actor_name, school_id, image_url]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/candidates/:id', async (req, res) => {
    if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).send('Unauthorized');
    try {
        await pool.query('DELETE FROM candidates WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Voting Window
app.post('/api/admin/settings', async (req, res) => {
    if (req.headers.authorization !== `Bearer ${ADMIN_PASSWORD}`) return res.status(401).send('Unauthorized');
    const { voting_start, voting_end } = req.body;
    try {
        if (voting_start) await pool.query('UPDATE settings SET value = $1 WHERE key = \'voting_start\'', [voting_start]);
        if (voting_end) await pool.query('UPDATE settings SET value = $1 WHERE key = \'voting_end\'', [voting_end]);
        res.json({ success: true });
    } catch (err) {
        console.error('[SETTINGS UPDATE ERROR]', err);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /admin ──────────────────────────────────────────────────────────────
// Serve the admin dashboard HTML (handled by express.static from public/)
app.get(['/admin', '/admin/'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Start ───────────────────────────────────────────────────────────────────
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`[SERVER] House Cup backend running on port ${PORT}`);
        console.log(`[SERVER] Admin dashboard → http://localhost:${PORT}/admin`);
    });
}).catch(err => {
    console.error('[FATAL] Could not initialise database:', err);
    process.exit(1);
});
