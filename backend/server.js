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

const VALID_SCHOOLS = [
    'Gateway College Dehiwala',
    'Musaeus College Colombo',
    'Gateway College Colombo',
    'Lyceum College Nugegoda'
];

const VALID_CANDIDATES = [
    'Romeo (Renal Perera)',
    'Juliet (Kimali Abeynayaka)',
    'Hamlet (Dinesh Hettiarachchi)',
    'Ophelia (Amaya Perera)',
    'Macbeth (Ravindu Abeynayaka)',
    'Lady Macbeth (Tharushi Hettiarachchi)',
    'Othello (Nimesh Perera)',
    'Desdemona (Dulmini Abeynayaka)',
    'Mercutio (Chamod Hettiarachchi)',
    'King Lear (Nadun Perera)'
];

// ── POST /api/vote ──────────────────────────────────────────────────────────
// Body: { ticket: "T123", seat: "A3", school: "...", candidate: "Romeo (Renal Perera)" }
app.post('/api/vote', async (req, res) => {
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

    // 3. Validate school
    if (!VALID_SCHOOLS.includes(school.trim())) {
        return res.status(400).json({ error: 'Invalid school selection.' });
    }

    // 4. Validate candidate
    if (!VALID_CANDIDATES.includes(candidate.trim())) {
        return res.status(400).json({ error: 'Invalid candidate selection.' });
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
        // Total votes per candidate
        const byCandidate = await pool.query(`
            SELECT candidate, COUNT(*) AS votes
            FROM votes
            GROUP BY candidate
            ORDER BY votes DESC
        `);

        // Votes per candidate per school
        const bySchool = await pool.query(`
            SELECT candidate, school, COUNT(*) AS votes
            FROM votes
            GROUP BY candidate, school
            ORDER BY candidate, votes DESC
        `);

        // Total vote count
        const total = await pool.query(`SELECT COUNT(*) AS total FROM votes`);

        // All individual votes (for audit)
        const allVotes = await pool.query(`
            SELECT ticket, seat, school, candidate, voted_at
            FROM votes
            ORDER BY voted_at DESC
        `);

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
