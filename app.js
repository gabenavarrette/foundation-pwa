// --- APPLICATION STATE (LOCAL STORAGE DATABASE PROXY) ---
let database = [
  { id: 1, reference: "Romans 12:2", phase: "engraving", text: "Do not be conformed to this world, but be transformed by the renewal of your mind.", cipher: "D n b c t t w, b b y t b t r o y m.", metrics: "15 Left", dayCount: 3 },
  { id: 2, reference: "Philippians 4:6", phase: "retention", text: "Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.", cipher: "D n b a a a, b i e b p a s w t l y r b m k t G.", metrics: "24 / 45", dayCount: 24 },
  { id: 3, reference: "Psalm 23:1", phase: "matured", text: "The Lord is my shepherd; I shall not want.", cipher: "T L i m s; I s n w.", metrics: "Monthly", dayCount: 60 }
];

let activeCardIndexInStudy = null;
let temporaryIngestionObject = null;

// Initialize Application Lifecycle Hooks
window.onload = function() {
  renderDashboardQueue();
};

// --- NAVIGATION VIEW MATRIX ROUTERS ---
function showDashboard() {
  document.getElementById('view-study').classList.remove('active');
  document.getElementById('view-add-verse').classList.remove('active');
  document.getElementById('view-dashboard').classList.add('active');
  document.getElementById('study-card').classList.remove('flipped');
  renderDashboardQueue();
}

function showAddVerse() {
  document.getElementById('view-dashboard').classList.remove('active');
  document.getElementById('view-add-verse').classList.add('active');
  resetIngestionForm();
}

// --- VIEW 1: DASHBOARD COMPILER ---
function renderDashboardQueue() {
  const target = document.getElementById('dashboard-queue-injection');
  const counterNode = document.getElementById('dashboard-pending-count');
  target.innerHTML = "";
  counterNode.innerText = database.length;

  database.forEach((item, index) => {
    let titleLabel = item.phase === 'engraving' ? `Engraving — Day ${item.dayCount}` : item.phase === 'retention' ? `Retention — Day ${item.dayCount}` : `Matured`;
    let row = document.createElement('div');
    row.className = `queue-item item-${item.phase}`;
    row.onclick = () => launchStudyMode(index);
    row.innerHTML = `
      <div class="item-content">
        <h3>${item.reference}</h3>
        <div class="item-phase-lbl">${titleLabel}</div>
      </div>
      <div class="item-counter">${item.metrics}</div>
    `;
    target.appendChild(row);
  });
}

// --- VIEW 2: CARD FOCUS FLIP ENGINE ---
function launchStudyMode(index) {
  activeCardIndexInStudy = index;
  const targetItem = database[index];
  document.getElementById('card-reference-title').innerText = targetItem.reference;
  document.getElementById('card-cipher-render').innerText = targetItem.cipher;

  const frontTheme = document.getElementById('card-front-theme');
  const label = document.getElementById('card-tag-label');
  const trackingArea = document.getElementById('card-tracking-render');
  frontTheme.className = "face";

  if (targetItem.phase === 'engraving') {
    frontTheme.classList.add('face-engraving');
    label.innerText = "Engraving";
    trackingArea.innerHTML = `
      <div class="numeric-display">25 &nbsp; 20 &nbsp; <span class="active-num">15</span> &nbsp; 10 &nbsp; 5</div>
      <div class="mini-ticker" id="ticker-target">Tap card body to record repetition</div>
    `;
  } else if (targetItem.phase === 'retention') {
    frontTheme.classList.add('face-retention');
    label.innerText = "Retention";
    trackingArea.innerHTML = `
      <div class="numeric-label-clean">Day ${targetItem.dayCount} of 50</div>
      <div class="mini-ticker">Log single daily recital</div>
    `;
  } else if (targetItem.phase === 'matured') {
    frontTheme.classList.add('face-matured');
    label.innerText = "Matured";
    trackingArea.innerHTML = `
      <div class="numeric-label-clean">Monthly Routine</div>
      <div class="mini-ticker">Scheduled maintenance state</div>
    `;
  }
  document.getElementById('view-dashboard').classList.remove('active');
  document.getElementById('view-study').classList.add('active');
}

function toggleCardFlip() {
  document.getElementById('study-card').classList.toggle('flipped');
}

function handleInternalTicker(event) {
  event.stopPropagation(); // Prevents card flipping when recording progress
  let activeItem = database[activeCardIndexInStudy];
  if (activeItem && activeItem.phase === 'engraving') {
    triggerSnackbar("success", "Repetition recorded.");
  }
}

function confirmCompletion() {
  triggerSnackbar("success", "Review marked complete.");
  showDashboard();
}

// --- VIEW 3: CIPHER PIPELINE ENGINE ---
function generateFirstLetterCipher(text) {
  return text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()""’]/g, "") // Clean string from grammar tokens
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join(" ") + "...";
}

function executeFetchPipeline() {
  const referenceInput = document.getElementById('verse-reference').value.trim();
  
  // Verify API credentials inside browser memory container vault
  const localToken = localStorage.getItem('esv_api_key');
  if (!localToken) {
    openSettingsModal();
    return;
  }

  if (!referenceInput) {
    triggerSnackbar("warning", "Please provide a verse reference.");
    return;
  }

  // Cross-reference current input to block record collisions
  const verseExists = database.some(item => item.reference.toLowerCase() === referenceInput.toLowerCase());
  if (verseExists) {
    triggerSnackbar("warning", "This text is already in your study queue.");
    return;
  }

  // Simulated fallback mock pulling matrix block
  let mockPayloadText = "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.";
  if(referenceInput.toLowerCase().includes("proverbs")) {
    mockPayloadText = "Trust in the Lord with all your heart, and do not lean on your own understanding.";
  }

  let builtCipher = generateFirstLetterCipher(mockPayloadText);

  document.getElementById('fetched-text-render').innerText = `"${mockPayloadText}"`;
  document.getElementById('cipher-text-render').innerText = builtCipher;
  
  document.getElementById('ingestion-preview-panel').classList.add('active');
  document.getElementById('form-execution-footer').style.display = "flex";

  temporaryIngestionObject = {
    id: database.length + 1,
    reference: referenceInput,
    phase: "engraving",
    text: mockPayloadText,
    cipher: builtCipher,
    metrics: "25 Left",
    dayCount: 1
  };
}

function commitVerseToDatabase() {
  if (temporaryIngestionObject) {
    database.push(temporaryIngestionObject);
    triggerSnackbar("success", `${temporaryIngestionObject.reference} added to study queue.`);
    showDashboard();
  }
}

function resetIngestionForm() {
  document.getElementById('verse-reference').value = "";
  document.getElementById('ingestion-preview-panel').classList.remove('active');
  document.getElementById('form-execution-footer').style.display = "none";
  temporaryIngestionObject = null;
}

// --- SYSTEM MODULE CONTROLLERS (MODALS & NOTIFICATIONS) ---
function openSettingsModal() {
  const storedKey = localStorage.getItem('esv_api_key') || "";
  document.getElementById('modal-api-key-input').value = storedKey;
  document.getElementById('settings-modal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('active');
}

function saveSettingsCredentials() {
  const inputVal = document.getElementById('modal-api-key-input').value.trim();
  localStorage.setItem('esv_api_key', inputVal);
  closeSettingsModal();
  triggerSnackbar("success", "API configurations updated.");
}

function triggerSnackbar(type, message) {
  const bar = document.getElementById('global-notification-bar');
  const iconTarget = document.getElementById('snackbar-icon-target');
  const msgTarget = document.getElementById('snackbar-message-target');
  
  bar.className = `snackbar show snackbar-${type}`;
  msgTarget.innerText = message;

  if(type === 'success') {
    iconTarget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="#10b981"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
  } else {
    iconTarget.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="#ef4444"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>`;
  }

  setTimeout(() => { bar.classList.remove('show'); }, 3000);
}
