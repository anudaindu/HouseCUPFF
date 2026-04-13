// Data Reference
const schools = [
    "Gateway College Dehiwala",
    "Musaeus College Colombo",
    "Gateway College Colombo",
    "Lyceum College Nugegoda"
];

const candidates = [
    { character: "Romeo", actor: "Renal Perera" },
    { character: "Juliet", actor: "Kimali Abeynayaka" },
    { character: "Hamlet", actor: "Dinesh Hettiarachchi" },
    { character: "Ophelia", actor: "Amaya Perera" },
    { character: "Macbeth", actor: "Ravindu Abeynayaka" },
    { character: "Lady Macbeth", actor: "Tharushi Hettiarachchi" },
    { character: "Othello", actor: "Nimesh Perera" },
    { character: "Desdemona", actor: "Dulmini Abeynayaka" },
    { character: "Mercutio", actor: "Chamod Hettiarachchi" },
    { character: "King Lear", actor: "Nadun Perera" }
];

let selectedSeat = null;
let selectedSchool = null;
let selectedCandidate = null;

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

document.addEventListener('DOMContentLoaded', () => {
    initSeatGrid();
    renderSchools();
    renderCandidates();
    setupScrollAnimations();
    initCountdown();
    
    // Hide cinematic intro safely after delay
    setTimeout(() => {
        const overlay = document.getElementById('introOverlay');
        if (overlay) overlay.classList.add('hidden');
    }, 2800);

    // Sync input to grid dynamically
    const seatInput = document.getElementById('seatInput');
    if(seatInput) {
        seatInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
            syncInputToMap(this.value);
        });
    }
});

// Seat Validation & Map Sync
function syncInputToMap(inputValue) {
    const errorMsg = document.getElementById('seatError');
    const btn = document.getElementById('btnToSchool');
    
    // Validate if seat exists in map visually
    const seatEl = document.getElementById(`seat-${inputValue}`);
    
    // Deselect current
    if (selectedSeat) {
        const oldSeat = document.getElementById(`seat-${selectedSeat}`);
        if(oldSeat) oldSeat.classList.remove('selected');
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
            if(seatEl && seatEl.classList.contains('taken')) errorMsg.textContent = "Seat is already taken.";
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

// Visual Map Rendering
function initSeatGrid() {
    const grid = document.getElementById('seatGrid');
    if (!grid) return;
    grid.innerHTML = '';

    layout.forEach((rowData) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'seat-row';

        const rowLabelDiv = document.createElement('div');
        rowLabelDiv.className = 'row-label';
        rowLabelDiv.textContent = rowData.row;
        rowDiv.appendChild(rowLabelDiv);

        let currentSeatNum = 1;

        rowData.blocks.forEach((blockSize, index) => {
            const blockDiv = document.createElement('div');
            blockDiv.className = 'seat-block';

            for (let i = 0; i < blockSize; i++) {
                const seatDiv = document.createElement('div');
                seatDiv.className = 'seat';
                
                const seatId = `${rowData.row}${currentSeatNum}`;
                seatDiv.id = `seat-${seatId}`;
                
                if (takenSeats.includes(seatId)) {
                    seatDiv.classList.add('taken');
                } else {
                    seatDiv.classList.add('available');
                    // Binding click function properly by capturing current num value
                    const pinnedNum = currentSeatNum;
                    seatDiv.onclick = () => handleVisualSeatClick(rowData.row, pinnedNum, seatDiv);
                }
                
                seatDiv.innerHTML = `<span>${currentSeatNum}</span>`;
                blockDiv.appendChild(seatDiv);
                currentSeatNum++;
            }

            if (blockSize > 0 && index < 2 && rowData.blocks[index+1] > 0) {
                blockDiv.style.marginRight = '2rem';
            }

            rowDiv.appendChild(blockDiv);
        });

        const rowLabelRightDiv = document.createElement('div');
        rowLabelRightDiv.className = 'row-label';
        rowLabelRightDiv.textContent = rowData.row;
        rowDiv.appendChild(rowLabelRightDiv);

        grid.appendChild(rowDiv);
    });
}

function renderSchools() {
    const grid = document.getElementById('schoolGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    schools.forEach(school => {
        const div = document.createElement('div');
        div.className = 'selectable-card';
        div.textContent = school;
        
        div.onclick = () => {
            document.querySelectorAll('#schoolGrid .selectable-card').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedSchool = school;
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
        // Generate initials from Actor Name
        const initials = cand.actor.split(' ').map(n => n[0]).join('');
        
        const div = document.createElement('div');
        div.className = 'actor-card selectable-card';
        
        div.innerHTML = `
            <div class="avatar-large">${initials}</div>
            <div class="actor-info-text">
                <h3 class="character-name">${cand.character}</h3>
                <p class="actor-name">${cand.actor}</p>
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
            selectedCandidate = `${cand.character} (${cand.actor})`;
            
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
    document.getElementById('reviewSeat').textContent = selectedSeat;
    document.getElementById('reviewSchool').textContent = selectedSchool;
    document.getElementById('reviewCandidate').textContent = selectedCandidate;
}

// Scroll Intersection Observer
function setupScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal').forEach(section => {
        observer.observe(section);
    });
}

// Live Countdown Demo Timer
function initCountdown() {
    const countdownEl = document.getElementById('countdown');
    if (!countdownEl) return;
    const target = new Date().getTime() + (2 * 60 * 60 * 1000);
    
    setInterval(() => {
        const now = new Date().getTime();
        const distance = target - now;
        
        if (distance < 0) {
            countdownEl.innerHTML = "CLOSED";
            return;
        }
        
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        
        countdownEl.innerHTML = 
            `${h.toString().padStart(2, '0')} : ${m.toString().padStart(2, '0')} : ${s.toString().padStart(2, '0')}`;
    }, 1000);
}

// Final Action
function submitVote() {
    document.getElementById('successModal').classList.remove('hidden');
}
