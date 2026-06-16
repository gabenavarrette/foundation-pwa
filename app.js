/**
 * FOUNDATION - SCRIPTURE MEMORY ENGINE (app.js)
 * Fully standalone frontend application controller.
 */

// ==========================================
// 1. CONFIGURATION & STATE MANAGEMENT
// ==========================================
const CONFIG = {
    get sheetUrl() { return localStorage.getItem('foundation_sheet_url') || ''; },
    set sheetUrl(val) { localStorage.setItem('foundation_sheet_url', val.trim()); },
    
    get esvKey() { return localStorage.getItem('foundation_esv_key') || ''; },
    set esvKey(val) { localStorage.setItem('foundation_esv_key', val.trim()); }
};

// Application reactive runtime state
let currentVerses = [];

// ==========================================
// 2. FIRST-LETTER CIPHER ALGORITHM
// ==========================================
/**
 * Transforms full text into a first-letter cipher while rigorously preserving punctuation.
 * Example: "I can do all things..." -> "I c d a t..."
 */
function generateCipher(text) {
    if (!text) return '';
    return text
        .split(/\s+/) 
        .map(word => {
            if (!word) return '';
            // Locate the initial alphanumeric marker inside the parsed string chunk
            const firstLetterMatch = word.match(/[a-zA-Z0-9]/);
            if (!firstLetterMatch) return word; 
            
            const firstLetterIndex = firstLetterMatch.index;
            const firstLetter = firstLetterMatch[0];
            
            const beforePunctuation = word.slice(0, firstLetterIndex);
            const afterPunctuation = word.slice(firstLetterIndex + 1);
            
            // Isolate trailing punctuation marks from alpha characters
            const cleanAfterPunctuation = afterPunctuation.replace(/[a-zA-Z0-9]/g, '');
            
            return beforePunctuation + firstLetter + cleanAfterPunctuation;
        })
        .join(' ');
}

// ==========================================
// 3. SPACED REPETITION LOGIC (SRS)
// ==========================================
function calculateNextSRSState(currentPhase, currentDay) {
    let nextPhase = currentPhase;
    let nextDay = currentDay + 1;
    let daysToAdd = 1;

    switch (currentPhase) {
        case 1:
            if (nextDay > 5) {
                nextPhase = 2;
                nextDay = 1;
                daysToAdd = 1;
            } else {
                daysToAdd = 1;
            }
            break;
            
        case 2:
            if (nextDay > 45) {
                nextPhase = 3;
                nextDay = 1;
                daysToAdd = 7; 
            } else {
                daysToAdd = 1;
            }
            break;
            
        case 3:
            if (nextDay > 7) {
                nextPhase = 4;
                nextDay = 1;
                daysToAdd = 30; 
            } else {
                daysToAdd = 7;
            }
            break;
            
        case 4:
            daysToAdd = 30;
            break;
    }

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + daysToAdd);

    return {
        phase: nextPhase,
        dayInPhase: nextDay,
        nextDueDate: nextDueDate.toISOString().split('T')[0]
    };
}

function getTargetRepsLabel(phase, dayInPhase) {
    if (phase === 1) {
        return `${30 - (dayInPhase * 5)}x today`;
    }
    if (phase === 2) return "1x today";
    if (phase === 3) return "1x this week";
    return "1x this month";
}

function getPhaseName(phase) {
    const names = { 1: 'DEEP BURN', 2: 'DAILY SOLIDIFY', 3: 'WEEKLY MAINT.', 4: 'LIFETIME' };
    return names[phase] || '';
}

// ==========================================
// 4. UI RENDERING ENGINE
// ==========================================
function renderGrid(verses) {
    const grid = document.getElementById('card-grid');
    if (!grid) return;

    // 1. Clear out any old placeholders exactly once BEFORE the loop starts
    grid.innerHTML = '';

    if (verses.length === 0) {
        grid.innerHTML = `<div class="no-cards">No verses found due for review today. Clean slate!</div>`;
        return;
    }

    // 2. Loop through all fetched database rows
    verses.forEach(verse => {
        // Create the card string layout
        const cardHtml = `
            <div class="card" data-id="${verse.id}">
                <div class="phase-bar phase-${verse.phase}"></div>
                <div class="card-header">
                    <span class="verse-reference">${verse.reference}</span>
                    <span class="phase-badge">Phase ${verse.phase}</span>
                </div>
                <div class="card-body">
                    <!-- Cipher view showing first letters -->
                    <p class="cipher-text">${verse.cipher}</p>
                    <!-- Full text hidden by default -->
                    <p class="full-text hidden">${verse.text}</p>
                </div>
                <div class="card-actions">
                    <button class="secondary-btn toggle-text-btn" onclick="toggleText('${verse.id}')">Reveal</button>
                    <button class="primary-btn complete-btn" onclick="completeReview('${verse.id}')">Complete</button>
                </div>
            </div>
        `;

        // 3. CRUCIAL: Use += to APPEND each card. 
        // If you only use =, it overwrites the grid every time, leaving only the last row!
        grid.innerHTML += cardHtml;
    });
}

// ==========================================
// 5. DATA SYNC & API OPERATORS
// ==========================================
function fetchSheetData() {
    if (!CONFIG.sheetUrl) return;

    console.log("Attempting database fetch from: ", CONFIG.sheetUrl);

    // Standard GET requests to Apps Script MUST not have restrictive modes
    fetch(`${CONFIG.sheetUrl}?action=getVerses`, {
        method: 'GET',
        redirect: 'follow' // Force the browser to follow Google's 302 redirect chain
    })
    .then(res => {
        console.log("Network raw response received. Status:", res.status);
        if (!res.ok) throw new Error(`HTTP Error Status: ${res.status}`);
        return res.json();
    })
    .then(data => {
        if (data.error) {
            console.error("Backend Apps Script Exception:", data.error);
            alert("Backend Error: " + data.error);
            return;
        }
        console.log("Database fetch successful. Rows found:", data.length);
        currentVerses = data;
        renderGrid(currentVerses);
    })
    .catch(err => {
        console.error("Critical Fetch Fail Routine:", err);
        
        // Visual warning indicator directly on dashboard grid
        const grid = document.getElementById('card-grid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 2rem; border: 1px dashed #333; margin-top: 2rem;">
                    <p style="color: #ff4a4a; font-weight: bold; margin-bottom: 0.5rem;">Database Sync Blocked (302/CORS)</p>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; max-width: 400px; margin: 0 auto 1rem;">
                        The browser blocked the redirect from Google Sheets. This usually means the web app was not deployed to 'Anyone'.
                    </p>
                    <button onclick="fetchSheetData()" class="primary-btn" style="padding: 0.5rem 1rem; font-size: 0.8rem;">Retry Connection</button>
                </div>`;
        }
    });
}

function handleVerseCompletion(id) {
    const verse = currentVerses.find(v => v.id === id);
    if (!verse) return;

    const nextSRS = calculateNextSRSState(Number(verse.phase), Number(verse.current_day_in_phase));
    document.getElementById(`card-${id}`).classList.remove('flipped');

    verse.phase = nextSRS.phase;
    verse.current_day_in_phase = nextSRS.dayInPhase;
    renderGrid(currentVerses);

    if (!CONFIG.sheetUrl) return;

    const updatePayload = {
        action: 'completeVerse',
        id: id,
        phase: nextSRS.phase,
        current_day_in_phase: nextSRS.dayInPhase,
        next_due_date: nextSRS.nextDueDate,
        last_recited_date: new Date().toISOString().split('T')[0]
    };

    fetch(CONFIG.sheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
    }).catch(err => console.error("Sync log tracking transaction error: ", err));
}

function handleAddVerse(reference) {
    if (!reference) return;
    
    if (!CONFIG.esvKey || !CONFIG.sheetUrl) {
        alert("Please set up both your ESV API Key and Sheet URL in Settings first.");
        return;
    }

    const cleanRef = encodeURIComponent(reference);
    const esvUrl = `https://api.esv.org/v3/passage/text/?q=${cleanRef}&include-headings=false&include-footnotes=false&include-verse-numbers=false&include-short-copyright=false&include-passage-references=false`;

    fetch(esvUrl, {
        headers: { 'Authorization': `Token ${CONFIG.esvKey}` }
    })
    .then(res => res.json())
    .then(data => {
        if (!data.passages || data.passages.length === 0) {
            alert("Could not locate that passage reference. Verify syntax.");
            return;
        }

        const fullText = data.passages[0].trim();
        const generatedCipher = generateCipher(fullText); // Generate it pre-sync
        
        const newVersePayload = {
            action: 'addVerse',
            reference: data.query,
            text: fullText,
            phase: 1,
            cipher: generatedCipher, // Included in payload tracking schema shifts
            current_day_in_phase: 1,
            next_due_date: new Date().toISOString().split('T')[0]
        };

        return fetch(CONFIG.sheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newVersePayload)
        });
    })
    .then(() => {
        setTimeout(fetchSheetData, 1000); 
    })
    .catch(err => console.error("Scripture creation lookup sequence exception: ", err));
}

// ==========================================
// 6. DOM SYSTEM WIRING MODALS & INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('settings-btn');
    const addVerseBtn = document.getElementById('add-verse-btn');
    
    setupModalDOMElements();

    const settingsModal = document.getElementById('settings-modal');
    const addModal = document.getElementById('add-modal');
    
    document.getElementById('sheet-url-input').value = CONFIG.sheetUrl;
    document.getElementById('esv-key-input').value = CONFIG.esvKey;

    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    addVerseBtn.addEventListener('click', () => addModal.classList.add('active'));

    document.getElementById('save-settings-btn').addEventListener('click', () => {
        CONFIG.sheetUrl = document.getElementById('sheet-url-input').value;
        CONFIG.esvKey = document.getElementById('esv-key-input').value;
        settingsModal.classList.remove('active');
        fetchSheetData();
    });

    document.getElementById('save-verse-btn').addEventListener('click', () => {
        const refInput = document.getElementById('verse-ref-input');
        handleAddVerse(refInput.value);
        refInput.value = '';
        addModal.classList.remove('active');
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) backdrop.classList.remove('active');
        });
    });

    if (CONFIG.sheetUrl) {
        fetchSheetData();
    } else {
        currentVerses = [
            { id: "demo1", reference: "Proverbs 4:7", text: "The beginning of wisdom is this: Get wisdom, and whatever you get, get insight.", phase: 1, cipher: "T b o w i t: G w, a w y g, g i.", current_day_in_phase: 1 }
        ];
        renderGrid(currentVerses);
    }
});

function setupModalDOMElements() {
    if (!document.getElementById('settings-modal')) {
        const settings = document.createElement('div');
        settings.id = 'settings-modal';
        settings.className = 'modal-backdrop';
        settings.innerHTML = `
            <div class="modal-content" style="background: var(--bg-card); padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 4px; max-width: 400px; width: 90%; margin: 20vh auto;">
                <h3 style="margin-bottom: 1rem; font-family: var(--font-brand);">SETTINGS</h3>
                <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Google Sheets Web App URL</label>
                <input type="text" id="sheet-url-input" style="width:100%; padding: 0.5rem; background: var(--bg-dark); border: 1px solid var(--border-color); color: var(--text-primary); margin-bottom: 1rem; border-radius: 3px;">
                <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">ESV API Authorization Key</label>
                <input type="password" id="esv-key-input" style="width:100%; padding: 0.5rem; background: var(--bg-dark); border: 1px solid var(--border-color); color: var(--text-primary); margin-bottom: 1.5rem; border-radius: 3px;">
                <button id="save-settings-btn" class="primary-btn" style="width: 100%;">Save Settings</button>
            </div>`;
        document.body.appendChild(settings);
    }

    if (!document.getElementById('add-modal')) {
        const add = document.createElement('div');
        add.id = 'add-modal';
        add.className = 'modal-backdrop';
        add.innerHTML = `
            <div class="modal-content" style="background: var(--bg-card); padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 4px; max-width: 400px; width: 90%; margin: 20vh auto;">
                <h3 style="margin-bottom: 1rem; font-family: var(--font-brand);">ADD VERSE</h3>
                <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Scripture Reference</label>
                <input type="text" id="verse-ref-input" placeholder="e.g., Romans 12:1-2" style="width:100%; padding: 0.5rem; background: var(--bg-dark); border: 1px solid var(--border-color); color: var(--text-primary); margin-bottom: 1.5rem; border-radius: 3px;">
                <button id="save-verse-btn" class="primary-btn" style="width: 100%;">Fetch & Add Verse</button>
            </div>`;
        document.body.appendChild(add);
    }
}

// Register the Service Worker for PWA compliance
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Foundation Service Worker Registered Successfully! Scope:', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}
