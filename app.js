// --- APPLICATION STATE PROXIES ---
let database = [];
let activeCardIndexInStudy = null;
let temporaryIngestionObject = null;

// Initialize Application Lifecycle Hooks
window.onload = function() {
  synchronizeDatabaseFromCloud();
};

// --- READ OPERATION: REMOTE GOOGLE SHEET OVERLAY SYNCHRONIZER ---
async function synchronizeDatabaseFromCloud() {
  const target = document.getElementById('dashboard-queue-injection');
  const sheetEndpoint = localStorage.getItem('foundation_sheet_url');

  if (!sheetEndpoint) {
    target.innerHTML = `
      <div style="text-align:center; padding:48px 24px; color:var(--text-muted); font-size:0.9rem;">
        <p style="margin-bottom:16px;">App storage routing configurations required.</p>
        <button class="action-btn btn-dark" style="max-width:200px; margin:0 auto; padding:10px;" onclick="openSettingsModal()">Configure Vault</button>
      </div>
    `;
    return;
  }
  
  target.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.9rem;">Syncing review matrix queue...</div>`;
  
  try {
    const response = await fetch(sheetEndpoint);
    const result = await response.json();
    
    if (result.success) {
      database = result.data;
      renderDashboardQueue();
    } else {
      triggerSnackbar("warning", "Database sync failed: " + result.error);
    }
  } catch (error) {
    console.error("Network communication failure detailed logs:", error);
    triggerSnackbar("warning", "Could not connect to database cloud engine.");
    target.innerHTML = `<div style="text-align:center; padding:32px; color:var(--accent-engraving); font-size:0.9rem;">Database Offline</div>`;
  }
}

// --- NAVIGATION VIEW MATRIX ROUTERS ---
function showDashboard() {
  document.getElementById('view-study').classList.remove('active');
  document.getElementById('view-add-verse').classList.remove('active');
  document.getElementById('view-dashboard').classList.add('active');
  document.getElementById('study-card').classList.remove('flipped');
  synchronizeDatabaseFromCloud();
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

  if (database.length === 0) {
    target.innerHTML = `<div style="text-align:center; padding:48px 24px; color:var(--text-muted); font-size:0.9rem;">Queue is empty.</div>`;
    return;
  }

  database.forEach((item, index) => {
    let reference = item.reference || item.Reference || 'Unknown Reference';
    let phase = (item.phase || item.Phase || 'engraving').toLowerCase();
    
    let rawReps = item.repsLeft !== undefined ? item.repsLeft : (item.RepsLeft !== undefined ? item.RepsLeft : 15);
    let repsLeft = parseInt(rawReps);
    if (isNaN(repsLeft)) repsLeft = 15;

    let currentDay = parseInt(item.currentDay || item.CurrentDay || item.dayCount || item.DayCount) || 1;
    
    let titleLabel = "";
    let badgeText = "";

    if (phase === 'engraving') {
      titleLabel = `Engraving Mode`;
      badgeText = repsLeft <= 0 ? "Done Today" : `${repsLeft} Left`;
    } else if (phase === 'retention') {
      titleLabel = `Retention — Day ${currentDay}`;
      badgeText = `Day ${currentDay}/50`;
    } else {
      titleLabel = `Matured System`;
      badgeText = `Monthly`;
    }
    
    let row = document.createElement('div');
    row.className = `queue-item item-${phase}`;
    row.onclick = () => launchStudyMode(index);
    row.innerHTML = `
      <div class="item-content">
        <h3>${reference}</h3>
        <div class="item-phase-lbl">${titleLabel}</div>
      </div>
      <div class="item-counter">${badgeText}</div>
    `;
    target.appendChild(row);
  });
}

// --- VIEW 2: CARD FOCUS FLIP ENGINE ---
function launchStudyMode(index) {
  activeCardIndexInStudy = index;
  const targetItem = database[index];
  
  let reference = targetItem.reference || targetItem.Reference || 'No Reference';
  let phase = (targetItem.phase || targetItem.Phase || 'engraving').toLowerCase();
  let text = targetItem.text || targetItem.Text || 'No text found';
  
  let rawReps = targetItem.repsLeft !== undefined ? targetItem.repsLeft : (targetItem.RepsLeft !== undefined ? targetItem.RepsLeft : 15);
  let repsLeft = parseInt(rawReps);
  if (isNaN(repsLeft)) repsLeft = 15;

  let currentDay = parseInt(targetItem.currentDay || targetItem.CurrentDay || targetItem.dayCount || targetItem.DayCount) || 1;

  document.getElementById('card-reference-title').innerText = reference;
  document.getElementById('card-cipher-render').innerText = text;

  const frontTheme = document.getElementById('card-front-theme');
  const label = document.getElementById('card-tag-label');
  const trackingAreaFront = document.getElementById('card-tracking-render-front');
  const trackingAreaBack = document.getElementById('card-tracking-render-back');
  
  frontTheme.className = "face";
  document.getElementById('study-card').classList.remove('flipped');

  if (phase === 'engraving') {
    frontTheme.classList.add('face-engraving');
    label.innerText = "Engraving Mode";
    
    if (repsLeft <= 0) {
      trackingAreaFront.innerHTML = `
        <div class="numeric-display" id="reps-display-box" style="color:var(--accent-retention); font-size:1.3rem; margin-bottom:4px;">Done for today!</div>
        <div class="mini-ticker">Flip card over to finalize progress.</div>
      `;
    } else {
      trackingAreaFront.innerHTML = `
        <div class="numeric-display" id="reps-display-box" style="color:var(--text-main); font-size:1.4rem; margin-bottom:4px;">${repsLeft} Left</div>
        <button class="action-btn btn-dark" style="padding:10px 16px; font-size:0.8rem; margin-top:8px;" onclick="handleInternalTicker(event)">Log Repetition (-1)</button>
      `;
    }
  } else if (phase === 'retention') {
    frontTheme.classList.add('face-retention');
    label.innerText = `Retention Mode (Day ${currentDay}/50)`;
    trackingAreaFront.innerHTML = `
      <div class="numeric-label-clean" style="font-size:1.1rem; color:var(--text-main); font-weight:600;">Review Scheduled</div>
      <div class="mini-ticker">Tap card to verify accuracy.</div>
    `;
  } else {
    frontTheme.classList.add('face-matured');
    label.innerText = "Matured Maintenance";
    trackingAreaFront.innerHTML = `
      <div class="numeric-label-clean" style="font-size:1.1rem; color:var(--text-main); font-weight:600;">Monthly Checkup</div>
    `;
  }

  trackingAreaBack.innerHTML = `
    <button class="action-btn btn-accent-complete" style="width:100%; font-weight:700;" onclick="confirmCompletion(event)">Mark Review Complete</button>
  `;

  document.getElementById('view-dashboard').classList.remove('active');
  document.getElementById('view-study').classList.add('active');
}

function toggleCardFlip() {
  document.getElementById('study-card').classList.toggle('flipped');
}

function handleInternalTicker(event) {
  event.stopPropagation();
  let activeItem = database[activeCardIndexInStudy];
  if (!activeItem) return;

  let repsKey = activeItem.repsLeft !== undefined ? 'repsLeft' : (activeItem.RepsLeft !== undefined ? 'RepsLeft' : 'repsLeft');
  let reps = parseInt(activeItem[repsKey]);
  if (isNaN(reps)) reps = 15;

  if (reps <= 0) {
    triggerSnackbar("success", "You are already done with this card for today!");
    return;
  }

  reps--;
  activeItem[repsKey] = reps; 

  const displayBox = document.getElementById('reps-display-box');
  if (reps > 0) {
    displayBox.innerText = `${reps} Left`;
    triggerSnackbar("success", `Repetition logged. ${reps} remaining.`);
  } else {
    triggerSnackbar("success", "Session complete! Flip card to save to the sheet.");
    
    let trackingAreaFront = document.getElementById('card-tracking-render-front');
    trackingAreaFront.innerHTML = `
      <div class="numeric-display" id="reps-display-box" style="color:var(--accent-retention); font-size:1.3rem; margin-bottom:4px;">Done for today!</div>
      <div class="mini-ticker">Flip card over to finalize progress.</div>
    `;
  }
}

async function confirmCompletion(event) {
  event.stopPropagation();
  const sheetEndpoint = localStorage.getItem('foundation_sheet_url');
  let activeItem = database[activeCardIndexInStudy];
  
  if (!activeItem || !sheetEndpoint) return;
  
  triggerSnackbar("success", "Saving updates to cloud...");

  let phaseKey = activeItem.phase ? 'phase' : (activeItem.Phase ? 'Phase' : 'phase');
  let dayKey = activeItem.currentDay ? 'currentDay' : (activeItem.CurrentDay ? 'CurrentDay' : 'currentDay');
  let repsKey = activeItem.repsLeft !== undefined ? 'repsLeft' : (activeItem.RepsLeft !== undefined ? 'RepsLeft' : 'repsLeft');

  let phase = (activeItem[phaseKey] || 'engraving').toLowerCase();
  let repsLeft = parseInt(activeItem[repsKey]);
  let currentDay = parseInt(activeItem[dayKey]) || 1;

  if (isNaN(repsLeft)) repsLeft = 15;

  if (phase === 'engraving') {
    if (repsLeft <= 0) {
      activeItem.phase = "retention";
      activeItem.currentDay = 1;
      activeItem.repsLeft = 0;
    } else {
      activeItem.phase = "engraving";
      activeItem.repsLeft = repsLeft;
      activeItem.currentDay = currentDay;
    }
  } else if (phase === 'retention') {
    if (currentDay >= 50) {
      activeItem.phase = "matured";
      activeItem.currentDay = 50;
      activeItem.repsLeft = 0;
    } else {
      activeItem.phase = "retention";
      activeItem.currentDay = currentDay + 1;
      activeItem.repsLeft = 0;
    }
  } else {
    activeItem.phase = "matured";
    activeItem.currentDay = 50;
    activeItem.repsLeft = 0;
  }

  const synchronizedPayload = {
    id: activeItem.id || activeItem.Id,
    reference: activeItem.reference || activeItem.Reference,
    phase: activeItem.phase,
    text: activeItem.text || activeItem.Text,
    cipher: activeItem.cipher || activeItem.Cipher,
    repsLeft: activeItem.repsLeft,
    currentDay: activeItem.currentDay
  };

  try {
    await fetch(sheetEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(synchronizedPayload)
    });
    
    triggerSnackbar("success", "Progress recorded successfully.");
    setTimeout(() => { showDashboard(); }, 800);
  } catch (error) {
    console.error("Write error:", error);
    triggerSnackbar("warning", "Could not sync layout updates.");
  }
}

// --- VIEW 3: LIVE ESV API AND PERSISTENCE WRITER ---
function generateFirstLetterCipher(text) {
  return text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()""’]/g, "")
    .split(/\s+/)
    .map(word => word.charAt(0))
    .join(" ") + "...";
}

async function executeFetchPipeline() {
  const referenceInput = document.getElementById('verse-reference').value.trim();
  const apiKey = localStorage.getItem('esv_api_key');
  const sheetEndpoint = localStorage.getItem('foundation_sheet_url');
  
  if (!sheetEndpoint || !apiKey) {
    openSettingsModal();
    return;
  }

  if (!referenceInput) {
    triggerSnackbar("warning", "Please provide a verse reference.");
    return;
  }

  const verseExists = database.some(item => {
    let ref = item.reference || item.Reference || '';
    return ref.toLowerCase() === referenceInput.toLowerCase();
  });
  
  if (verseExists) {
    triggerSnackbar("warning", "This text is already in your study queue.");
    return;
  }

  triggerSnackbar("success", "Contacting ESV Engine...");

  try {
    const url = `https://api.esv.org/v3/passage/text/?q=${encodeURIComponent(referenceInput)}&include-headings=false&include-footnotes=false&include-verse-numbers=false&include-short-copyright=false&include-passage-references=false`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Token ${apiKey}` }
    });
    
    const data = await response.json();
    
    if (!data.passages || data.passages.length === 0 || data.passages[0].trim() === "") {
      triggerSnackbar("warning", "Verse reference not found. Verify syntax.");
      return;
    }

    const cleanFetchedText = data.passages[0].trim().replace(/\s+/g, " ");
    const builtCipher = generateFirstLetterCipher(cleanFetchedText);

    document.getElementById('fetched-text-render').innerText = `"${cleanFetchedText}"`;
    document.getElementById('cipher-text-render').innerText = builtCipher;
    
    document.getElementById('ingestion-preview-panel').classList.add('active');
    document.getElementById('form-execution-footer').style.display = "flex";

    temporaryIngestionObject = {
      reference: referenceInput,
      phase: "engraving",
      text: cleanFetchedText,
      cipher: builtCipher,
      repsLeft: 15,
      currentDay: 1
    };

  } catch (error) {
    console.error("API call error:", error);
    triggerSnackbar("warning", "Failed to retrieve text from ESV API endpoint.");
  }
}

async function commitVerseToDatabase() {
  const sheetEndpoint = localStorage.getItem('foundation_sheet_url');
  if (!temporaryIngestionObject || !sheetEndpoint) return;
  
  triggerSnackbar("success", "Saving text data...");
  
  try {
    await fetch(sheetEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(temporaryIngestionObject)
    });
    
    triggerSnackbar("success", `${temporaryIngestionObject.reference} added to study queue.`);
    setTimeout(() => { showDashboard(); }, 800);
  } catch (error) {
    console.error("Write error:", error);
    triggerSnackbar("warning", "Failed to write record to remote cloud sheet.");
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
  document.getElementById('modal-sheet-url-input').value = localStorage.getItem('foundation_sheet_url') || "";
  document.getElementById('modal-api-key-input').value = localStorage.getItem('esv_api_key') || "";
  document.getElementById('settings-modal').classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('active');
}

function saveSettingsCredentials() {
  const sheetUrlVal = document.getElementById('modal-sheet-url-input').value.trim();
  const apiKeyVal = document.getElementById('modal-api-key-input').value.trim();
  
  localStorage.setItem('foundation_sheet_url', sheetUrlVal);
  localStorage.setItem('esv_api_key', apiKeyVal);
  
  closeSettingsModal();
  triggerSnackbar("success", "Security vault credentials updated.");
  showDashboard();
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
