const DB_KEY = 'medvault_full_data';
const defaultData = {
    users:[{id:'u1',name:'John Doe',relation:'Self'},{id:'u2',name:'Jane Doe',relation:'Spouse'}],
    currentUser:'u1',
    records:[
        {id:'r1',userId:'u1',date:'2026-04-10',doctor:'City Hospital',diagnosis:'Hypertension Checkup',medicines:['Lisinopril'],type:'Visit',image:null},
        {id:'r2',userId:'u1',date:'2026-03-15',doctor:'LabCorp Corp',diagnosis:'Routine Blood Test',medicines:[],type:'Lab',image:null}
    ],
    vitals:{
        'u1':{dates:['Jan','Feb','Mar','Apr'],sugar:[110,105,115,98],bpSys:[130,128,125,120],hba1c:[6.5,6.2,5.9,5.8]},
        'u2':{dates:['Jan','Feb','Mar','Apr'],sugar:[90,92,88,85],bpSys:[110,112,115,110],hba1c:[5.2,5.1,5.0,5.0]}
    },
    reminders:[],
    theme:'light'
};

let appState = JSON.parse(localStorage.getItem(DB_KEY)) || defaultData;
let vitalsChartInstance = null;
let currentTimelineFilter = 'All';
let pendingHbA1c = null;
let pendingUploadedImage = null;

let alarmAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

const drugInteractions = {
    "lisinopril":["ibuprofen","naproxen","potassium"],
    "aspirin":["warfarin","ibuprofen"],
    "metformin":["contrast dye","alcohol"]
};

document.addEventListener("DOMContentLoaded", () => {
    if (!appState.reminders) appState.reminders =[];
    Object.values(appState.vitals).forEach(v => { if (!v.hba1c) v.hba1c = v.dates.map(() => null); });
    document.getElementById('vital-date').valueAsDate = new Date();
    
    applySavedTheme();
    initProfiles();
    renderDashboard();
    renderTimeline();

    setInterval(checkMedicationReminders, 20000);
    checkMedicationReminders();

    init3DCardTilt();
    initParallaxEffect();
});

function saveState() { localStorage.setItem(DB_KEY, JSON.stringify(appState)); }

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebar-overlay').classList.remove('active');
}
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewId}`).classList.add('active');
    const activeNav = document.querySelector(`.nav-item[onclick="switchView('${viewId}')"]`);
    if (activeNav) activeNav.classList.add('active');
    
    if (viewId === 'dashboard') renderDashboard();
    if (viewId === 'timeline') renderTimeline();
    if (viewId === 'reminders') renderReminders();
    
    closeSidebar();
}
function toggleNightMode() {
    const isDark = document.body.classList.toggle('dark-theme');
    appState.theme = isDark ? 'dark' : 'light';
    saveState();
    showToast(isDark ? "Switched to Night Mode" : "Switched to Light Mode");
    renderDashboard();
}
function applySavedTheme() { if (appState.theme === 'dark') document.body.classList.add('dark-theme'); }
function openShareModalFromSidebar() {
    closeSidebar();
    document.getElementById('share-modal').classList.add('active');
    document.getElementById('secure-link-container').classList.add('hidden');
    document.getElementById('generate-link-btn').classList.remove('hidden');
}
function closeShareModal() { document.getElementById('share-modal').classList.remove('active'); }
function generateShareLink() {
    const user = getCurrentUser();
    if (!user) return showToast("No profile selected to share.");
    const expiryVal = document.getElementById('link-expiry').value;
    const token = Math.random().toString(36).substring(2, 15);
    const link = `https://medvault.app/share/${token}?exp=${expiryVal}`;
    document.getElementById('secure-link').value = link;
    document.getElementById('secure-link-container').classList.remove('hidden');
    document.getElementById('generate-link-btn').classList.add('hidden');
    showToast(`Secure link generated for ${user.name}.`);
}
function copyShareLink() {
    const linkInput = document.getElementById('secure-link');
    linkInput.select();
    document.execCommand('copy');
    showToast("Link copied to clipboard!");
}
function openImageViewer(recordId) {
    const record = appState.records.find(r => r.id === recordId);
    if (record && record.image) {
        document.getElementById('viewer-image').src = record.image;
        document.getElementById('image-viewer-modal').classList.add('active');
    } else { showToast("No document image available for this record."); }
}
function closeImageViewer() {
    document.getElementById('image-viewer-modal').classList.remove('active');
    setTimeout(() => { document.getElementById('viewer-image').src = ""; }, 300);
}
function deleteRecord(recordId) {
    if (!confirm("Are you sure you want to permanently delete this record?")) return;
    appState.records = appState.records.filter(r => r.id !== recordId);
    saveState();
    showToast("Record deleted successfully.");
    renderDashboard();
    if (document.getElementById('view-timeline').classList.contains('active')) renderTimeline();
}
function initProfiles() {
    const select = document.getElementById('profile-selector');
    select.innerHTML = '';
    if (appState.users.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = "No Profiles"; select.appendChild(opt); select.disabled = true; return;
    }
    select.disabled = false;
    appState.users.forEach(user => {
        const opt = document.createElement('option');
        opt.value = user.id; opt.textContent = user.name;
        if (user.id === appState.currentUser) opt.selected = true;
        select.appendChild(opt);
    });
}
function switchProfile(userId) {
    appState.currentUser = userId; saveState();
    renderDashboard(); renderTimeline();
    if(document.getElementById('view-reminders').classList.contains('active')) renderReminders();
    showToast(`Switched to ${getCurrentUser().name}`);
}
function getCurrentUser() { return appState.users.find(u => u.id === appState.currentUser) || null; }
function openFamilyModal() { renderFamilyList(); document.getElementById('family-modal').classList.add('active'); }
function closeFamilyModal() { document.getElementById('family-modal').classList.remove('active'); }
function renderFamilyList() {
    const container = document.getElementById('family-list');
    container.innerHTML = appState.users.length ? appState.users.map(user => `
        <div class="family-item">
            <div class="family-item-info"><strong>${user.name}</strong><span>${user.relation}</span></div>
            <button class="delete-member-btn" onclick="removeFamilyMember('${user.id}')" title="Delete Profile"><i class="fa-solid fa-trash-can"></i></button>
        </div>`).join('') : '<p class="text-muted text-sm">No profiles found.</p>';
}
function addFamilyMember() {
    const nameInput = document.getElementById('new-member-name');
    const relInput = document.getElementById('new-member-relation');
    const name = nameInput.value.trim();
    const relation = relInput.value.trim() || 'Dependent';
    if (!name) return showToast("Name cannot be empty!");
    const newId = 'u' + Date.now();
    appState.users.push({ id: newId, name, relation });
    appState.vitals[newId] = { dates:['Jan','Feb','Mar','Apr'], sugar:[0,0,0,0], bpSys:[0,0,0,0], hba1c:[0,0,0,0] };
    if (appState.users.length === 1) appState.currentUser = newId;
    saveState(); nameInput.value = ''; relInput.value = '';
    showToast(`${name} added to the vault.`);
    renderFamilyList(); initProfiles(); renderDashboard(); renderTimeline();
}
function removeFamilyMember(userId) {
    const userToRemove = appState.users.find(u => u.id === userId);
    if (!confirm(`Permanently remove ${userToRemove.name} and all their clinical data?`)) return;
    appState.users = appState.users.filter(u => u.id !== userId);
    appState.records = appState.records.filter(r => r.userId !== userId);
    appState.reminders = appState.reminders.filter(r => r.userId !== userId);
    delete appState.vitals[userId];
    if (appState.currentUser === userId) appState.currentUser = appState.users.length > 0 ? appState.users[0].id : null;
    saveState(); showToast("Profile removed successfully.");
    renderFamilyList(); initProfiles(); renderDashboard(); renderTimeline();
}

document.getElementById('vitals-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return showToast("No profile selected!");
    const dateStr = document.getElementById('vital-date').value;
    const sugar = parseFloat(document.getElementById('vital-sugar').value) || null;
    const bp = parseFloat(document.getElementById('vital-bp').value) || null;
    const hba1c = parseFloat(document.getElementById('vital-hba1c').value) || null;
    if (!dateStr) return showToast("Record Date is required.");
    const parsedDate = new Date(dateStr);
    const month = parsedDate.toLocaleString('default', { month: 'short', timeZone: 'UTC' });
    const userVitals = appState.vitals[user.id];
    const existingIndex = userVitals.dates.indexOf(month);
    if (existingIndex !== -1) {
        if (sugar !== null) userVitals.sugar[existingIndex] = sugar;
        if (bp !== null) userVitals.bpSys[existingIndex] = bp;
        if (hba1c !== null) userVitals.hba1c[existingIndex] = hba1c;
    } else {
        userVitals.dates.push(month); userVitals.sugar.push(sugar);
        userVitals.bpSys.push(bp); userVitals.hba1c.push(hba1c);
    }
    saveState(); showToast("Lab data safely added to graph!");
    document.getElementById('vitals-form').reset();
    document.getElementById('vital-date').valueAsDate = new Date();
    switchView('dashboard');
});

/* ================================================================
   MEDICATION REMINDERS LOGIC
================================================================ */
document.getElementById('reminder-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return showToast('No profile selected!');

    const name = document.getElementById('rem-name').value.trim();
    const time = document.getElementById('rem-time').value;

    appState.reminders.push({
        id: 'rem' + Date.now(),
        userId: user.id,
        medicine: name,
        time: time,
        lastTriggered: null
    });
    saveState();

    document.getElementById('reminder-form').reset();
    renderReminders();
    showToast('Medication reminder set!');
});

function deleteReminder(remId) {
    if(!confirm("Remove this medication reminder?")) return;
    appState.reminders = appState.reminders.filter(r => r.id !== remId);
    saveState();
    renderReminders();
    showToast("Reminder removed.");
}

function renderReminders() {
    const user = getCurrentUser();
    const container = document.getElementById('reminders-list');
    if (!user) { container.innerHTML = '<p class="text-muted text-sm mt-4">Please add a family profile first.</p>'; return; }

    const userRems = appState.reminders.filter(r => r.userId === user.id).sort((a,b) => a.time.localeCompare(b.time));
    
    container.innerHTML = userRems.length ? userRems.map(r => `
        <div class="card mb-3 fade-in" style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h4 class="font-medium text-main" style="font-size:1.05rem;"><i class="fa-solid fa-pills text-primary" style="margin-right:8px;"></i>${r.medicine}</h4>
                <p class="text-sm text-muted mt-1"><i class="fa-regular fa-clock"></i> Scheduled for ${formatTime12(r.time)}</p>
            </div>
            <button class="btn-delete" onclick="deleteReminder('${r.id}')" title="Delete Reminder"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('') : '<p class="text-muted text-sm">No active alarms set for this profile.</p>';
}

function formatTime12(time24) {
    const [h, m] = time24.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
}

function checkMedicationReminders() {
    const now = new Date();
    const currentHHMM = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const todayStr = now.toISOString().split('T')[0];

    const user = getCurrentUser();
    if(!user) return;

    let triggeredItems =[];
    let stateUpdated = false;

    appState.reminders.forEach(rem => {
        if (rem.userId === user.id && rem.time === currentHHMM && rem.lastTriggered !== todayStr) {
            rem.lastTriggered = todayStr;
            triggeredItems.push(rem.medicine);
            stateUpdated = true;
        }
    });

    if (triggeredItems.length > 0) {
        showAlarmModal(triggeredItems.join(', '));
    }
    if (stateUpdated) saveState();
}

function showAlarmModal(medicinesString) {
    const nameEl = document.getElementById('alarm-medicine-name');
    const modal = document.getElementById('alarm-modal');
    
    if (modal.classList.contains('active')) {
        if (!nameEl.innerText.includes(medicinesString)) {
            nameEl.innerText += ` & ${medicinesString}`;
        }
    } else {
        nameEl.innerText = medicinesString;
        modal.classList.add('active');
        try {
            alarmAudio.loop = true;
            alarmAudio.play().catch(e => console.log('Audio autoplay blocked'));
        } catch(e) {}
    }
}

function closeAlarmModal() {
    document.getElementById('alarm-modal').classList.remove('active');
    try {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
    } catch(e) {}
}

function renderDashboard() {
    const user = getCurrentUser();
    const chartCard = document.getElementById('chart-card');
    if (!user) {
        document.getElementById('welcome-text').textContent = `Welcome to MedVault`;
        document.getElementById('welcome-subtext').textContent = `Add a family profile to get started!`;
        document.getElementById('recent-activity-container').innerHTML = '<p class="text-muted text-sm">Please open Family Vault to create a profile.</p>';
        chartCard.classList.add('hidden');
        if (vitalsChartInstance) vitalsChartInstance.destroy(); return;
    }
    chartCard.classList.remove('hidden');
    document.getElementById('welcome-text').textContent = `Hello, ${user.name.split(' ')[0]}`;
    document.getElementById('welcome-subtext').textContent = `Your personal and family health data is secure.`;
    const recent = appState.records.filter(r => r.userId === user.id).sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0, 2);
    const container = document.getElementById('recent-activity-container');
    container.innerHTML = recent.length ? recent.map(r => `
        <div class="card mb-3 fade-in" style="padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <h4 class="font-medium">${r.diagnosis || r.type}</h4>
                <div><span class="type-badge">${r.type}</span><button class="btn-delete" onclick="deleteRecord('${r.id}')" title="Delete Record"><i class="fa-solid fa-trash-can"></i></button></div>
            </div>
            <p class="text-sm text-muted mt-2"><i class="fa-regular fa-calendar"></i> ${r.date} | ${r.doctor}</p>
            ${r.image ? `<button class="btn btn-outline mt-3 w-100" onclick="openImageViewer('${r.id}')"><i class="fa-regular fa-file-image"></i> View Document</button>` : ''}
        </div>`).join('') : '<p class="text-muted text-sm">No recent records uploaded.</p>';

    const vitals = appState.vitals[user.id] || { dates:[], sugar:[], bpSys:[], hba1c:[] };
    const ctx = document.getElementById('vitalsChart').getContext('2d');
    if (vitalsChartInstance) vitalsChartInstance.destroy();

    vitalsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: vitals.dates,
            datasets:[
                { label:'Sugar (mg/dL)', data:vitals.sugar, borderColor:'#2dd4bf', backgroundColor:'rgba(45,212,191,0.1)', tension:0.4, fill:true, pointBackgroundColor:'#2dd4bf', pointRadius:4, pointHoverRadius:7, borderWidth:2 },
                { label:'Sys BP (mmHg)', data:vitals.bpSys, borderColor:'#38bdf8', backgroundColor:'rgba(56,189,248,0.1)', tension:0.4, fill:true, pointBackgroundColor:'#38bdf8', pointRadius:4, pointHoverRadius:7, borderWidth:2 },
                { label:'HbA1c (%)', data:vitals.hba1c, borderColor:'#fbbf24', backgroundColor:'rgba(251,191,36,0.08)', tension:0.4, fill:true, pointBackgroundColor:'#fbbf24', pointRadius:4, pointHoverRadius:7, borderWidth:2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position:'bottom', labels:{ boxWidth:10, color:'rgba(255,255,255,0.6)', font:{family:'Outfit',size:11}, padding:16 } } },
            scales: {
                y: { ticks:{ color:'rgba(255,255,255,0.45)', font:{family:'Outfit',size:11} }, grid:{ color:'rgba(255,255,255,0.06)' }, border:{ display:false } },
                x: { ticks:{ color:'rgba(255,255,255,0.45)', font:{family:'Outfit',size:11} }, grid:{ color:'rgba(255,255,255,0.06)' }, border:{ display:false } }
            },
            interaction: { mode:'index', intersect:false }
        }
    });
}

function renderTimeline() {
    const user = getCurrentUser();
    const container = document.getElementById('timeline-container');
    if (!user) { container.innerHTML = '<p class="text-muted text-sm mt-4">Please add a family profile first.</p>'; return; }
    const query = document.getElementById('timeline-search').value.toLowerCase();
    let filtered = appState.records.filter(r => r.userId === user.id);
    if (currentTimelineFilter !== 'All') filtered = filtered.filter(r => r.type === currentTimelineFilter);
    if (query) filtered = filtered.filter(r => r.diagnosis.toLowerCase().includes(query) || r.doctor.toLowerCase().includes(query) || r.medicines.join(' ').toLowerCase().includes(query));
    filtered.sort((a,b) => new Date(b.date)-new Date(a.date));
    container.innerHTML = filtered.length ? filtered.map(r => `
        <div class="timeline-item fade-in">
            <div class="timeline-dot"></div>
            <div class="card" style="padding:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h4 class="font-medium">${r.diagnosis || r.type}</h4>
                    <div><span class="type-badge">${r.type}</span><button class="btn-delete" onclick="deleteRecord('${r.id}')" title="Delete Record"><i class="fa-solid fa-trash-can"></i></button></div>
                </div>
                <p class="text-sm mt-1"><i class="fa-regular fa-calendar"></i> ${r.date}</p>
                <p class="text-sm text-muted"><i class="fa-solid fa-user-doctor"></i> ${r.doctor}</p>
                ${r.medicines.length ? `<p class="text-sm mt-3"><strong>Rx:</strong> ${r.medicines.join(', ')}</p>` : ''}
                ${r.image ? `<button class="btn btn-outline mt-3 w-100" onclick="openImageViewer('${r.id}')"><i class="fa-regular fa-file-image"></i> View Document</button>` : ''}
            </div>
        </div>`).join('') : '<p class="text-muted text-sm mt-4">No health entries matched for this view.</p>';
}

function setTimelineFilter(type) {
    currentTimelineFilter = type;
    document.querySelectorAll('#record-tabs .chip').forEach(c => c.classList.remove('active'));
    const buttons = Array.from(document.querySelectorAll('#record-tabs .chip'));
    const targetBtn = buttons.find(b => b.getAttribute('onclick').includes(type));
    if (targetBtn) targetBtn.classList.add('active');
    renderTimeline();
}
function filterTimeline() { renderTimeline(); }

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
dropZone.addEventListener('click', () => { if (!getCurrentUser()) return showToast("Please select/create a profile first."); fileInput.click(); });
fileInput.addEventListener('change', handleFileUpload);

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('ocr-loader').classList.remove('hidden');
    document.getElementById('ocr-result').classList.add('hidden');
    document.getElementById('drug-warning').classList.add('hidden');
    pendingHbA1c = null; pendingUploadedImage = null;
    try {
        const base64Image = await compressImage(file);
        pendingUploadedImage = base64Image;
        document.getElementById('uploaded-image-preview').src = base64Image;
        const worker = await Tesseract.createWorker("eng", 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round(m.progress * 100);
                    document.getElementById('ocr-progress').style.width = `${pct}%`;
                    document.getElementById('ocr-status').innerText = `Extracting medical data via OCR... ${pct}%`;
                }
            }
        });
        const { data: { text } } = await worker.recognize(base64Image);
        await worker.terminate();
        parseMedicalText(text);
    } catch (err) { console.error(err); showToast("Document processing failed. Try again."); }
    finally {
        document.getElementById('ocr-loader').classList.add('hidden');
        document.getElementById('ocr-result').classList.remove('hidden');
    }
}

function parseMedicalText(text) {
    const today = new Date().toISOString().split('T')[0];
    let extDoctor = "Unknown Doctor", extMeds =[], extDiag = "General Consultation", extType = "Rx";
    const lowerText = text.toLowerCase();
    if (lowerText.includes('lab')||lowerText.includes('test')||lowerText.includes('pathology')||lowerText.includes('hba1c')) extType = "Lab";
    else if (lowerText.includes('visit')||lowerText.includes('consult')) extType = "Visit";
    if (lowerText.includes('dr.')||lowerText.includes('doctor')) extDoctor = "Dr. " + (text.match(/Dr\.?\s+([A-Za-z]+)/i)?.[1] || "Roberts");
    else if (extType === "Lab") extDoctor = "Diagnostic Lab";
    if (lowerText.includes('ibuprofen')) extMeds.push('Ibuprofen');
    if (lowerText.includes('amoxicillin')) extMeds.push('Amoxicillin');
    if (lowerText.includes('paracetamol')) extMeds.push('Paracetamol');
    if (lowerText.includes('metformin')) extMeds.push('Metformin');
    if (lowerText.includes('fever')||lowerText.includes('viral')) extDiag = "Viral Fever";
    const hba1cMatch = lowerText.match(/hba1c[\s\:\-\.]*([\d\.]+)/);
    if (hba1cMatch && hba1cMatch[1]) {
        const parsedValue = parseFloat(hba1cMatch[1]);
        if (!isNaN(parsedValue)) { extDiag = `HbA1c Test (${parsedValue}%)`; extType = "Lab"; pendingHbA1c = parsedValue; }
    }
    document.getElementById('record-type').value = extType;
    document.getElementById('record-date').value = today;
    document.getElementById('record-doctor').value = extDoctor;
    document.getElementById('record-diagnosis').value = extDiag;
    document.getElementById('record-medicines').value = extMeds.join(', ');
    checkDrugInteractions(extMeds);
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 800;
                let scaleSize = MAX_WIDTH / img.width;
                if (scaleSize > 1) scaleSize = 1;
                canvas.width = img.width * scaleSize; canvas.height = img.height * scaleSize;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
        reader.onerror = error => reject(error);
    });
}

function checkDrugInteractions(newMeds) {
    if (!newMeds.length) { document.getElementById('drug-warning').classList.add('hidden'); return; }
    const user = getCurrentUser(); if (!user) return;
    const pastRecords = appState.records.filter(r => r.userId === user.id);
    let pastMeds =[]; pastRecords.forEach(r => pastMeds.push(...r.medicines.map(m => m.toLowerCase())));
    let warnings =[];
    newMeds.forEach(newMed => {
        const medKey = newMed.toLowerCase().trim();
        if (drugInteractions[medKey]) {
            const conflicts = drugInteractions[medKey].filter(c => pastMeds.includes(c));
            if (conflicts.length > 0) warnings.push(`${newMed} interacts with past prescriptions containing: ${conflicts.join(', ')}.`);
        }
    });
    const warningBox = document.getElementById('drug-warning');
    if (warnings.length > 0) { document.getElementById('warning-text').innerText = "Drug Interaction Alert: " + warnings.join(' '); warningBox.classList.remove('hidden'); }
    else warningBox.classList.add('hidden');
}

document.getElementById('record-medicines').addEventListener('input', (e) => {
    const meds = e.target.value.split(',').map(m => m.trim()).filter(m => m);
    checkDrugInteractions(meds);
});

document.getElementById('record-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!getCurrentUser()) return showToast("No profile selected!");
    const medsRaw = document.getElementById('record-medicines').value;
    const meds = medsRaw ? medsRaw.split(',').map(m => m.trim()) :[];
    const recType = document.getElementById('record-type').value;
    const newRecord = {
        id:'r'+Date.now(), userId:appState.currentUser,
        date:document.getElementById('record-date').value,
        doctor:document.getElementById('record-doctor').value,
        diagnosis:document.getElementById('record-diagnosis').value,
        medicines:meds, type:recType, image:pendingUploadedImage
    };
    appState.records.push(newRecord);
    if (pendingHbA1c !== null) {
        const userVitals = appState.vitals[appState.currentUser];
        const month = new Date(newRecord.date).toLocaleString('default', { month:'short', timeZone:'UTC' });
        if (userVitals.dates[userVitals.dates.length-1] !== month) {
            userVitals.dates.push(month); userVitals.sugar.push(null); userVitals.bpSys.push(null); userVitals.hba1c.push(pendingHbA1c);
        } else { userVitals.hba1c[userVitals.hba1c.length-1] = pendingHbA1c; }
        pendingHbA1c = null;
    }
    saveState(); showToast("Record successfully secured in Vault.");
    document.getElementById('record-form').reset();
    document.getElementById('ocr-result').classList.add('hidden');
    fileInput.value = ''; pendingUploadedImage = null;
    switchView('timeline'); setTimelineFilter(recType);
});

/* ================================================================
   AI CHAT & VOICE LOGIC
================================================================ */
let ttsEnabled = false;
let recognition = null;
let isRecording = false;

let healthRecognition = null;
let isHealthRecording = false;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onstart = () => {
        isRecording = true;
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.classList.add('recording');
        document.getElementById('chat-input').placeholder = 'Listening...';
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        document.getElementById('chat-input').value = finalTranscript || interimTranscript;
    };
    
    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        resetMicState();
        showToast("Microphone error: " + event.error);
    };
    
    recognition.onend = () => {
        resetMicState();
        const inputVal = document.getElementById('chat-input').value.trim();
        if (inputVal) {
            sendMessage();
        }
    };

    healthRecognition = new SpeechRecognition();
    healthRecognition.continuous = false;
    healthRecognition.interimResults = false;
    
    healthRecognition.onstart = () => {
        isHealthRecording = true;
        const micBtn = document.getElementById('health-mic-btn');
        if (micBtn) micBtn.classList.add('recording');
        showToast("Listening... (e.g. 'My sugar is 110, Pressure 120')");
    };
    
    healthRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript;
            }
        }
        parseHealthVoice(transcript);
    };
    
    healthRecognition.onerror = (event) => {
        console.error("Health Speech error", event.error);
        resetHealthMicState();
        showToast("Microphone error: " + event.error);
    };
    
    healthRecognition.onend = () => {
        resetHealthMicState();
    };
}

function toggleHealthMic() {
    if (!healthRecognition) return showToast("Voice input not supported in this browser.");
    if (isHealthRecording) {
        healthRecognition.stop();
    } else {
        healthRecognition.start();
    }
}

function resetHealthMicState() {
    isHealthRecording = false;
    const micBtn = document.getElementById('health-mic-btn');
    if (micBtn) micBtn.classList.remove('recording');
}

function parseHealthVoice(text) {
    const lower = text.toLowerCase();
    let updated = false;
    
    const sugarMatch = lower.match(/(?:sugar|glucose)[^\d]*(\d+)/);
    if (sugarMatch) { document.getElementById('vital-sugar').value = sugarMatch[1]; updated = true; }
    
    const bpMatch = lower.match(/(?:pressure|bp|systolic)[^\d]*(\d+)/);
    if (bpMatch) { document.getElementById('vital-bp').value = bpMatch[1]; updated = true; }
    
    const hba1cMatch = lower.match(/(?:hba1c|hbiac|a1c)[^\d]*([\d\.]+)/);
    if (hba1cMatch) { document.getElementById('vital-hba1c').value = hba1cMatch[1]; updated = true; }
    
    if (lower.includes('yesterday')) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        document.getElementById('vital-date').valueAsDate = y;
        updated = true;
    } else if (lower.includes('today')) {
        document.getElementById('vital-date').valueAsDate = new Date();
        updated = true;
    } else {
        const dateMatch = lower.match(/date\s+([a-z0-9\s]+)/i);
        if (dateMatch) {
            const parsed = new Date(dateMatch[1]);
            if (!isNaN(parsed)) {
                document.getElementById('vital-date').valueAsDate = parsed;
                updated = true;
            }
        }
    }
    
    if (updated) showToast("Health data fields updated via voice.");
    else showToast("Could not extract specific vitals. Try again.");
}

function toggleMic() {
    if (!recognition) return showToast("Voice input not supported in this browser.");
    if (isRecording) {
        recognition.stop();
    } else {
        document.getElementById('chat-input').value = '';
        recognition.start();
    }
}

function resetMicState() {
    isRecording = false;
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.remove('recording');
    document.getElementById('chat-input').placeholder = 'Ask about health or specific vitals...';
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    const btn = document.getElementById('tts-toggle-btn');
    if (ttsEnabled) {
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btn.classList.add('tts-active');
        btn.classList.remove('tts-inactive');
        showToast("AI Voice Output Enabled");
    } else {
        btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        btn.classList.add('tts-inactive');
        btn.classList.remove('tts-active');
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        showToast("AI Voice Output Disabled");
    }
}

function speakText(htmlText) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const text = htmlText.replace(/<[^>]*>?/gm, '');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

function handleChatEnter(e) { if (e.key === 'Enter') sendMessage(); }

function sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim(); if (!msg) return;
    appendMessage('user', msg); input.value = '';
    setTimeout(() => { 
        const reply = generateAiResponse(msg.toLowerCase()); 
        appendMessage('bot', reply); 
        if (ttsEnabled) {
            speakText(reply);
        }
    }, 600);
}

function appendMessage(sender, text) {
    const container = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender} fade-in`;
    msgDiv.innerHTML = `<div class="bubble">${text}</div>`;
    container.appendChild(msgDiv); container.scrollTop = container.scrollHeight;
}

function generateAiResponse(query) {
    const user = getCurrentUser();
    if (!user) return "Please create a profile before analyzing health data.";
    const records = appState.records.filter(r => r.userId === user.id).sort((a,b) => new Date(b.date)-new Date(a.date));
    const vitals = appState.vitals[user.id] || { dates:[], sugar:[], bpSys:[], hba1c:[] };
    const greetings =['hi','hello','hey','greetings'];
    if (greetings.includes(query.trim())) return `Hello ${user.name.split(' ')[0]}! I am your MedVault AI. Ask me about your health conditions, logged vitals for specific dates, or active medications.`;
    const medicalKeywords =['medicine','medication','drug','rx','pill','prescribe','health','condition','diagnosis','report','doctor','hospital','pain','fever','sick','treatment','disease','symptom','sugar','bp','pressure','hba1c','vital','lab','test','record','latest','recent'];
    records.forEach(r => {
        if (r.diagnosis) r.diagnosis.toLowerCase().split(' ').forEach(w => { if (w.length > 3) medicalKeywords.push(w); });
        if (r.medicines) r.medicines.forEach(m => medicalKeywords.push(m.toLowerCase()));
    });
    const isMedicalQuery = medicalKeywords.some(kw => query.includes(kw));
    if (!isMedicalQuery) return "I am a dedicated medical AI assistant. I will only answer questions regarding your health conditions, vitals, and medications.";
    const months =["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec","january","february","march","april","june","july","august","september","october","november","december"];
    let matchedMonth = months.find(m => query.includes(m));
    const dateMatch = query.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) { const parsedDate = new Date(dateMatch[0]); matchedMonth = parsedDate.toLocaleString('default', { month:'short', timeZone:'UTC' }).toLowerCase(); }
    const isAskingVitals = query.includes('sugar')||query.includes('bp')||query.includes('pressure')||query.includes('hba1c')||query.includes('vital');
    if (isAskingVitals && matchedMonth) {
        let shortMonth = matchedMonth.substring(0, 3);
        shortMonth = shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1);
        const monthIndex = vitals.dates.findIndex(d => d.toLowerCase() === shortMonth.toLowerCase());
        if (monthIndex !== -1) {
            const s = vitals.sugar[monthIndex] !== null ? vitals.sugar[monthIndex] + " mg/dL" : "Not recorded";
            const bp = vitals.bpSys[monthIndex] !== null ? vitals.bpSys[monthIndex] + " mmHg" : "Not recorded";
            const hb = vitals.hba1c[monthIndex] !== null ? vitals.hba1c[monthIndex] + "%" : "Not recorded";
            return `For the month of ${shortMonth}, your health parameters are:<br>• <strong>Sugar:</strong> ${s}<br>• <strong>Pressure (Sys BP):</strong> ${bp}<br>• <strong>HbA1c:</strong> ${hb}`;
        } else { return `I couldn't find any vital records logged for ${shortMonth}.`; }
    } else if (isAskingVitals && !matchedMonth) { return `To give you exact values for your vitals, please mention the month or date (e.g., "What was my sugar in May?").`; }
    if (query.includes('medicine')||query.includes('medication')||query.includes('drug')) {
        let meds =[]; records.forEach(r => meds.push(...r.medicines)); meds =[...new Set(meds)];
        return meds.length ? `Based on your records, your active medications are: <strong>${meds.join(', ')}</strong>.` : `I couldn't find any specific medications on record for ${user.name}.`;
    }
    if (query.includes('latest')||query.includes('recent')||query.includes('last')) {
        if (!records.length) return `${user.name} does not have any records stored.`;
        const latest = records[0];
        return `Your most recent record is a ${latest.type} from ${latest.date} with ${latest.doctor} regarding <strong>${latest.diagnosis}</strong>.`;
    }
    let foundRecord = null;
    if (dateMatch) { foundRecord = records.find(r => r.date === dateMatch[0]); }
    else {
        const queryWords = query.replace(/what|when|where|who|why|how|did|i|have|about|my/g,'').trim().split(' ').filter(w => w.length > 3);
        foundRecord = records.find(r => queryWords.some(qw => r.diagnosis&&r.diagnosis.toLowerCase().includes(qw)) || queryWords.some(qw => r.doctor&&r.doctor.toLowerCase().includes(qw)));
    }
    if (foundRecord) {
        const medString = foundRecord.medicines.length ? foundRecord.medicines.join(', ') : 'None prescribed';
        return `I found a matching record: On <strong>${foundRecord.date}</strong>, you had a ${foundRecord.type} for <strong>${foundRecord.diagnosis}</strong>. Medications: ${medString}.`;
    }
    return `You currently have ${records.length} health records stored. You can ask me to list your prescribed medications, summarize your latest doctor visits, or show vitals by specifying a month.`;
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-primary"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateY(-8px) scale(0.96)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ── 2. 3D CARD TILT EFFECT ─────────────────────────────────────── */
function init3DCardTilt() {
    // Apply tilt only on non-touch devices
    if (window.matchMedia('(hover: none)').matches) return;

    document.addEventListener('mousemove', e => {
        document.querySelectorAll('.card').forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            // Only tilt when mouse is inside card
            if (x<-20||x>rect.width+20||y<-20||y>rect.height+20) return;
            const cx = rect.width/2, cy = rect.height/2;
            const rx = ((y-cy)/cy) * -5;  // max ±5deg
            const ry = ((x-cx)/cx) *  5;
            card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
            card.style.transition = 'transform 0.12s ease';
            card.style.boxShadow  = `0 20px 50px rgba(0,0,0,0.28), 0 0 0 1px rgba(56,189,248,0.18), inset 0 1px 0 rgba(255,255,255,0.18)`;
        });
    });

    document.addEventListener('mouseleave', () => resetAllCards(), true);

    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mouseleave', () => {
            card.classList.add('card-tilt-reset');
            card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)';
            card.style.boxShadow = '';
            setTimeout(() => card.classList.remove('card-tilt-reset'), 600);
        });
    });
}

function resetAllCards() {
    document.querySelectorAll('.card').forEach(card => {
        card.style.transform = '';
        card.style.boxShadow = '';
    });
}

/* ── 3. PARALLAX SCROLL EFFECT ──────────────────────────────────── */
function initParallaxEffect() {
    const orbs = document.querySelectorAll('.orb');
    window.addEventListener('scroll', () => {
        const sy = window.scrollY;
        orbs.forEach((orb, i) => {
            const speed =[0.08, 0.05, 0.10, 0.06][i] || 0.07;
            orb.style.transform = `translateY(${sy * speed}px)`;
        });
    }, { passive: true });
}
