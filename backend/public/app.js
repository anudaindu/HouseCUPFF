const BACKEND_URL = window.location.origin;

let schools = [];
let candidates = [];

let selectedTicket = null;
let selectedSeat = null;
let selectedSchool = null;
let selectedCandidate = null;
let isSubmitting = false; // prevent duplicate submissions

// Theatre Seat Configuration
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

// Pre-taken for realism demo
const takenSeats = ['A5', 'A6', 'D12', 'D13', 'F8', 'G2', 'K19', 'O14', 'O15', 'P1', 'P25', 'Q10'];

document.addEventListener('DOMContentLoaded', async () => {
    await fetchData();
    initSeatGrid();
    renderSchools();
    renderCandidates();
    setupScrollAnimations();
    initCountdown();

    // Debounced seat input — avoids DOM thrash on every keypress
    const seatInput = document.getElementById('seatInput');
    if (seatInput) {
        let seatDebounce;
        seatInput.addEventListener('input', function () {
            this.value = this.value.toUpperCase();
            clearTimeout(seatDebounce);
            seatDebounce = setTimeout(() => syncInputToMap(this.value), 80);
        });
    }

    // Auto uppercase ticket input
    const ticketInput = document.getElementById('ticketInput');
    if (ticketInput) {
        ticketInput.addEventListener('input', function () {
            this.value = this.value.toUpperCase();
            document.getElementById('ticketError').classList.add('hidden');
        });
    }

    // Progress bar — highlight step when section scrolls into view
    const stepMap = {
        'ticket-selection': 1, 'seat-selection': 2,
        'school-selection': 3, 'voting': 4, 'confirmation': 5
    };
    // Step Observer (Scroll Reveal)
    const stepObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Removed progress step updates as progress bar was removed
            }
        });
    }, { threshold: 0.4 });
    Object.keys(stepMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) stepObserver.observe(el);
    });
});

async function fetchData() {
    try {
        const res = await fetch('/api/public/data');
        const data = await res.json();
        schools = data.schools;
        candidates = data.candidates;
    } catch (err) {
        console.error('Failed to fetch data:', err);
    }
}

// Ticket Validation
function validateTicket() {
    const inputEl = document.getElementById('ticketInput');
    const errorMsg = document.getElementById('ticketError');
    const val = (inputEl.value || '').trim().toUpperCase();

    if (!val || !/^[A-Z0-9]+$/.test(val)) {
        errorMsg.textContent = 'Invalid ticket format. Alphanumeric only.';
        errorMsg.classList.remove('hidden');
        selectedTicket = null;
        return;
    }

    errorMsg.classList.add('hidden');
    selectedTicket = val;
    inputEl.value = val;
    scrollToSection('seat-selection');
}

// Seat Validation & Map Sync
function syncInputToMap(inputValue) {
    const errorMsg = document.getElementById('seatError');
    const btn = document.getElementById('btnToSchool');

    // Validate if seat exists in map visually
    const seatEl = document.getElementById(`seat-${inputValue}`);

    // Deselect current
    if (selectedSeat) {
        const oldSeat = document.getElementById(`seat-${selectedSeat}`);
        if (oldSeat) oldSeat.classList.remove('selected');
    }

    if (seatEl && !seatEl.classList.contains('taken')) {
        errorMsg.classList.add('hidden');
        seatEl.classList.add('selected');
        selectedSeat = inputValue;
        btn.classList.remove('disabled');
    } else {
        selectedSeat = null;
        btn.classList.add('disabled');
        if (inputValue.length >= 2) {
            errorMsg.classList.remove('hidden');
            if (seatEl && seatEl.classList.contains('taken')) errorMsg.textContent = "Seat is already taken.";
            else errorMsg.textContent = "Invalid Seat configuration.";
        } else {
            errorMsg.classList.add('hidden');
        }
    }
}

function handleVisualSeatClick(row, num, element) {
    if (element.classList.contains('taken')) return;

    const seatId = `${row}${num}`;
    const seatInput = document.getElementById('seatInput');
    seatInput.value = seatId;

    syncInputToMap(seatId);
}

// Visual Map Rendering — uses DocumentFragment for a single DOM write
function initSeatGrid() {
    const grid = document.getElementById('seatGrid');
    if (!grid) return;

    const fragment = document.createDocumentFragment();
    const takenSet = new Set(takenSeats); // O(1) lookup

    layout.forEach((rowData) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';

        const rowLabel = document.createElement('div');
        rowLabel.className = 'row-label';
        rowLabel.textContent = rowData.row;
        rowDiv.appendChild(rowLabel);

        let currentSeatNum = 1;

        rowData.blocks.forEach((blockSize, index) => {
            const blockDiv = document.createElement('div');
            blockDiv.className = 'seat-block';

            for (let i = 0; i < blockSize; i++) {
                const seatDiv = document.createElement('div');
                seatDiv.className = 'seat';
                const seatId = `${rowData.row}${currentSeatNum}`;
                seatDiv.id = `seat-${seatId}`;

                if (takenSet.has(seatId)) {
                    seatDiv.classList.add('taken');
                } else {
                    seatDiv.classList.add('available');
                    const pinnedNum = currentSeatNum;
                    seatDiv.onclick = () => handleVisualSeatClick(rowData.row, pinnedNum, seatDiv);
                }

                seatDiv.innerHTML = `<span>${currentSeatNum}</span>`;
                blockDiv.appendChild(seatDiv);
                currentSeatNum++;
            }

            if (blockSize > 0 && index < 2 && rowData.blocks[index + 1] > 0) {
                blockDiv.style.marginRight = '2rem';
            }
            rowDiv.appendChild(blockDiv);
        });

        const rowLabelRight = document.createElement('div');
        rowLabelRight.className = 'row-label';
        rowLabelRight.textContent = rowData.row;
        rowDiv.appendChild(rowLabelRight);

        fragment.appendChild(rowDiv);
    });

    grid.innerHTML = '';
    grid.appendChild(fragment); // Single DOM write
}

function renderSchools() {
    const grid = document.getElementById('schoolGrid');
    if (!grid) return;
    grid.innerHTML = '';

    schools.forEach(school => {
        const div = document.createElement('div');
        div.className = 'selectable-card';

        let logoHtml = '';
        if (school.logo_url) {
            logoHtml = `<img src="${school.logo_url}" class="school-logo" alt="${school.name} Logo">`;
        }

        div.innerHTML = `${logoHtml} <span>${school.name}</span>`;

        div.onclick = () => {
            document.querySelectorAll('#schoolGrid .selectable-card').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedSchool = school.name;
            document.getElementById('btnToVoting').classList.remove('disabled');
        };
        grid.appendChild(div);
    });
}

function renderCandidates() {
    const grid = document.getElementById('candidateGrid');
    if (!grid) return;
    grid.innerHTML = '';

    candidates.forEach(cand => {
        const initials = cand.actor_name.split(' ').map(n => n[0]).join('');

        const div = document.createElement('div');
        div.className = 'actor-card selectable-card';

        let avatarHtml = `<div class="avatar-large">${initials}</div>`;
        if (cand.image_url) {
            avatarHtml = `<div class="avatar-large"><img src="${cand.image_url}" class="avatar-img" alt="${cand.character_name}"></div>`;
        }

        div.innerHTML = `
            ${avatarHtml}
            <div class="actor-info-text">
                <h3 class="character-name">${cand.character_name}</h3>
                <p class="actor-name">${cand.actor_name}</p>
            </div>
            <div class="vote-btn-container">
                <button class="vote-btn">Vote</button>
            </div>
        `;

        div.onclick = () => {
            // Deselect all
            document.querySelectorAll('#candidateGrid .selectable-card').forEach(el => {
                el.classList.remove('selected');
                el.querySelector('.vote-btn').textContent = 'Vote';
            });
            // Select clicked
            div.classList.add('selected');
            div.querySelector('.vote-btn').textContent = 'Selected';
            selectedCandidate = `${cand.character_name} (${cand.actor_name})`;

            document.getElementById('btnToConfirmation').classList.remove('disabled');
        };
        grid.appendChild(div);
    });
}

// Navigation & Scrolling
function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
}

function populateReviewState() {
    scrollToSection('confirmation');
    document.getElementById('reviewTicket').textContent = selectedTicket;
    document.getElementById('reviewSeat').textContent = selectedSeat;
    document.getElementById('reviewSchool').textContent = selectedSchool;
    document.getElementById('reviewCandidate').textContent = selectedCandidate;
}

// Scroll Intersection Observer for reveal animations
function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // stop watching once revealed
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(section => observer.observe(section));
}

// Live Countdown Timer — using requestAnimationFrame for efficiency
function initCountdown() {
    const countdownEl = document.getElementById('countdown');
    if (!countdownEl) return;
    const target = Date.now() + (2 * 60 * 60 * 1000);
    let lastDisplay = '';

    function tick() {
        const distance = target - Date.now();
        if (distance < 0) {
            countdownEl.textContent = 'CLOSED';
            return;
        }
        const h = Math.floor(distance / 3600000);
        const m = Math.floor((distance % 3600000) / 60000);
        const s = Math.floor((distance % 60000) / 1000);
        const display = `${String(h).padStart(2, '0')} : ${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
        if (display !== lastDisplay) {
            countdownEl.textContent = display;
            lastDisplay = display;
        }
        setTimeout(tick, 1000);
    }
    tick();
}

// Final Action — POST vote to backend (single request, duplicate-submit-safe)
async function submitVote() {
    if (isSubmitting) return; // hard guard against double-tap

    const submitBtn = document.getElementById('submitVoteBtn');
    const btnText = document.getElementById('submitBtnText');
    const spinner = document.getElementById('submitSpinner');
    const errorEl = document.getElementById('voteSubmitError');

    if (!selectedTicket || !selectedSeat || !selectedSchool || !selectedCandidate) {
        if (errorEl) { errorEl.textContent = 'Please complete all steps first.'; errorEl.classList.remove('hidden'); }
        return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    btnText.textContent = 'Submitting…';
    spinner.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    try {
        const res = await fetch(`${BACKEND_URL}/api/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticket: selectedTicket,
                seat: selectedSeat,
                school: selectedSchool,
                candidate: selectedCandidate
            })
        });

        const data = await res.json();

        if (res.ok) {
            // Keep button disabled forever — vote was cast
            document.getElementById('successModal').classList.remove('hidden');
        } else {
            // Recoverable error — re-enable button
            isSubmitting = false;
            submitBtn.disabled = false;
            btnText.textContent = 'Submit Final Vote';
            spinner.classList.add('hidden');
            if (errorEl) {
                const msg = res.status === 409
                    ? `⚠ ${data.error || 'Already voted from this seat/ticket.'}`
                    : data.error || 'Something went wrong. Please try again.';
                errorEl.textContent = msg;
                errorEl.classList.remove('hidden');
            }
        }
    } catch (err) {
        isSubmitting = false;
        submitBtn.disabled = false;
        btnText.textContent = 'Submit Final Vote';
        spinner.classList.add('hidden');
        if (errorEl) {
            errorEl.textContent = 'Could not reach the server. Check your connection.';
            errorEl.classList.remove('hidden');
        }
    }
}
