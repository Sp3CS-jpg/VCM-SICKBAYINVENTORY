const defaultNurses = [
    { id: "PRINCIPAL", name: "Principal Olivia Maxwell", pass: "4321", role: "Principal" },
    { id: "NURSE-002", name: "Nurse Clara Barton", pass: "1245", role: "Management Staff" },
    { id: "ADMIN-001", name: "Administrator Sarah Vance", pass: "admin123", role: "Admin Officer" }
];

const defaultItems = [
    { id: 1, name: "Regenerative Paracetamol", category: "Medication", quantity: 1540, expiry: "2028-12-30" },
    { id: 2, name: "Quantum Gauze Nano-Pads", category: "Bandage", quantity: 82, expiry: "2029-05-15" },
    { id: 3, name: "Infrared Bio-Scanner", category: "Diagnostic", quantity: 12, expiry: "2030-10-01" },
    { id: 4, name: "Liquid Skin Adhesive", category: "Bandage", quantity: 5, expiry: "2026-08-20" },
    { id: 5, name: "Neural Pain Blockers", category: "Medication", quantity: 450, expiry: "2027-11-12" }
];

const defaultStudents = [
    {
        id: 101, name: "Jesse Agev", class: "Grade 12", dob: "2008-05-14", admissionNo: "ADM-2024-001", sickbayNo: "0822", prescriptions: [],
        medicationSchedule: [{ item: "Regenerative Paracetamol", intervalHours: 8 }]
    },
    {
        id: 102, name: "Darellmax Adima", class: "Grade 10", dob: "2010-11-20", admissionNo: "ADM-2025-015", sickbayNo: "0941", prescriptions: [],
        medicationSchedule: [{ item: "Cetirizine 10mg", intervalHours: 24 }]
    },
    { id: 103, name: "Ibrahim Dankeji", class: "Grade 11", dob: "2009-08-05", admissionNo: "ADM-2023-088", sickbayNo: "0750", prescriptions: ["Multivitamins (60 Units) - Dr. Vance"] }
];

const defaultNotifications = [
    { id: 1, type: 'danger', title: 'Missed Dose', desc: 'S. Vance (Grade 10) missed Cetirizine 10mg at 16:00.', icon: 'alert-circle' },
    { id: 2, type: 'success', title: 'Recovery Alert', desc: 'A. Pierce completed full medication course.', icon: 'check-circle' },
    { id: 3, type: 'warning', title: 'Stock Alert', desc: 'Quantum Gauze Pads reaching critical levels.', icon: 'package' }
];

let nurses = defaultNurses;
let items = JSON.parse(localStorage.getItem('sickbay_items')) || defaultItems;
let students = JSON.parse(localStorage.getItem('sickbay_students')) || defaultStudents;
let notifications = JSON.parse(localStorage.getItem('sickbay_notifs')) || defaultNotifications;
let attendanceLogs = JSON.parse(localStorage.getItem('sickbay_attendance')) || [];

const storedNurses = JSON.parse(localStorage.getItem('sickbay_nurses'));
if (Array.isArray(storedNurses) && storedNurses.length) {
    nurses = storedNurses;
} else {
    localStorage.setItem('sickbay_nurses', JSON.stringify(defaultNurses));
}

// Enforce Principal credentials
const principalIndex = nurses.findIndex(n => n.id === 'PRINCIPAL');
if (principalIndex >= 0) {
    nurses[principalIndex].pass = '4321';
    nurses[principalIndex].name = 'Principal Olivia Maxwell';
    nurses[principalIndex].role = 'Principal';
    localStorage.setItem('sickbay_nurses', JSON.stringify(nurses));
}

let activeNurse = JSON.parse(sessionStorage.getItem('activeNurse')) || null;
let activeSessionId = sessionStorage.getItem('activeSessionId') || null;
let activeLoginRole = sessionStorage.getItem('activeLoginRole') || null;

// Debounced icon renderer to avoid repeated heavy DOM scans by lucide
window._lucideTimer = null;
function scheduleLucideCreate(delay = 80) {
    if (window._lucideTimer) clearTimeout(window._lucideTimer);
    window._lucideTimer = setTimeout(() => {
        try { if (window.lucide) window.lucide.createIcons(); } catch (e) { /* ignore */ }
        window._lucideTimer = null;
    }, delay);
}

// Super Admin Protocol 2026 (Managed via localStorage after first run)
const DEFAULT_SUPER_ADMIN = { id: "SYS-ADMIN-99", name: "System Administrator", role: "Super Admin", key: "SysAdmin_Intel_2026", phrase: "Vcm_Protocol_Secure_99" };
let SUPER_ADMIN = JSON.parse(localStorage.getItem('sickbay_admin_protocol')) || DEFAULT_SUPER_ADMIN;
let isAdminMode = sessionStorage.getItem('isAdminMode') === 'true';

function saveData() {
    localStorage.setItem('sickbay_nurses', JSON.stringify(nurses));
    localStorage.setItem('sickbay_items', JSON.stringify(items));
    localStorage.setItem('sickbay_students', JSON.stringify(students));
    localStorage.setItem('sickbay_notifs', JSON.stringify(notifications));
    localStorage.setItem('sickbay_attendance', JSON.stringify(attendanceLogs));
}

function isAdmin() {
    return (activeNurse && activeNurse.role === 'Admin Officer') || isAdminMode;
}

function makeAvatarDataUri(name) {
    const initials = (name || 'SC').split(' ').map(part => part.charAt(0)).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'SC';
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="18" fill="#0ea5e9"/>
            <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${initials}</text>
        </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// Uniqueness Validation Helpers
function isNurseIdUnique(id) {
    return !nurses.some(n => n.id === id);
}

function isPasswordUnique(pass) {
    return !nurses.some(n => n.pass === pass);
}

function isAdmissionNoUnique(no, excludeId = null) {
    return !students.some(s => s.admissionNo === no && s.id !== excludeId);
}

function isSickbayNoUnique(no, excludeId = null) {
    // Standardize to 4 digits if simple
    const cleanNo = no.padStart(4, '0');
    return !students.some(s => s.sickbayNo === cleanNo && s.id !== excludeId);
}

// DOM Elements
const mainApp = document.getElementById('main-app');
const loginForm = document.getElementById('login-form');
const loginPortal = document.getElementById('login-portal');
const roleButtons = document.querySelectorAll('.role-option');
const loginRoleError = document.getElementById('login-role-error');

const inventoryBody = document.getElementById('inventory-body');
const totalItemsEl = document.getElementById('total-items-count');
const lowStockEl = document.getElementById('low-stock-count');
const totalStudentsEl = document.getElementById('total-students-count');
const studentsTotalCountEl = document.getElementById('students-total-count');
const studentsScheduleCountEl = document.getElementById('students-schedule-count');
const studentsClassCountEl = document.getElementById('students-class-count');
const inventoryTotalItemsEl = document.getElementById('inventory-total-items');
const inventoryLowStockEl = document.getElementById('inventory-low-stock');
const inventoryTotalUnitsEl = document.getElementById('inventory-total-units');

const notificationBell = document.querySelector('.notification-bell');
let notificationDropdown;

// Initialization
// Initialization
function init() {
    // Data Migration: Remove "SB-" prefix from sickbayNo if it exists
    let migrationNeeded = false;
    students.forEach(s => {
        if (s.sickbayNo && s.sickbayNo.startsWith('SB-')) {
            s.sickbayNo = s.sickbayNo.replace('SB-', '');
            migrationNeeded = true;
        }
    });
    if (migrationNeeded) saveData();

    setupNotificationUI();
    setupTheme();
    registerOfflineSupport();

    const isDashboard = window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('Inventory/');

    // Security Protocol: Removed aggressive session clear on reload to prevent login issues

    if (activeNurse && activeLoginRole) {
        if (loginPortal) loginPortal.style.display = 'none';
        if (mainApp) mainApp.classList.remove('locked');
        updateUIWithNurse(activeNurse);
        renderDataForPage();
        renderManagementRoster();
        showPrincipalManagementControls();
        enforceManagementReadOnly();
    } else {
        if (isDashboard) {
            if (mainApp) mainApp.classList.add('locked');
            if (loginPortal) loginPortal.style.display = 'flex';
            setupAuth();
        } else {
            window.location.href = 'index.html';
        }
    }

    setupNavigation();
    setupGlobalListeners();
    setupAIAssistant();
    if (window.lucide) lucide.createIcons();

    // Initial Smart Checks
    checkMissedDosages();

    if (window.location.pathname.includes('student-details.html')) {
        initStudentDetails();
    }

    if (window.location.pathname.includes('admin.html')) {
        initAdminPanel();
    }
}

function renderDataForPage() {
    const path = window.location.pathname;
    if (path.includes('students.html')) renderStudents();
    else if (path.includes('records.html')) renderClinicalRecords();
    else if (path.includes('reports.html')) renderAttendanceLogs();
    else if (path.includes('inventory.html') || path.includes('drug-addins.html') || path.includes('index.html') || path === '/' || path.endsWith('Inventory/')) {
        if (activeLoginRole === 'management') {
            setActiveView('management-view');
            renderManagementRoster();
        } else {
            setActiveView('dashboard-view');
            renderInventory();
            renderMedicationMonitor();
            // Render attendance chart on dashboard
            try { renderAttendanceChart(); } catch (e) { console.warn('Attendance chart render failed', e); }
        }
    }
    updateStats();
}

function setActiveView(viewId) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');
}

function renderManagementRoster() {
    const rosterBody = document.getElementById('management-nurse-roster');
    if (!rosterBody) return;

    rosterBody.innerHTML = nurses.map(n => `
        <tr>
            <td><strong>${n.id}</strong></td>
            <td>${n.name}</td>
            <td>${n.id}</td>
            <td><span class="password-cell">${n.pass}</span></td>
            <td>${n.role}</td>
            <td>
                ${isPrincipal() ? `<button type="button" class="btn-icon mini" onclick="deleteNurse('${n.id}')" title="Delete Nurse"><i data-lucide="trash-2" size="16"></i></button>` : ''}
            </td>
        </tr>
    `).join('');
}

function isPrincipal() {
    return activeNurse && activeNurse.role === 'Principal';
}

function showPrincipalManagementControls() {
    const controls = document.getElementById('management-principal-controls');
    if (!controls) return;
    controls.style.display = isPrincipal() ? 'block' : 'none';
}

function handleManagementAddNurse(e) {
    e.preventDefault();
    if (!isPrincipal()) {
        alert('Only the Principal can add new nurses.');
        return;
    }

    const id = document.getElementById('principal-new-nurse-id').value.trim();
    const name = document.getElementById('principal-new-nurse-name').value.trim();
    const pass = document.getElementById('principal-new-nurse-pass').value.trim();
    const role = document.getElementById('principal-new-nurse-role').value;

    if (!isNurseIdUnique(id)) {
        alert('Officer ID already exists. Use a unique clinical ID.');
        return;
    }

    if (!isPasswordUnique(pass)) {
        alert('This access key is already in use. Each nurse must have a unique password.');
        return;
    }

    nurses.push({ id, name, pass, role });
    saveData();
    renderManagementRoster();

    const form = document.getElementById('management-add-nurse-form');
    if (form) form.reset();

    alert(`New nurse ${name} has been added.`);
}

function deleteNurse(id) {
    if (!isPrincipal()) return;
    if (!confirm(`Remove nurse ${id} from the system? This cannot be undone.`)) return;

    nurses = nurses.filter(n => n.id !== id);
    saveData();
    renderManagementRoster();
}

function enforceManagementReadOnly() {
    if (activeLoginRole !== 'management') return;
    document.body.classList.add('management-readonly');

    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('button, input, select, textarea').forEach(el => {
        if (el.id === 'logout-btn' || el.id === 'header-logout-btn' || el.id === 'theme-toggle' || el.id === 'ai-save-key-btn' || el.closest('.role-selector')) return;
        if (el.matches('.btn-terminate')) return;
        if (el.matches('#login-form button')) return;
        if (el.closest('.notification-bell')) return;
        el.disabled = true;
    });

    document.querySelectorAll('.action-btn, .qty-step-btn, .btn-primary, .btn-secondary, .btn-icon, .btn-icon-premium, .modal .btn-primary, .modal .btn-secondary').forEach(el => {
        if (el.id === 'logout-btn' || el.id === 'header-logout-btn' || el.classList.contains('theme-toggle')) return;
        if (el.closest('.profile-dropdown')) return;
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.65';
    });
}

// Attendance chart rendering using Chart.js
function renderAttendanceChart(days = 30) {
    const ctx = document.getElementById('attendance-chart');
    if (!ctx) return;

    // Prepare labels (last N days)
    function getLastNDates(n) {
        const out = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            out.push(d.toISOString().split('T')[0]);
        }
        return out;
    }

    const labels = getLastNDates(days);

    // Aggregate attendanceLogs by date (assumes entries have a .timestamp or .time)
    const counts = labels.map(l => 0);
    if (Array.isArray(attendanceLogs) && attendanceLogs.length) {
        attendanceLogs.forEach(a => {
            const t = a.timestamp || a.time || a.date || a.createdAt || a.loggedAt;
            const d = t ? new Date(t) : null;
            const key = d ? d.toISOString().split('T')[0] : null;
            if (key) {
                const idx = labels.indexOf(key);
                if (idx >= 0) counts[idx]++;
            }
        });
    } else {
        // no real data — generate sample demo data based on students count
        for (let i = 0; i < counts.length; i++) counts[i] = Math.floor(Math.random() * Math.max(3, Math.floor((students || []).length / 3)));
    }

    // If a previous chart exists, destroy it
    if (window.attendanceChart && window.attendanceChart.destroy) {
        try { window.attendanceChart.destroy(); } catch (e) { /* ignore */ }
    }

    const cfg = {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Visits',
                data: counts,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#0ea5e9',
                backgroundColor: 'rgba(14,165,233,0.12)',
                fill: true,
                tension: 0.25,
                pointRadius: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            elements: { point: { radius: 1 } },
            scales: {
                x: { display: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
                y: { display: true, beginAtZero: true, suggestedMax: Math.max(5, Math.max(...counts) + 2) }
            },
            plugins: { legend: { display: false } }
        }
    };

    try {
        window.attendanceChart = new Chart(ctx.getContext('2d'), cfg);
    } catch (err) {
        console.error('Failed to create attendance chart', err);
    }
}

function updateUIWithNurse(nurse) {
    const nameDisplay = document.getElementById('active-nurse-name') || document.getElementById('nurse-name-display');
    const headerName = document.getElementById('header-nurse-name');
    const avatar = document.getElementById('nurse-avatar');
    const logoutBtn = document.getElementById('header-logout-btn');

    if (nameDisplay) nameDisplay.textContent = nurse.name;

    if (headerName) {
        const parts = nurse.name.split(' ');
        headerName.textContent = parts[parts.length - 1];
    }

    if (avatar) avatar.src = makeAvatarDataUri(nurse.name);

    if (logoutBtn) {
        logoutBtn.title = nurse.name; // Hover to show full name
        // The click listener is already globally handled for .btn-terminate and #logout-btn
        // but let's make sure our new one is also wired if it's separate
        if (!logoutBtn.onclick) logoutBtn.addEventListener('click', logout);
    }
}

function renderManagementRoster() {
    const rosterBody = document.getElementById('management-nurse-roster');
    if (!rosterBody) return;

    rosterBody.innerHTML = nurses.map(n => `
        <tr>
            <td><strong>${n.id}</strong></td>
            <td>${n.name}</td>
            <td>${n.id}</td>
            <td><span class="password-cell">${n.pass}</span></td>
            <td>${n.role}</td>
        </tr>
    `).join('');
}

function registerOfflineSupport() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline cache registration failed', err));
    }
}

function setupTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeUI(theme);

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeUI(newTheme);
        });
    }
}

function updateThemeUI(theme) {
    const moonIcon = document.getElementById('theme-icon-moon');
    const sunIcon = document.getElementById('theme-icon-sun');
    if (moonIcon && sunIcon) {
        if (theme === 'dark') {
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        } else {
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        }
    }
}

function setupNotificationUI() {
    if (!notificationBell) return;

    // Create fullscreen dim overlay
    const notifOverlay = document.createElement('div');
    notifOverlay.id = 'notif-overlay';
    Object.assign(notifOverlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        webkitBackdropFilter: 'blur(4px)',
        zIndex: '9998',
        display: 'none',
        opacity: '0',
        transition: 'opacity 0.25s ease'
    });
    document.body.appendChild(notifOverlay);

    // Build dropdown
    notificationDropdown = document.createElement('div');
    notificationDropdown.className = 'notification-dropdown';
    Object.assign(notificationDropdown.style, {
        width: '460px',
        position: 'fixed',
        top: '75px',
        right: '24px',
        zIndex: '9999',
        borderRadius: '20px',
        boxShadow: '0 40px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)',
        display: 'none',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.1)',
        transform: 'translateY(-12px)',
        opacity: '0',
        transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease',
        maxHeight: '80vh'
    });
    document.body.appendChild(notificationDropdown);

    function openDropdown() {
        notifOverlay.style.display = 'block';
        notificationDropdown.style.display = 'flex';
        requestAnimationFrame(() => {
            notifOverlay.style.opacity = '1';
            notificationDropdown.style.transform = 'translateY(0)';
            notificationDropdown.style.opacity = '1';
        });
    }

    function closeDropdown() {
        notifOverlay.style.opacity = '0';
        notificationDropdown.style.transform = 'translateY(-12px)';
        notificationDropdown.style.opacity = '0';
        setTimeout(() => {
            notifOverlay.style.display = 'none';
            notificationDropdown.style.display = 'none';
        }, 260);
    }

    let lastClick = 0;
    notificationBell.style.position = 'relative';
    notificationBell.addEventListener('click', (e) => {
        e.stopPropagation();

        const now = Date.now();
        if (now - lastClick < 300) {
            // Double Tap — Open Full Audit View
            const modal = document.getElementById('audit-history-modal');
            const content = document.getElementById('audit-history-content');
            const title = document.getElementById('audit-title');
            const subtitle = document.getElementById('audit-subtitle');

            if (modal && content) {
                title.textContent = "Clinical Alert Intelligence Dashboard";
                subtitle.textContent = "Universal shift history of all system-generated protocols";

                content.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1rem; padding:1rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; background:rgba(14, 165, 233, 0.05); padding:1rem; border-radius:12px;">
                            <span style="font-size:0.8rem; font-weight:800; color:var(--primary);">TOTAL SYSTEM ALERTS: ${notifications.length}</span>
                            <button class="btn-primary mini" onclick="notifications=[]; saveData(); updateUnreadCount(); document.getElementById('audit-history-modal').style.display='none';">ARCHIVE ALL</button>
                        </div>
                        ${notifications.map(n => `
                            <div class="glass" style="padding:1.25rem; border-radius:16px; display:flex; gap:1.25rem; align-items:center; border-left:4px solid ${n.type === 'danger' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--success)'}; opacity: ${n.read ? '0.6' : '1'};">
                                <div style="background:rgba(0,0,0,0.03); width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; color:${n.type === 'danger' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--success)'}">
                                    <i data-lucide="${n.icon}"></i>
                                </div>
                                <div style="flex:1;">
                                    <div style="display:flex; justify-content:space-between;">
                                        <strong style="font-size:1rem; color:var(--text-main);">${n.title}</strong>
                                        ${!n.read ? '<span class="badge badge-danger" style="font-size:0.6rem;">NEW</span>' : ''}
                                    </div>
                                    <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">${n.desc}</p>
                                </div>
                                <button class="btn-icon mini" onclick="markNotifChecked(${n.id})" title="Acknowledge">
                                    <i data-lucide="check-circle" size="18"></i>
                                </button>
                            </div>
                        `).join('') || '<p style="text-align:center; padding:4rem; color:var(--text-muted);">Alert database is currently empty.</p>'}
                    </div>
                `;
                modal.style.display = 'flex';
                if (window.lucide) lucide.createIcons();
            }
            return;
        }
        lastClick = now;

        const isOpen = notificationDropdown.style.display === 'flex';
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
            notifications.forEach(n => n.read = true);
            saveData();
            updateUnreadCount();
        }
    });

    notifOverlay.addEventListener('click', closeDropdown);
    document.addEventListener('click', (e) => {
        if (!notificationDropdown.contains(e.target) && !notificationBell.contains(e.target)) {
            if (notificationDropdown.style.display === 'flex') closeDropdown();
        }
    });

    renderNotifications();
    updateUnreadCount();
}

function updateUnreadCount() {
    const badge = document.querySelector('.bell-dot');
    const unreadCount = notifications.filter(n => !n.read).length;
    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = 'flex';
            badge.textContent = unreadCount;
            badge.className = 'bell-dot badge-danger';
        } else {
            badge.style.display = 'none';
        }
    }
}

function renderNotifications() {
    if (!notificationDropdown) return;

    const unread = notifications.filter(n => !n.read).length;

    notificationDropdown.innerHTML = `
        <div style="background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%); padding:1.4rem 1.5rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,0,0,0.07);">
            <div style="display:flex; align-items:center; gap:0.8rem;">
                <div style="width:36px; height:36px; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.2); border-radius:10px; display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="bell" size="18" style="color:#0ea5e9;"></i>
                </div>
                <div>
                    <div style="font-weight:800; font-size:0.95rem; letter-spacing:0.06em; font-family:'Outfit'; color:#0f172a;">INTEL ALERT SYSTEM</div>
                    <div style="font-size:0.7rem; color:#64748b; font-weight:600; letter-spacing:0.04em;">VCM SICKBAY COMMAND</div>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:0.6rem;">
                ${unread > 0 ? `<span style="background:#ef4444; color:white; font-size:0.65rem; font-weight:800; padding:3px 9px; border-radius:20px; letter-spacing:0.04em;">${unread} UNREAD</span>` : `<span style="background:rgba(16,185,129,0.1); color:#10b981; border:1px solid rgba(16,185,129,0.25); font-size:0.65rem; font-weight:800; padding:3px 9px; border-radius:20px;">ALL CLEAR</span>`}
                <button onclick="event.stopPropagation(); document.getElementById('notif-overlay').click();" style="background:rgba(0,0,0,0.05); border:none; color:#64748b; width:28px; height:28px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i data-lucide="x" size="14"></i>
                </button>
            </div>
        </div>
        <div style="display:flex; flex-direction:column; overflow-y:auto; flex:1; scrollbar-width:thin; scrollbar-color:rgba(0,0,0,0.1) transparent;">
            ${notifications.length > 0 ? notifications.map((n, i) => {
        const colors = {
            danger: { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', icon: '#f87171', glow: 'rgba(239,68,68,0.2)' },
            warning: { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', icon: '#fbbf24', glow: 'rgba(245,158,11,0.2)' },
            success: { bg: 'rgba(16,185,129,0.12)', border: '#10b981', icon: '#34d399', glow: 'rgba(16,185,129,0.2)' },
        };
        const c = colors[n.type] || colors.success;
        return `
                <div style="display:flex; gap:1rem; align-items:flex-start; padding:1.1rem 1.4rem; border-bottom:1px solid rgba(255,255,255,0.05); border-left:3px solid ${c.border}; background:${!n.read ? c.bg : 'transparent'}; transition:background 0.2s; animation: fadeInUp 0.35s ease ${i * 0.05}s both;" onmouseenter="this.style.background='rgba(255,255,255,0.04)'" onmouseleave="this.style.background='${!n.read ? c.bg : 'transparent'}'">
                    <div style="width:38px; height:38px; background:${c.bg}; border:1px solid ${c.border}30; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 0 12px ${c.glow};">
                        <i data-lucide="${n.icon}" size="16" style="color:${c.icon};"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.2rem;">
                            <span style="font-weight:700; font-size:0.88rem; color:#0f172a;">${n.title}</span>
                            ${!n.read ? `<span style="width:6px; height:6px; background:${c.border}; border-radius:50%; flex-shrink:0; box-shadow:0 0 6px ${c.glow};"></span>` : ''}
                        </div>
                        <span style="font-size:0.78rem; color:#64748b; line-height:1.5; display:block;">${n.desc}</span>
                    </div>
                </div>`;
    }).join('') : `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4rem 2rem; gap:1rem;">
                    <div style="width:56px; height:56px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:16px; display:flex; align-items:center; justify-content:center;">
                        <i data-lucide="shield-check" size="28" style="color:#10b981;"></i>
                    </div>
                    <p style="color:#475569; font-size:0.85rem; font-weight:600; letter-spacing:0.04em;">NO ACTIVE ALERTS</p>
                    <p style="color:#94a3b8; font-size:0.75rem;">All systems operating nominally.</p>
                </div>
            `}
        </div>
        <div style="padding:1rem 1.25rem; background:#f8fafc; border-top:1px solid rgba(0,0,0,0.07); display:flex; gap:0.6rem;">
            <button style="flex:1; background:linear-gradient(135deg,#0ea5e9,#38bdf8); border:none; color:white; font-weight:800; font-size:0.78rem; padding:11px; border-radius:12px; cursor:pointer; letter-spacing:0.05em; font-family:'Outfit';" onclick="window.location.href='records.html'; event.stopPropagation();">VIEW CLINICAL HISTORY</button>
            <button style="flex:0 0 auto; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); color:#ef4444; font-weight:700; font-size:0.75rem; padding:11px 14px; border-radius:12px; cursor:pointer;" onclick="notifications=[]; renderNotifications(); saveData(); updateUnreadCount(); event.stopPropagation();">CLEAR</button>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

function setupAuth() {
    if (!loginForm) return;

    const passwordInput = document.getElementById('nurse-pass');
    const loginFormElement = document.getElementById('login-form');

    if (!loginFormElement) return;
    const passwordToggle = document.getElementById('toggle-password');
    const passwordToggleIcon = document.getElementById('password-toggle-icon');

    if (passwordInput && passwordToggle && !passwordToggle.dataset.bound) {
        passwordToggle.dataset.bound = 'true';
        passwordToggle.addEventListener('click', () => {
            const isHidden = passwordInput.type === 'password';
            passwordInput.type = isHidden ? 'text' : 'password';
            passwordToggle.setAttribute('aria-pressed', String(isHidden));
            passwordToggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
            passwordToggle.title = isHidden ? 'Hide password' : 'Show password';
            if (passwordToggleIcon) passwordToggleIcon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
            if (window.lucide) lucide.createIcons();
        });
    }

    roleButtons.forEach(button => {
        button.addEventListener('click', () => {
            roleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeLoginRole = button.dataset.loginRole;
            sessionStorage.setItem('activeLoginRole', activeLoginRole);
            if (loginRoleError) loginRoleError.style.display = 'none';
            if (loginFormElement) loginFormElement.style.display = 'block';
        });
    });

    if (activeLoginRole) {
        const selectedButton = Array.from(roleButtons).find(btn => btn.dataset.loginRole === activeLoginRole);
        if (selectedButton) selectedButton.classList.add('active');
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!activeLoginRole) {
            if (loginRoleError) loginRoleError.style.display = 'block';
            return;
        }

        const id = document.getElementById('nurse-id').value;
        const pass = document.getElementById('nurse-pass').value;
        const nurse = nurses.find(n => n.id === id && n.pass === pass);

        if (!nurse) {
            const btn = document.querySelector('.btn-auth-premium');
            btn.style.background = 'var(--danger)';
            btn.textContent = 'ACCESS DENIED';
            setTimeout(() => {
                btn.style.background = '';
                btn.innerHTML = '<span>AUTHORIZE SESSION</span><i data-lucide="shield-check"></i>';
                lucide.createIcons();
            }, 1500);
            return;
        }

        activeNurse = nurse;
        sessionStorage.setItem('activeNurse', JSON.stringify(nurse));
        sessionStorage.setItem('activeLoginRole', activeLoginRole);

        if (activeLoginRole === 'nurse') {
            const sessionId = Date.now().toString();
            attendanceLogs.unshift({
                id: sessionId,
                nurseId: nurse.id,
                nurseName: nurse.name,
                signIn: new Date().toISOString(),
                signOut: null
            });
            sessionStorage.setItem('activeSessionId', sessionId);
        }

        saveData();

        const card = document.querySelector('.login-card');
        if (card) card.classList.add('authorized');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 600);
    });
}

function logout() {
    const logoutBtn = document.getElementById('header-logout-btn') || document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.innerHTML = '<i data-lucide="loader" class="spin"></i><span>LOGGING OUT...</span>';
        if (window.lucide) lucide.createIcons();
    }

    if (activeLoginRole === 'nurse' && activeSessionId) {
        const log = attendanceLogs.find(l => l.id === activeSessionId);
        if (log) {
            log.signOut = new Date().toISOString();
            saveData();
        }
    }

    sessionStorage.removeItem('activeNurse');
    sessionStorage.removeItem('activeSessionId');
    sessionStorage.removeItem('activeLoginRole');
    activeNurse = null;
    activeSessionId = null;
    activeLoginRole = null;

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 800);
}

function renderInventory(filterText = "") {
    if (!inventoryBody) return;
    inventoryBody.innerHTML = "";
    let filtered = items.filter(i => i.name.toLowerCase().includes(filterText.toLowerCase()));
    const isDrugAddinsPage = window.location.pathname.includes('drug-addins.html');

    filtered.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.animation = `fadeInUp 0.6s ease forwards ${index * 0.05}s`;
        const status = item.quantity <= 10 ? { label: "CRITICAL", class: "stock-low" } : { label: "IN-STOCK", class: "badge-success" };
        const spellingWarning = isLikelyDrugSpellingError(item);
        const lastEntryDate = item.lastEntryDate || '';
        const lastEntryLabel = lastEntryDate ? new Date(lastEntryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

        tr.innerHTML = `
            <td>
                <div class="inventory-name-wrap">
                    <strong>${item.name}</strong>
                    ${spellingWarning ? '<span class="spell-warning-dot" title="Possible spelling issue" aria-label="Possible spelling issue"></span>' : ''}
                </div>
            </td>
            <td><span class="category-tag">${item.category}</span></td>
            <td>
                <div class="quantity-control" aria-label="Adjust stock for ${item.name}">
                    <button type="button" class="qty-step-btn qty-minus" onclick="adjustItemQuantity(${item.id}, -1)" title="Decrease stock">−</button>
                    <input
                        type="number"
                        min="0"
                        class="qty-input"
                        value="${Number(item.quantity) || 0}"
                        aria-label="Stock quantity for ${item.name}"
                        onchange="setItemQuantity(${item.id}, this.value)"
                    >
                    <button type="button" class="qty-step-btn qty-plus" onclick="adjustItemQuantity(${item.id}, 1)" title="Increase stock">+</button>
                </div>
                <div class="quantity-hint">${item.packCount && item.unitsPerPack ? `${Number(item.packCount).toLocaleString()} packs × ${Number(item.unitsPerPack).toLocaleString()} + ${Number(item.looseUnits || 0).toLocaleString()} loose = ` : ''}${Number(item.quantity || 0).toLocaleString()} units</div>
            </td>
            ${isDrugAddinsPage ? `<td><span class="category-tag">${lastEntryLabel}</span></td>` : ''}
            <td><span class="status-badge ${status.class}">${status.label}</span></td>
            <td class="text-right">
                <button class="action-btn" onclick="deleteItem(${item.id})"><i data-lucide="trash-2"></i></button>
            </td>
        `;
        inventoryBody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
}

function renderStudents(filterText = "") {
    const grid = document.getElementById('students-grid');
    if (!grid) return;
    grid.innerHTML = "";

    const filtered = students.filter(s =>
        s.name.toLowerCase().includes(filterText.toLowerCase()) ||
        s.admissionNo.toLowerCase().includes(filterText.toLowerCase()) ||
        s.sickbayNo.toLowerCase().includes(filterText.toLowerCase())
    );

    if (studentsTotalCountEl) {
        studentsTotalCountEl.textContent = students.length.toLocaleString();
    }

    const scheduledCount = students.filter(student => Array.isArray(student.medicationSchedule) && student.medicationSchedule.length > 0).length;
    const classCount = new Set(students.map(student => String(student.class || '').trim()).filter(Boolean)).size;
    if (studentsScheduleCountEl) studentsScheduleCountEl.textContent = scheduledCount.toLocaleString();
    if (studentsClassCountEl) studentsClassCountEl.textContent = classCount.toLocaleString();

    filtered.forEach((student, index) => {
        const card = document.createElement('div');
        card.className = "student-card glass sheen";
        card.style.animation = `fadeInUp 0.6s ease forwards ${index * 0.1}s`;
        card.style.cursor = "pointer";
        card.onclick = () => window.location.href = `student-details.html?id=${student.id}`;

        const prescriptions = student.prescriptions.map(p => `
            <div class="med-chip">
                <i data-lucide="pill" size="14"></i>
                <span>${p}</span>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="student-card-header compact" style="display:flex; align-items:center; gap:1rem; margin-bottom:0;">
                <img src="${makeAvatarDataUri(student.name)}" class="student-avatar-compact" style="width:40px; height:40px; border-radius:12px;">
                <div class="student-info-main" style="flex:1;">
                    <h3 style="font-size:1rem; margin:0;">${student.name}</h3>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">${student.class} | ${student.sickbayNo}</p>
                </div>
                <div class="visit-badge" style="background:rgba(14, 165, 233, 0.1); color:var(--primary); padding:4px 8px; border-radius:8px; font-size:0.7rem; font-weight:800;">
                    ${student.prescriptions.length} VISITS
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
}

function updateStats() {
    if (totalItemsEl) totalItemsEl.textContent = items.length;
    if (lowStockEl) lowStockEl.textContent = items.filter(i => i.quantity <= 10).length;
    if (totalStudentsEl) totalStudentsEl.textContent = students.length;
    if (studentsTotalCountEl) studentsTotalCountEl.textContent = students.length.toLocaleString();
    if (studentsScheduleCountEl) studentsScheduleCountEl.textContent = students.filter(student => Array.isArray(student.medicationSchedule) && student.medicationSchedule.length > 0).length.toLocaleString();
    if (studentsClassCountEl) studentsClassCountEl.textContent = new Set(students.map(student => String(student.class || '').trim()).filter(Boolean)).size.toLocaleString();
    if (inventoryTotalItemsEl) inventoryTotalItemsEl.textContent = items.length.toLocaleString();
    if (inventoryLowStockEl) inventoryLowStockEl.textContent = items.filter(i => i.quantity <= 10).length.toLocaleString();
    if (inventoryTotalUnitsEl) inventoryTotalUnitsEl.textContent = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0).toLocaleString();
}

function normalizeDrugName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function levenshteinDistance(a, b) {
    const left = normalizeDrugName(a);
    const right = normalizeDrugName(b);
    if (!left) return right.length;
    if (!right) return left.length;

    const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
    for (let i = 0; i <= left.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= right.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= left.length; i++) {
        for (let j = 1; j <= right.length; j++) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[left.length][right.length];
}

function isLikelyDrugSpellingError(item) {
    if (!item || !item.name) return false;
    if (item.category && item.category.toLowerCase() !== 'medication') return false;

    const normalizedName = normalizeDrugName(item.name);
    if (!normalizedName) return false;

    const referenceNames = [
        ...(window.drugMasterList || []),
        ...(defaultItems || []).map(existing => existing.name).filter(Boolean),
        ...items.filter(existing => existing.id !== item.id).map(existing => existing.name).filter(Boolean)
    ];

    const normalizedReferences = new Set(referenceNames.map(normalizeDrugName).filter(Boolean));
    if (normalizedReferences.has(normalizedName)) return false;

    let bestDistance = Infinity;
    let bestLength = normalizedName.length || 1;
    referenceNames.forEach(reference => {
        const normalizedReference = normalizeDrugName(reference);
        if (!normalizedReference) return;
        const distance = levenshteinDistance(normalizedName, normalizedReference);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestLength = Math.max(normalizedName.length, normalizedReference.length) || 1;
        }
    });

    if (!isFinite(bestDistance)) return false;
    const similarity = 1 - (bestDistance / bestLength);
    return similarity >= 0.68;
}

function adjustItemQuantity(id, delta) {
    const item = items.find(entry => entry.id === id);
    if (!item) return;

    const current = parseInt(item.quantity) || 0;
    item.quantity = Math.max(0, current + delta);
    saveData();
    renderInventory();
    updateStats();
}

function setItemQuantity(id, value) {
    const item = items.find(entry => entry.id === id);
    if (!item) return;

    const parsed = parseInt(value);
    item.quantity = Number.isNaN(parsed) ? (parseInt(item.quantity) || 0) : Math.max(0, parsed);
    saveData();
    renderInventory();
    updateStats();
}

function deleteItem(id) {
    items = items.filter(item => item.id !== id);
    saveData();
    renderInventory();
    updateStats();
}

function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const pageMap = {
                'dashboard': 'index.html',
                'drug-addins': 'drug-addins.html',
                'inventory': 'inventory.html',
                'students': 'students.html',
                'records': 'records.html',
                'reports': 'reports.html',
                'settings': 'settings.html'
            };
            const target = pageMap[link.dataset.view];
            if (target) {
                const currentPath = window.location.pathname;
                if (!currentPath.includes(target)) {
                    // Normalize index path
                    if (target === 'index.html' && (currentPath === '/' || currentPath.endsWith('Inventory/'))) return;
                    window.location.href = target;
                }
            }
        });
    });
}

// =============================================
// SEARCH SUGGESTION ENGINE
// =============================================
function createSearchSuggestions(inputEl, getSuggestions, onSelect) {
    if (!inputEl) return;

    // Wrap input if not already relatively positioned
    const parent = inputEl.parentElement;
    parent.style.position = 'relative';

    // Build dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'search-suggestions-dropdown';
    Object.assign(dropdown.style, {
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: '0',
        right: '0',
        background: '#0f172a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        zIndex: '9997',
        overflow: 'hidden',
        display: 'none',
        flexDirection: 'column',
        maxHeight: '320px',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.1) transparent'
    });
    parent.appendChild(dropdown);

    let activeIndex = -1;
    let currentSuggestions = [];

    function renderSuggestions(query) {
        currentSuggestions = getSuggestions(query).slice(0, 8);
        activeIndex = -1;

        if (!query.trim() || currentSuggestions.length === 0) {
            dropdown.style.display = 'none';
            return;
        }

        dropdown.innerHTML = `
            <div style="padding:8px 14px 6px; font-size:0.65rem; font-weight:800; color:#475569; letter-spacing:0.08em; border-bottom:1px solid rgba(255,255,255,0.05);">
                SUGGESTIONS (${currentSuggestions.length})
            </div>
            ${currentSuggestions.map((s, i) => `
                <div
                    class="sg-item"
                    data-index="${i}"
                    style="display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer; transition:background 0.15s; border-bottom:1px solid rgba(255,255,255,0.04);"
                    onmouseenter="this.style.background='rgba(14,165,233,0.1)'"
                    onmouseleave="this.style.background='${i === activeIndex ? 'rgba(14,165,233,0.15)' : 'transparent'}'"
                >
                    <div style="width:28px; height:28px; background:rgba(14,165,233,0.1); border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <i data-lucide="${s.icon || 'search'}" size="13" style="color:#38bdf8;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.85rem; font-weight:600; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.label}</div>
                        ${s.sub ? `<div style="font-size:0.72rem; color:#64748b;">${s.sub}</div>` : ''}
                    </div>
                    ${s.badge ? `<span style="font-size:0.6rem; font-weight:800; padding:2px 7px; border-radius:6px; background:rgba(14,165,233,0.15); color:#38bdf8;">${s.badge}</span>` : ''}
                </div>
            `).join('')}
        `;

        // Click handlers
        dropdown.querySelectorAll('.sg-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const idx = parseInt(item.dataset.index);
                selectSuggestion(idx);
            });
        });

        dropdown.style.display = 'flex';
        if (window.lucide) lucide.createIcons();
    }

    function setActiveIndex(idx) {
        const items = dropdown.querySelectorAll('.sg-item');
        items.forEach((el, i) => {
            el.style.background = i === idx ? 'rgba(14,165,233,0.15)' : 'transparent';
        });
        activeIndex = idx;
        if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
    }

    function selectSuggestion(idx) {
        const s = currentSuggestions[idx];
        if (!s) return;
        inputEl.value = s.label;
        dropdown.style.display = 'none';
        onSelect(s, inputEl.value);
    }

    inputEl.addEventListener('input', (e) => {
        renderSuggestions(e.target.value);
    });

    inputEl.addEventListener('focus', (e) => {
        if (e.target.value.trim()) renderSuggestions(e.target.value);
    });

    inputEl.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.sg-item');
        if (!items.length || dropdown.style.display === 'none') return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(Math.min(activeIndex + 1, currentSuggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(Math.max(activeIndex - 1, 0));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            selectSuggestion(activeIndex);
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!parent.contains(e.target)) dropdown.style.display = 'none';
    });
}

function getGlobalSuggestions(query) {
    const q = query.toLowerCase();
    const path = window.location.pathname;
    const results = [];

    // Student suggestions
    if (!path.includes('inventory.html') && !path.includes('reports.html')) {
        students.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.admissionNo.toLowerCase().includes(q) ||
            s.sickbayNo.includes(q) ||
            s.class.toLowerCase().includes(q)
        ).slice(0, 5).forEach(s => {
            results.push({
                label: s.name,
                sub: `${s.class} · SB: ${s.sickbayNo} · ADM: ${s.admissionNo}`,
                badge: 'Student',
                icon: 'user',
                value: s.name,
                href: `student-details.html?id=${s.id}`
            });
        });
    }

    // Inventory item suggestions
    if (!path.includes('students.html') && !path.includes('records.html') && !path.includes('reports.html')) {
        items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
        ).slice(0, 4).forEach(i => {
            results.push({
                label: i.name,
                sub: `${i.category} · ${i.quantity.toLocaleString()} units`,
                badge: i.quantity <= 10 ? 'CRITICAL' : 'In-Stock',
                icon: 'package',
                value: i.name
            });
        });
    }

    // Nurse suggestions (for records / reports)
    if (path.includes('records.html') || path.includes('reports.html')) {
        nurses.filter(n => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
            .slice(0, 3).forEach(n => {
                results.push({ label: n.name, sub: n.role, badge: 'Nurse', icon: 'stethoscope', value: n.name });
            });
    }

    return results;
}

function getDrugNameSuggestions(query) {
    const q = query.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!q) return [];

    const source = [
        ...(window.drugMasterList || []),
        ...items.map(item => item.name).filter(Boolean)
    ];

    const seen = new Set();
    return source
        .filter(name => name.toLowerCase().replace(/\s+/g, ' ').trim().includes(q))
        .sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(q) ? 0 : 1;
            const bStarts = b.toLowerCase().startsWith(q) ? 0 : 1;
            return aStarts - bStarts || a.localeCompare(b);
        })
        .filter(name => {
            const norm = name.toLowerCase().replace(/\s+/g, ' ').trim();
            if (seen.has(norm)) return false;
            seen.add(norm);
            return true;
        })
        .slice(0, 8)
        .map(name => ({
            label: name,
            sub: 'Drug / item name suggestion',
            badge: 'Drug',
            icon: 'pill',
            value: name
        }));
}

function setupDrugNameAutocomplete() {
    const drugNameInput = document.getElementById('new-item-name');
    if (!drugNameInput) return;

    createSearchSuggestions(
        drugNameInput,
        (query) => getDrugNameSuggestions(query),
        () => {}
    );
}

function getAvailableDrugCatalog(query = '') {
    const q = String(query || '').toLowerCase().trim();
    const catalog = [];
    const seen = new Set();

    const addDrug = (drug) => {
        if (!drug || !drug.name) return;
        const name = String(drug.name).trim();
        const normalized = name.toLowerCase().replace(/\s+/g, ' ');
        if (!normalized || seen.has(normalized)) return;
        if (q && !normalized.includes(q) && !String(drug.category || '').toLowerCase().includes(q)) return;
        seen.add(normalized);
        catalog.push(drug);
    };

    (items || [])
        .slice()
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
        .forEach(item => addDrug({
            name: item.name,
            category: item.category || 'Medication',
            quantity: item.quantity,
            expiry: item.expiry,
            source: 'inventory'
        }));

    (window.drugMasterList || [])
        .slice()
        .sort((a, b) => String(a).localeCompare(String(b)))
        .forEach(name => addDrug({
            name,
            category: 'Medication',
            source: 'database'
        }));

    return catalog;
}

function fillDrugFormFromCatalogItem(drug) {
    const nameField = document.getElementById('new-item-name');
    const categoryField = document.getElementById('new-item-category');
    const quantityField = document.getElementById('new-item-quantity');
    const packsField = document.getElementById('new-item-packs');
    const unitsPerPackField = document.getElementById('new-item-units-per-pack');
    const looseUnitsField = document.getElementById('new-item-loose-units');
    const expiryField = document.getElementById('new-item-expiry');

    if (nameField) nameField.value = drug.name || '';
    if (categoryField && drug.category) categoryField.value = drug.category;
    if (expiryField && drug.expiry) expiryField.value = drug.expiry;

    if (quantityField) quantityField.focus();
    else if (packsField) packsField.focus();
    else if (unitsPerPackField) unitsPerPackField.focus();
    else if (looseUnitsField) looseUnitsField.focus();

    const nameInput = document.getElementById('new-item-name');
    if (nameInput) nameInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderAvailableDrugCatalog(query = '') {
    const panel = document.getElementById('available-drugs-panel');
    const list = document.getElementById('available-drugs-list');
    const search = document.getElementById('available-drugs-search');
    if (!panel || !list) return;

    const catalog = getAvailableDrugCatalog(query).slice(0, 60);
    if (search && search.value !== query) search.value = query;

    if (!catalog.length) {
        list.innerHTML = '<div class="available-drugs-empty">No matching drugs found.</div>';
        return;
    }

    list.innerHTML = catalog.map((drug, index) => `
        <button type="button" class="available-drug-item ${drug.source === 'inventory' ? 'is-existing' : ''}" data-catalog-index="${index}" role="listitem">
            <div class="available-drug-item-main">
                <strong>${drug.name}</strong>
                <span>${drug.category || 'Medication'}${drug.source === 'inventory' ? ` · ${Number(drug.quantity || 0).toLocaleString()} units in stock` : ''}</span>
            </div>
            <span class="available-drug-badge">${drug.source === 'inventory' ? 'Inventory' : 'Database'}</span>
        </button>
    `).join('');

    list.querySelectorAll('[data-catalog-index]').forEach(button => {
        button.addEventListener('click', () => {
            const selected = catalog[Number(button.getAttribute('data-catalog-index'))];
            if (!selected) return;
            fillDrugFormFromCatalogItem(selected);
        });
    });
}

function setupAvailableDrugBrowser() {
    const panel = document.getElementById('available-drugs-panel');
    const button = document.getElementById('available-drugs-btn');
    const closeButton = document.getElementById('close-available-drugs-panel');
    const search = document.getElementById('available-drugs-search');
    if (!panel) return;

    const openPanel = () => {
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        renderAvailableDrugCatalog(search ? search.value : '');
    };

    const closePanel = () => {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
    };

    if (button) {
        button.addEventListener('click', () => {
            if (panel.classList.contains('is-open')) closePanel();
            else openPanel();
        });
    }

    if (closeButton) closeButton.addEventListener('click', closePanel);
    if (search) search.addEventListener('input', (e) => renderAvailableDrugCatalog(e.target.value));

    renderAvailableDrugCatalog(search ? search.value : '');
}

function setupGlobalListeners() {
    const search = document.getElementById('global-search');
    if (search) {
        // Wire suggestions first
        createSearchSuggestions(
            search,
            (q) => getGlobalSuggestions(q),
            (suggestion) => {
                const path = window.location.pathname;
                // Navigate directly for student suggestions
                if (suggestion.href) {
                    window.location.href = suggestion.href;
                    return;
                }
                // Otherwise trigger the filter
                if (path.includes('students.html')) renderStudents(suggestion.value);
                else if (path.includes('records.html')) renderClinicalRecords(suggestion.value);
                else if (path.includes('reports.html')) renderAttendanceLogs(suggestion.value);
                else renderInventory(suggestion.value);
            }
        );

        search.addEventListener('input', (e) => {
            const path = window.location.pathname;
            if (path.includes('students.html')) {
                renderStudents(e.target.value);
            } else if (path.includes('student-details.html')) {
                const params = new URLSearchParams(window.location.search);
                const studentId = parseInt(params.get('id'));
                const student = students.find(s => s.id === studentId);
                if (student) renderStudentHistoryTimeline(student, e.target.value);
            } else if (path.includes('records.html')) {
                renderClinicalRecords(e.target.value);
            } else if (path.includes('reports.html')) {
                renderAttendanceLogs(e.target.value);
            } else {
                renderInventory(e.target.value);
            }
        });
    }

    const logoutBtns = document.querySelectorAll('.btn-terminate, #logout-btn');
    logoutBtns.forEach(btn => btn.addEventListener('click', logout));

    // Modal Global Listeners
    setupModalListeners('issue-asset-modal', 'close-issue-modal', 'issue-asset-form', handleIssuance);
    setupModalListeners('referral-modal', 'close-referral-modal');
    setupModalListeners('add-item-modal', 'close-add-item-modal', 'add-item-form', handleAddItem);
    setupModalListeners('add-student-modal', 'close-add-student-modal', 'add-student-form', handleAddStudent);
    setupModalListeners('record-modal', 'close-record-modal', 'record-form', handleRecordSubmit);

    // Open Modal Buttons
    const addItemBtn = document.getElementById('add-item-btn');
    if (addItemBtn) addItemBtn.addEventListener('click', () => openModal('add-item-modal'));

    setupDrugNameAutocomplete();
    setupAvailableDrugBrowser();

    const addStudentBtn = document.getElementById('add-student-btn');
    if (addStudentBtn) addStudentBtn.addEventListener('click', () => openModal('add-student-modal'));

    // Data Portability Listeners
    const exportBtn = document.getElementById('export-backup-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportFullBackup);

    const importInput = document.getElementById('import-data-input');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleImport(e.target.files[0]);
            }
        });
    }

    const triggerImportBtn = document.getElementById('trigger-import-btn');
    if (triggerImportBtn && importInput) {
        triggerImportBtn.addEventListener('click', () => importInput.click());
    }

    // Asset Picker Search Listener
    const assetSearch = document.getElementById('asset-search');
    if (assetSearch) {
        createSearchSuggestions(
            assetSearch,
            (q) => {
                if (!q.trim()) return [];
                const ql = q.toLowerCase();
                return items.filter(i =>
                    i.name.toLowerCase().includes(ql) ||
                    i.category.toLowerCase().includes(ql)
                ).slice(0, 8).map(i => ({
                    label: i.name,
                    sub: `${i.category} · ${i.quantity.toLocaleString()} units`,
                    badge: i.quantity <= 10 ? 'CRITICAL' : 'In-Stock',
                    icon: 'pill',
                    value: i.name
                }));
            },
            (suggestion) => {
                renderAssetSearchResults(suggestion.value);
            }
        );
        assetSearch.addEventListener('input', (e) => renderAssetSearchResults(e.target.value));
    }

    // Nurse Profile Dropdown Toggle
    const profileTrigger = document.getElementById('nurse-profile-trigger');
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            profileTrigger.classList.toggle('active');
            profileDropdown.classList.toggle('active');
        });
    }

    document.addEventListener('click', () => {
        if (profileTrigger) profileTrigger.classList.remove('active');
        if (profileDropdown) profileDropdown.classList.remove('active');
    });
}

function setupModalListeners(modalId, closeId, formId = null, submitHandler = null) {
    const modal = document.getElementById(modalId);
    const closeBtn = document.getElementById(closeId);
    const form = formId ? document.getElementById(formId) : null;

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => modal.style.display = 'none');
    }

    if (form && submitHandler) {
        form.addEventListener('submit', submitHandler);
    }
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
}

function handleAddItem(e) {
    e.preventDefault();
    const name = document.getElementById('new-item-name').value.trim();
    const category = document.getElementById('new-item-category').value;
    const quantityField = document.getElementById('new-item-quantity');
    const packsField = document.getElementById('new-item-packs');
    const unitsPerPackField = document.getElementById('new-item-units-per-pack');
    const looseUnitsField = document.getElementById('new-item-loose-units');
    const quantity = quantityField ? parseInt(quantityField.value) : NaN;
    const packCount = packsField ? Math.max(0, parseInt(packsField.value) || 0) : 0;
    const unitsPerPack = unitsPerPackField ? Math.max(0, parseInt(unitsPerPackField.value) || 0) : 0;
    const looseUnits = looseUnitsField ? Math.max(0, parseInt(looseUnitsField.value) || 0) : 0;
    const hasPackInputs = Boolean(packsField || unitsPerPackField || looseUnitsField);
    const incomingQuantity = hasPackInputs ? (packCount * unitsPerPack) + looseUnits : (isNaN(quantity) ? 0 : quantity);
    const expiry = document.getElementById('new-item-expiry').value;

    // Normalize name for matching so repeated entries with only spacing/case differences still merge.
    const norm = name.toLowerCase().replace(/\s+/g, ' ').trim();

    // Find all matching items by normalized name and pick the most recently created one (highest id)
    const matches = items.filter(i => i.name && i.name.toLowerCase().replace(/\s+/g, ' ').trim() === norm);
    let existing = null;
    if (matches.length) {
        existing = matches.reduce((a, b) => (a.id > b.id ? a : b));
    }

    let notifDesc;
    if (existing) {
        // Merge any earlier duplicates into the most recent matching entry.
        const mergedQuantity = matches.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
        existing.quantity = mergedQuantity + incomingQuantity;
        if (hasPackInputs) {
            existing.packCount = (parseInt(existing.packCount) || 0) + packCount;
            existing.unitsPerPack = unitsPerPack || existing.unitsPerPack || 0;
            existing.looseUnits = (parseInt(existing.looseUnits) || 0) + looseUnits;
        }
        existing.lastEntryDate = new Date().toISOString();
        items = items.filter(item => !matches.includes(item) || item === existing);
        // Update expiry only if the new one is later or existing missing
        if (expiry) {
            if (!existing.expiry || expiry > existing.expiry) existing.expiry = expiry;
        }
        // If category differs prefer the most recent category if provided
        if (category && !existing.category) existing.category = category;
        notifDesc = `${existing.name} stock updated (+${incomingQuantity} units) by ${activeNurse ? activeNurse.name : 'System'}`;
    } else {
        const newItem = {
            id: Date.now(),
            name,
            category,
            quantity: incomingQuantity,
            expiry,
            lastEntryDate: new Date().toISOString(),
            ...(hasPackInputs ? { packCount, unitsPerPack, looseUnits } : {})
        };
        items.push(newItem);
        existing = newItem;
        notifDesc = `${name} added to repository by ${activeNurse ? activeNurse.name : 'System'}`;
    }

    saveData();

    const addItemModal = document.getElementById('add-item-modal');
    if (addItemModal) addItemModal.style.display = 'none';
    const addItemForm = document.getElementById('add-item-form');
    if (addItemForm) addItemForm.reset();

    renderDataForPage();
    updateStats();

    notifications.unshift({
        id: Date.now(),
        type: 'success',
        title: existing ? 'Stock Replenished' : 'New Asset Provisioned',
        desc: notifDesc,
        icon: 'package'
    });
    saveData();
    renderNotifications();
}

function handleAddStudent(e) {
    e.preventDefault();
    const name = document.getElementById('new-student-name').value;
    const studentClass = document.getElementById('new-student-class').value;
    const dob = document.getElementById('new-student-dob').value;
    const admission = document.getElementById('new-student-admission').value;
    const sickbay = document.getElementById('new-student-sickbay').value;
    const allergies = document.getElementById('new-student-allergies').value || "None Reported";
    const bloodGroup = document.getElementById('new-student-bloodgroup').value || "N/A";
    const parentContact = document.getElementById('new-student-contact').value;

    if (!isAdmissionNoUnique(admission)) {
        alert("SECURITY ALERT: This Admission Number is already linked to another profile.");
        return;
    }

    if (!isSickbayNoUnique(sickbay)) {
        alert("SECURITY ALERT: This Sickbay Number is already assigned to another profile.");
        return;
    }

    const newStudent = {
        id: Date.now(),
        name,
        class: studentClass,
        dob,
        admissionNo: admission,
        sickbayNo: sickbay.padStart(4, '0'),
        allergies: allergies,
        bloodGroup: bloodGroup,
        parentContact: parentContact,
        prescriptions: []
    };

    students.push(newStudent);
    saveData();

    document.getElementById('add-student-modal').style.display = 'none';
    document.getElementById('add-student-form').reset();

    renderDataForPage();
    updateStats();

    notifications.unshift({
        id: Date.now(),
        type: 'success',
        title: 'New Admission',
        desc: `${name} (${studentClass}) admitted by ${activeNurse.name}`,
        icon: 'users'
    });
    saveData();
    renderNotifications();
}

function renderClinicalRecords(filterText = "") {
    const container = document.getElementById('clinical-records-container');
    if (!container) return;
    container.innerHTML = "";

    const lowerFilter = filterText.toLowerCase();

    // Calculate Global Analytics
    const totalVisits = students.reduce((sum, s) => sum + s.prescriptions.length, 0);

    students.forEach(student => {
        // Group all valid records for this student
        const studentRecords = student.prescriptions.filter(p => {
            if (typeof p === 'string') {
                return p.toLowerCase().includes(lowerFilter) || student.name.toLowerCase().includes(lowerFilter);
            }
            return student.name.toLowerCase().includes(lowerFilter) ||
                p.complaint.toLowerCase().includes(lowerFilter) ||
                p.nurse.toLowerCase().includes(lowerFilter) ||
                p.item.toLowerCase().includes(lowerFilter);
        });

        if (studentRecords.length > 0 || student.name.toLowerCase().includes(lowerFilter)) {
            const studentBlock = document.createElement('div');
            studentBlock.className = "record-student-block glass sheen compact";
            studentBlock.dataset.studentId = student.id;
            studentBlock.ondblclick = () => toggleRecordExpansion(student.id);

            // Individual Analytics
            const visitCount = student.prescriptions.length;
            const visitFreq = totalVisits > 0 ? ((visitCount / totalVisits) * 100).toFixed(1) : 0;
            const isFrequent = visitFreq > 15; // Benchmark for frequent visitor

            // Check for recurring issues
            const recent = student.prescriptions.slice(0, 3).filter(r => typeof r !== 'string');
            let isDeteriorating = false;
            if (recent.length >= 2) {
                const firstComplaint = recent[0].complaint.toLowerCase();
                isDeteriorating = recent.slice(1).some(r => r.complaint.toLowerCase().includes(firstComplaint) || firstComplaint.includes(r.complaint.toLowerCase()));
            }

            let recordsHtml = studentRecords.map(p => {
                if (typeof p === 'string') {
                    return `
                        <div class="med-chip-premium legacy">
                            <div class="med-chip-header">
                                <span class="complaint">Legacy Treatment Record</span>
                                <span class="timestamp">UNCERTAIN PROTOCOL</span>
                            </div>
                            <div class="med-chip-details">
                                <span class="med-issued">${p}</span>
                                <span class="nurse-tag">SYSTEM LOG</span>
                            </div>
                        </div>
                    `;
                } else {
                    const idx = student.prescriptions.indexOf(p);
                    return `
                        <div class="med-chip-premium">
                            <div class="med-chip-header">
                                <div class="chip-main">
                                    <i data-lucide="activity" size="14"></i>
                                    <span class="complaint">${p.complaint}</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <span class="timestamp">${new Date(p.timestamp).toLocaleDateString()}</span>
                                    <button class="btn-icon-premium mini" onclick="openEditRecordModal(${student.id}, ${idx})">
                                        <i data-lucide="edit-3" size="12"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="med-chip-details">
                                <span class="med-issued">${p.item ? p.item : 'Observation Only'} ${p.quantity ? `(${p.quantity} units)` : ''}</span>
                                <span class="nurse-tag">
                                    <i data-lucide="user" size="10"></i>
                                    ${p.nurse}
                                </span>
                            </div>
                        </div>
                    `;
                }
            }).join('');

            studentBlock.innerHTML = `
                <div class="student-record-header">
                    <div style="display:flex; align-items:center; gap:1.5rem;">
                        <div class="student-id-badge">${student.sickbayNo}</div>
                        <div class="student-info-main">
                            <div style="display:flex; align-items:center; gap:0.75rem;">
                                <h3>${student.name}</h3>
                                ${isFrequent ? '<span class="nurse-tag" style="background:rgba(245,158,11,0.1); color:var(--warning); border:1px solid rgba(245,158,11,0.2);">FREQUENT VISITOR</span>' : ''}
                                ${isDeteriorating ? '<span class="nurse-tag" style="background:rgba(239,68,68,0.1); color:var(--danger); border:1px solid rgba(239,68,68,0.2);">CRITICAL OBSERVATION</span>' : ''}
                                <span class="expansion-hint">• DOUBLE CLICK TO EXPAND HISTORY</span>
                            </div>
                            <p>${student.class} | ADM: ${student.admissionNo} | <span style="color:var(--primary); font-weight:700;">${visitFreq}% of Sickbay Visits</span></p>
                        </div>
                    </div>
                    <button class="btn-primary" onclick="openCreateRecordModal(${student.id}, '${student.name.replace(/'/g, "\\'")}')">
                        <i data-lucide="plus-circle"></i> Create Entry
                    </button>
                </div>
                <div class="student-history-grid">
                    ${recordsHtml || '<p style="grid-column: 1/-1; text-align:center; padding:2rem; color:var(--text-muted); font-size:0.9rem;">No records found for active filter.</p>'}
                </div>
            `;
            container.appendChild(studentBlock);
        }
    });

    if (window.lucide) lucide.createIcons();
}

function openCreateRecordModal(studentId, studentName) {
    const modal = document.getElementById('record-modal');
    if (!modal) {
        console.error("Critical Failure: record-modal is missing from DOM.");
        return;
    }

    document.getElementById('record-modal-title').textContent = "New Clinical Entry";
    document.getElementById('record-submit-text').textContent = "Authorize & Save Entry";
    document.getElementById('record-student-id').value = studentId;
    document.getElementById('record-student-name').value = studentName;
    document.getElementById('record-entry-index').value = "";
    document.getElementById('record-complaint').value = "";
    document.getElementById('record-treatment').value = "";

    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function openEditRecordModal(studentId, entryIndex) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const entry = student.prescriptions[entryIndex];
    if (!entry || typeof entry === 'string') return;

    const modal = document.getElementById('record-modal');
    document.getElementById('record-modal-title').textContent = "Revise Clinical Entry";
    document.getElementById('record-submit-text').textContent = "Update & Save Protocol";
    document.getElementById('record-student-id').value = studentId;
    document.getElementById('record-student-name').value = student.name;
    document.getElementById('record-entry-index').value = entryIndex;
    document.getElementById('record-complaint').value = entry.complaint;
    document.getElementById('record-treatment').value = entry.item || "";
    modal.style.display = 'flex';
}

function handleRecordSubmit(e) {
    e.preventDefault();
    const studentId = parseInt(document.getElementById('record-student-id').value);
    const entryIndex = document.getElementById('record-entry-index').value;
    const complaint = document.getElementById('record-complaint').value;
    const treatment = document.getElementById('record-treatment').value;

    const student = students.find(s => s.id === studentId);
    if (!student) return;

    if (entryIndex === "") {
        // Create new
        const newEntry = {
            complaint: complaint,
            item: treatment,
            quantity: 1, // Defaulting to 1 for generic entries
            nurse: activeNurse ? activeNurse.name : "System",
            timestamp: new Date().toISOString()
        };
        student.prescriptions.unshift(newEntry);
    } else {
        // Edit existing
        const idx = parseInt(entryIndex);
        student.prescriptions[idx].complaint = complaint;
        student.prescriptions[idx].item = treatment;
        student.prescriptions[idx].lastEdit = new Date().toISOString();
        student.prescriptions[idx].editor = activeNurse ? activeNurse.name : "System";
    }

    saveData();
    document.getElementById('record-modal').style.display = 'none';
    renderClinicalRecords();

    notifications.unshift({
        id: Date.now(),
        type: 'success',
        title: entryIndex === "" ? 'New Entry Documented' : 'Entry Revised',
        desc: `Clinical record for ${student.name} ${entryIndex === "" ? 'added' : 'updated'} by ${activeNurse ? activeNurse.name : 'Unknown'}`,
        icon: entryIndex === "" ? 'file-plus' : 'edit-3'
    });
    saveData();
    renderNotifications();
}

function renderAttendanceLogs(filterText = "") {
    const body = document.getElementById('attendance-body');
    if (!body) return;
    body.innerHTML = "";

    const lowerFilter = filterText.toLowerCase();

    attendanceLogs.filter(log => {
        return log.nurseName.toLowerCase().includes(lowerFilter) ||
            log.nurseId.toLowerCase().includes(lowerFilter);
    }).forEach(log => {
        const tr = document.createElement('tr');
        const duration = log.signOut ?
            Math.round((new Date(log.signOut) - new Date(log.signIn)) / 60000) + " mins" :
            "Ongoing Session";

        tr.innerHTML = `
            <td>
                <div style="font-weight:800; color:var(--text-main);">${log.nurseName}</div>
                <div style="font-size:0.75rem; color:var(--text-muted);">${log.nurseId}</div>
            </td>
            <td>
                <div style="font-size:0.9rem;">${new Date(log.signIn).toLocaleDateString()}</div>
                <div style="font-size:0.75rem; color:var(--primary); font-weight:700;">${new Date(log.signIn).toLocaleTimeString()}</div>
            </td>
            <td>
                ${log.signOut ? `
                    <div style="font-size:0.9rem;">${new Date(log.signOut).toLocaleDateString()}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">${new Date(log.signOut).toLocaleTimeString()}</div>
                ` : '<span style="color:var(--success); font-weight:800; font-size:0.75rem; letter-spacing:0.05em;">ACTIVE ON DUTY</span>'}
            </td>
            <td>
                <span class="nurse-tag" style="${!log.signOut ? 'background:rgba(16,185,129,0.1); color:var(--success);' : ''}">
                    <i data-lucide="${log.signOut ? 'clock' : 'activity'}" size="10"></i>
                    ${duration}
                </span>
            </td>
        `;
        body.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
}

function openIssueModal(studentId, studentName) {
    const modal = document.getElementById('issue-asset-modal');
    const idInput = document.getElementById('target-student-id');
    const nameInput = document.getElementById('target-student-name');
    const assetSelect = document.getElementById('issue-asset-id');

    if (!activeNurse) {
        alert("Authorization Required: Please log in to issue assets.");
        window.location.href = 'index.html';
        return;
    }

    if (modal && idInput && nameInput) {
        idInput.value = studentId;
        nameInput.value = studentName;

        clearAssetSelection();
        modal.style.display = 'flex';
    }
}

function handleIssuance(e) {
    e.preventDefault();
    const studentId = parseInt(document.getElementById('target-student-id').value);
    const assetId = parseInt(document.getElementById('issue-asset-id').value);
    const quantity = parseInt(document.getElementById('issue-quantity').value);
    const complaint = document.getElementById('issue-complaint').value;

    const student = students.find(s => s.id === studentId);
    const item = items.find(i => i.id === assetId);

    if (item && item.quantity >= quantity) {
        item.quantity -= quantity;

        const record = {
            complaint: complaint,
            item: item.name,
            quantity: quantity,
            nurse: activeNurse.name,
            timestamp: new Date().toISOString()
        };

        student.prescriptions.unshift(record);

        // Low Stock Monitoring
        if (item.quantity < 10) {
            notifications.unshift({
                id: Date.now() + 1,
                type: 'danger',
                title: 'Critical Stock Alert',
                desc: `${item.name} is critically low (${item.quantity} units left). Restock protocol initiated.`,
                icon: 'package'
            });
        }

        // Health Trend Monitoring
        checkHealthTrend(student);

        saveData();

        // Update UI
        document.getElementById('issue-asset-modal').style.display = 'none';
        document.getElementById('issue-asset-form').reset();

        renderDataForPage();

        // Notification
        notifications.unshift({
            id: Date.now(),
            type: 'success',
            title: 'Asset Issued',
            desc: `${quantity} ${item.name} issued for ${student.name} by ${activeNurse.name}`,
            icon: 'check-circle'
        });
        saveData();
        renderNotifications();

        if (window.lucide) lucide.createIcons();
    } else {
        alert("Insufficient Stock: Resource depletion detected.");
    }
}

function checkHealthTrend(student) {
    if (student.prescriptions.length < 3) return;

    const recentRecords = student.prescriptions.slice(0, 3).filter(r => typeof r !== 'string');
    if (recentRecords.length < 3) return;

    const complaints = recentRecords.map(r => r.complaint.toLowerCase());
    const isRecurring = complaints.every(c => c === complaints[0] || c.includes(complaints[0]) || complaints[0].includes(c));

    if (isRecurring) {
        const alreadyNotified = notifications.some(n =>
            n.title === 'Clinical Review Recommended' && n.desc.includes(student.name)
        );

        if (!alreadyNotified) {
            notifications.unshift({
                id: Date.now() + 2,
                type: 'warning',
                title: 'Clinical Review Recommended',
                desc: `Health trend for ${student.name} shows recurring issues (${complaints[0]}). Condition may be worsening.`,
                icon: 'alert-triangle'
            });
        }
    }
}

function checkMissedDosages() {
    students.forEach(student => {
        if (!student.medicationSchedule) return;

        student.medicationSchedule.forEach(sch => {
            const lastDose = student.prescriptions.find(p =>
                typeof p !== 'string' && p.item === sch.item
            );

            const lastDoseTime = lastDose ? new Date(lastDose.timestamp) : new Date(0);
            const hoursSinceLast = (new Date() - lastDoseTime) / (1000 * 60 * 60);

            if (hoursSinceLast > sch.intervalHours) {
                const alreadyNotified = notifications.some(n =>
                    n.title === 'Missed Dosage' && n.desc.includes(student.name) && n.desc.includes(sch.item)
                );

                if (!alreadyNotified) {
                    notifications.unshift({
                        id: Date.now() + Math.random(),
                        type: 'danger',
                        title: 'Missed Dosage',
                        desc: `${student.name} missed scheduled ${sch.item}. Protocol overdue by ${Math.floor(hoursSinceLast)} hours.`,
                        icon: 'clock'
                    });
                    saveData();
                    renderNotifications();
                }
            }
        });
    });
}

function generateReferral(studentId, manualMode = false) {
    const student = students.find(s => s.id === studentId);
    const modal = document.getElementById('referral-modal');
    const preview = document.getElementById('referral-preview');
    const regenBtn = document.getElementById('regen-referral-btn');

    if (!activeNurse) {
        alert("Authorization Required: Please log in to generate referrals.");
        window.location.href = 'index.html';
        return;
    }

    if (modal && preview) {
        window._activeReferralStudentId = studentId;

        const latestRecord = manualMode ? {
            complaint: "Write the reason for referral here.",
            item: "N/A",
            quantity: 0
        } : (student.prescriptions.find(p => typeof p === 'object') || {
            complaint: "No recent clinical observations recorded.",
            item: "N/A",
            quantity: 0
        });

        const referralDate = new Date().toLocaleDateString();
        const referralId = `REF-${Date.now().toString().slice(-6)}`;

        const buildReferralHTML = () => `
            <div class="referral-letter-inner" style="padding:2.5rem; color:var(--text-main); font-family:'Inter'; line-height:1.7; min-height:760px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--primary); padding-bottom:1.5rem; margin-bottom:2rem; gap:1rem;">
                    <div>
                        <h2 style="font-family:'Outfit'; font-weight:800; color:var(--primary); margin:0;">SICKBAY INTEL</h2>
                        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--text-muted);">Official Clinical Referral</span>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <p style="font-size:0.85rem; font-weight:700; margin:0;">${referralId}</p>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">${referralDate}</p>
                    </div>
                </div>

                <div style="margin-bottom:2rem;">
                    <p style="margin-bottom:0.5rem;"><strong>TO:</strong> The Principal / Management Board</p>
                    <p><strong>SUBJECT:</strong> ${manualMode ? 'Manual Clinical Referral Draft' : `Medical Referral for Student ${student.name}`}</p>
                </div>

                <div style="margin-bottom:2rem; background:rgba(0,0,0,0.02); padding:1.5rem; border-radius:16px;">
                    <p style="margin-bottom:1rem;"><strong>Student Identity:</strong> ${student.name} (${student.class}) | ADM: ${student.admissionNo}</p>
                    <p style="margin-bottom:1rem;"><strong>Clinical Findings:</strong> ${latestRecord.complaint}</p>
                    <p><strong>Treatment Administered:</strong> ${manualMode ? 'Manual referral draft - fill in if needed.' : (latestRecord.item !== 'N/A' ? `${latestRecord.item} (${latestRecord.quantity} units)` : 'No medication administered within this session.')}</p>
                </div>

                <p style="margin-bottom:2rem;">${manualMode ? 'Use this draft to manually write the referral details before printing.' : 'Based on the clinical presentation above, the student is hereby referred for further medical assessment or home-based recovery. You may edit this letter directly before printing if you need to add notes, instructions, or a different referral reason.'}</p>

                <div style="margin-bottom:2rem; padding:1.25rem; border:1px dashed rgba(0,0,0,0.12); border-radius:16px; background:rgba(255,255,255,0.6);">
                    <strong style="display:block; margin-bottom:0.5rem;">Editable referral note:</strong>
                    <div style="min-height:90px; outline:none; white-space:pre-wrap;" contenteditable="true" data-referral-note="true">${manualMode ? `Enter your manual referral text for ${student.name} here.` : `${student.name} should be reviewed and cleared before returning to class.`}</div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:3rem; padding-top:2rem; border-top:1px dashed rgba(0,0,0,0.1); gap:1rem;">
                    <div>
                        <p style="font-weight:800; margin:0;">${activeNurse.name}</p>
                        <p style="font-size:0.8rem; color:var(--text-muted); margin:0;">${activeNurse.role} | Sickbay Operations</p>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <i data-lucide="shield-check" color="var(--primary)" size="32"></i>
                        <p style="font-size:0.6rem; font-weight:800; text-transform:uppercase; margin-top:0.5rem;">Digitally Verified</p>
                    </div>
                </div>
            </div>
        `;

        const renderReferral = () => {
            preview.innerHTML = buildReferralHTML();
            if (window.lucide) lucide.createIcons();
        };

        renderReferral();

        modal.style.display = 'flex';
        if (regenBtn) regenBtn.style.display = manualMode ? 'none' : 'inline-flex';

        if (regenBtn) {
            regenBtn.onclick = () => renderReferral();
        }

        document.getElementById('send-principal-btn').onclick = () => {
            alert(`Referral for ${student.name} has been securely dispatched to the Principal's terminal.`);
            modal.style.display = 'none';

            notifications.unshift({
                id: Date.now(),
                type: 'warning',
                title: 'Referral Dispatched',
                desc: `Referral for ${student.name} sent to Principal by ${activeNurse.name}`,
                icon: 'send'
            });
            saveData();
            renderNotifications();
        };

        document.getElementById('print-referral-btn').onclick = () => {
            window.print();
        };
    }
}

function handleImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.data || !backup.data.students) throw new Error("Invalid structure");

            // Restore data
            students = backup.data.students || defaultStudents;
            inventory = backup.data.inventory || defaultInventory;
            notifications = backup.data.notifications || defaultNotifications;
            attendanceLogs = backup.data.attendance || [];

            saveData();
            alert("Data Protocol Restoration Complete. The system will now refresh.");
            window.location.reload();
        } catch (err) {
            alert("Critical Failure: The uploaded backup document is corrupted or invalid.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// Asset Picker Logic
function renderAssetSearchResults(filterText = "") {
    const list = document.getElementById('asset-results-list');
    if (!list) return;

    if (filterText.trim() === "") {
        list.innerHTML = "";
        return;
    }

    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(filterText.toLowerCase()) ||
        i.category.toLowerCase().includes(filterText.toLowerCase())
    );

    list.innerHTML = filtered.map(item => `
        <div class="asset-result-item" onclick="selectAsset(${item.id})">
            <div class="item-name">${item.name}</div>
            <div class="item-stock">${item.quantity} available</div>
        </div>
    `).join('');
}

function selectAsset(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('issue-asset-id').value = item.id;
    document.getElementById('selected-asset-name').textContent = item.name;
    document.getElementById('selected-asset-display').style.display = 'flex';
    document.getElementById('asset-results-list').innerHTML = "";
    document.getElementById('asset-search').value = "";

    // Hide search box while selected
    document.querySelector('.asset-search-box').style.display = 'none';

    if (window.lucide) lucide.createIcons();
}

function clearAssetSelection() {
    document.getElementById('issue-asset-id').value = "";
    document.getElementById('selected-asset-display').style.display = 'none';
    document.querySelector('.asset-search-box').style.display = 'flex';
    document.getElementById('asset-search').value = "";
    document.getElementById('asset-results-list').innerHTML = "";
}

// Student Details Page Logic
function initStudentDetails() {
    const params = new URLSearchParams(window.location.search);
    const studentId = parseInt(params.get('id'));
    const student = students.find(s => s.id === studentId);

    if (!student) {
        document.getElementById('student-bio-container').innerHTML = `<p style="text-align:center; padding:5rem; color:var(--text-muted);">Institutional error: Clinical identity not found.</p>`;
        return;
    }

    renderStudentBio(student);
    renderStudentHistoryTimeline(student);

    // Setup Detail Page Listeners
    const addRecordBtn = document.getElementById('add-record-btn');
    if (addRecordBtn) {
        addRecordBtn.addEventListener('click', () => openCreateRecordModal(student.id, student.name));
    }

    const manualReferralBtn = document.getElementById('manual-referral-btn');
    if (manualReferralBtn) {
        manualReferralBtn.addEventListener('click', () => generateReferral(student.id, true));
    }

    const generateReferralBtn = document.getElementById('generate-referral-btn');
    if (generateReferralBtn) {
        generateReferralBtn.addEventListener('click', () => generateReferral(student.id, false));
    }

    // Since we dynamicallly add records, we override the handleRecordSubmit locally
    const form = document.getElementById('record-form');
    if (form) {
        form.onsubmit = (e) => {
            handleRecordSubmit(e);
            // After submit, re-render the history
            setTimeout(() => renderStudentHistoryTimeline(student), 100);
        };
    }
}

function renderStudentBio(student) {
    const container = document.getElementById('student-bio-container');
    if (!container) return;

    container.innerHTML = `
        <div class="student-card glass sheen" style="flex-direction: row; gap: 3rem; align-items: center; padding: 3rem;">
            <img src="${makeAvatarDataUri(student.name)}" style="width:128px; height:128px; border-radius:32px; border:4px solid #fff; box-shadow:0 15px 30px rgba(0,0,0,0.1);">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:1rem; margin-bottom:0.5rem;">
                    <h1 style="font-family:'Outfit'; font-size:2.5rem; margin:0;">${student.name}</h1>
                    ${isAdmin() ? `
                        <button class="btn-icon-premium mini" onclick="openEditStudentModal(${student.id})" title="Edit Student Profile">
                            <i data-lucide="edit-2" size="18"></i>
                        </button>
                    ` : ""}
                    <span class="badge badge-success" style="padding:8px 16px;">ACTIVE ENROLLMENT</span>
                </div>
            <div style="display:flex; gap:2rem; margin-bottom:1.5rem;">
                <div class="data-point">
                    <span class="data-label">Blood Group</span>
                    <span class="data-value" style="font-size:1.1rem; color:var(--danger); font-weight:800;">${student.bloodGroup || 'N/A'}</span>
                </div>
                <div class="divider"></div>
                <div class="data-point">
                    <span class="data-label">Parent Contact</span>
                    <span class="data-value" style="font-size:1.1rem;">${student.parentContact || 'Not Set'}</span>
                </div>
                <div class="divider"></div>
                <div class="data-point" style="flex:1;">
                    <span class="data-label">Clinical Class</span>
                    <span class="data-value" style="font-size:1.1rem;">${student.class}</span>
                </div>
            </div>
            
            <div class="medical-alert-card glass" style="background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.1); padding:1rem; border-radius:16px; display:flex; align-items:center; gap:1rem;">
                <i data-lucide="alert-octagon" style="color:var(--danger);"></i>
                <div>
                    <span class="data-label" style="margin:0;">CRITICAL ALLERGIES / CONDITIONS</span>
                    <span class="data-value" style="font-size:1rem; display:block;">${student.allergies || 'None Reported'}</span>
                </div>
            </div>
        </div>
        <div style="text-align:right; min-width:120px;">
             <div class="data-point">
                <span class="data-label">Clinical Frequency</span>
                <span class="data-value" style="font-size:2.5rem; color:var(--primary); font-weight:800;">${student.prescriptions.length}</span>
                <span style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.1em; margin-top:0.5rem;">Interactions</span>
            </div>
        </div>
    </div>
    `;
}

function renderStudentHistoryTimeline(student, filterText = "") {
    const container = document.getElementById('student-history-timeline');
    if (!container) return;

    const lowerFilter = filterText.toLowerCase();
    const filteredPrescriptions = student.prescriptions.filter(p => {
        if (typeof p === 'string') return p.toLowerCase().includes(lowerFilter);
        return p.complaint.toLowerCase().includes(lowerFilter) ||
            (p.item && p.item.toLowerCase().includes(lowerFilter)) ||
            p.nurse.toLowerCase().includes(lowerFilter);
    });

    if (student.prescriptions.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:3rem; color:var(--text-muted);">No clinical history recorded for this student.</p>`;
        return;
    }

    container.innerHTML = `
        <h3 style="font-family:'Outfit'; margin-bottom:2rem; letter-spacing:0.1em; text-transform:uppercase; font-size:0.9rem; color:var(--text-muted);">Clinical Protocol Timeline</h3>
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
            ${filteredPrescriptions.map((p, idx) => {
        const originalIdx = student.prescriptions.indexOf(p);
        if (typeof p === 'string') {
            return `
                        <div class="med-chip-premium legacy glass" style="border-left:4px solid var(--text-muted);">
                            <div class="med-chip-header">
                                <span class="complaint">Legacy Treatment Documentation</span>
                                <span class="timestamp">HISTORICAL LOG</span>
                            </div>
                            <div class="med-chip-details">
                                <span class="med-issued">${p}</span>
                            </div>
                        </div>
                    `;
        } else {
            return `
                        <div class="med-chip-premium glass" style="border-left:4px solid var(--primary);">
                            <div class="med-chip-header">
                                <div class="chip-main">
                                    <i data-lucide="activity" size="18"></i>
                                    <span class="complaint" style="font-size:1.1rem;">${p.complaint}</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:1rem;">
                                    <span class="timestamp">${new Date(p.timestamp).toLocaleString()}</span>
                                    <button class="btn-icon-premium mini" onclick="openEditDetailPageRecord(${student.id}, ${originalIdx})">
                                        <i data-lucide="edit-3" size="14"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="med-chip-details">
                                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                                    <span class="med-issued" style="font-size:0.95rem; color:var(--text-main); font-weight:700;">
                                        Treatment: ${p.item ? p.item : 'Observation Recorded'}
                                    </span>
                                    ${p.quantity ? `<span style="font-size:0.8rem; color:var(--text-muted);">Dispensed: ${p.quantity} units</span>` : ''}
                                </div>
                                <span class="nurse-tag">
                                    <i data-lucide="user" size="12"></i>
                                    Authorized by ${p.nurse}
                                </span>
                            </div>
                        </div>
                    `;
        }
    }).join('') || '<p style="text-align:center; padding:2rem; color:var(--text-muted);">No records match your search protocol.</p>'}
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

function openEditDetailPageRecord(studentId, index) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    openEditRecordModal(studentId, index);

    // Override the form submit locally to handle re-render
    const form = document.getElementById('record-form');
    if (form) {
        form.onsubmit = (e) => {
            handleRecordSubmit(e);
            setTimeout(() => renderStudentHistoryTimeline(student), 100);
        };
    }
}

function openEditStudentModal(studentId) {
    if (!isAdmin()) {
        alert("Security protocol violation: Admin clearance required.");
        return;
    }
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // We'll create the modal dynamically or expect it in the DOM
    const modal = document.getElementById('edit-student-modal');
    if (!modal) {
        console.error("Edit student modal not found in DOM.");
        return;
    }

    document.getElementById('edit-student-id').value = student.id;
    document.getElementById('edit-student-name').value = student.name;
    document.getElementById('edit-student-class').value = student.class;
    document.getElementById('edit-student-dob').value = student.dob || "";
    document.getElementById('edit-student-admission').value = student.admissionNo;
    document.getElementById('edit-student-sickbay').value = student.sickbayNo;
    if (document.getElementById('edit-student-bloodgroup')) document.getElementById('edit-student-bloodgroup').value = student.bloodGroup || "N/A";
    if (document.getElementById('edit-student-contact')) document.getElementById('edit-student-contact').value = student.parentContact || "";
    if (document.getElementById('edit-student-allergies')) document.getElementById('edit-student-allergies').value = student.allergies || "";

    modal.style.display = 'flex';
}

function handleEditStudentSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) return;

    const studentId = parseInt(document.getElementById('edit-student-id').value);
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const newName = document.getElementById('edit-student-name').value;
    const newClass = document.getElementById('edit-student-class').value;
    const newDob = document.getElementById('edit-student-dob').value;
    const newAdmission = document.getElementById('edit-student-admission').value;
    const newSickbay = document.getElementById('edit-student-sickbay').value;
    const newBlood = document.getElementById('edit-student-bloodgroup')?.value || "N/A";
    const newContact = document.getElementById('edit-student-contact')?.value || "";
    const newAllergies = document.getElementById('edit-student-allergies')?.value || "None Reported";

    if (!isAdmissionNoUnique(newAdmission, studentId)) {
        alert("CONFLICT DETECTED: This Admission Number is registered to another student.");
        return;
    }

    if (!isSickbayNoUnique(newSickbay, studentId)) {
        alert("CONFLICT DETECTED: This Sickbay Number is already in use.");
        return;
    }

    student.name = newName;
    student.class = newClass;
    student.dob = newDob;
    student.admissionNo = newAdmission;
    student.sickbayNo = newSickbay.padStart(4, '0');
    student.bloodGroup = newBlood;
    student.parentContact = newContact;
    student.allergies = newAllergies;

    saveData();
    document.getElementById('edit-student-modal').style.display = 'none';

    // Re-render the bio part
    renderStudentBio(student);

    notifications.unshift({
        id: Date.now(),
        type: 'success',
        title: 'Identity Update Authorized',
        desc: `Profile for ${student.name} updated by Admin ${activeNurse.name}`,
        icon: 'user-check'
    });
    renderNotifications();

    if (window.lucide) lucide.createIcons();
}

init();

function initAdminPanel() {
    const loginForm = document.getElementById('admin-login-form');
    const accessPortal = document.getElementById('admin-access-portal');
    const adminInterface = document.getElementById('admin-interface');
    const errorMsg = document.getElementById('admin-error');

    if (isAdminMode) {
        if (accessPortal) accessPortal.style.display = 'none';
        if (adminInterface) adminInterface.style.display = 'block';
        renderAdminData();
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('admin-username').value;
            const pass = document.getElementById('admin-password').value;

            if (user === SUPER_ADMIN.key && pass === SUPER_ADMIN.phrase) {
                isAdminMode = true;
                sessionStorage.setItem('isAdminMode', 'true');
                if (accessPortal) accessPortal.style.display = 'none';
                if (adminInterface) adminInterface.style.display = 'block';
                renderAdminData();
            } else {
                if (errorMsg) errorMsg.style.display = 'block';
                setTimeout(() => { if (errorMsg) errorMsg.style.display = 'none'; }, 3000);
            }
        });
    }

    // Tab Switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.target);
            if (target) target.classList.add('active');
        });
    });

    // Logout
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('isAdminMode');
            window.location.reload();
        });
    }

    // Add Nurse Modal
    setupModalListeners('add-nurse-modal', 'close-add-nurse-modal', 'add-nurse-form', handleAddNurse);
    const addNurseBtn = document.getElementById('add-nurse-btn');
    if (addNurseBtn) addNurseBtn.addEventListener('click', () => openModal('add-nurse-modal'));

    // Audit History Modal Closure
    const closeAuditBtn = document.getElementById('close-audit-modal');
    if (closeAuditBtn) closeAuditBtn.addEventListener('click', () => {
        document.getElementById('audit-history-modal').style.display = 'none';
    });

    // Reset System Data
    const resetBtn = document.getElementById('reset-system-data');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm("CRITICAL WARNING: This will erase ALL clinical data, including records, inventory, and student profiles. Proceed with system wipe?")) {
                localStorage.clear();
                window.location.reload();
            }
        });
    }

    // Save System Settings
    const saveSettingsBtn = document.getElementById('save-sys-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const newName = document.getElementById('sys-inst-name').value;
            localStorage.setItem('sickbay_inst_name', newName);
            alert("Institutional Protocol Updated.");
        });
    }

    // Admin Security Credential Update
    const securityForm = document.getElementById('admin-security-form');
    if (securityForm) {
        securityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const oldKey = document.getElementById('old-master-key').value;
            const newKey = document.getElementById('new-master-key').value;
            const newPhrase = document.getElementById('new-security-phrase').value;

            if (updateAdminCredentials(oldKey, newKey, newPhrase)) {
                securityForm.reset();
            }
        });
    }
}

function renderAdminData() {
    const nurseList = document.getElementById('admin-nurses-list');
    const studentList = document.getElementById('admin-students-list');

    if (nurseList) {
        nurseList.innerHTML = nurses.map(n => `
            <tr>
                <td><strong>${n.id}</strong></td>
                <td>${n.name}</td>
                <td><span class="badge" style="background:rgba(0,0,0,0.05); color:var(--text-main);">${n.role}</span></td>
                <td>
                    <button class="btn-icon mini" onclick="viewNurseAudit('${n.name}')" title="Clinical Audit History">
                        <i data-lucide="history" size="16"></i>
                    </button>
                    <button class="btn-icon mini" onclick="deleteNurse('${n.id}')" title="Revoke Access">
                        <i data-lucide="trash-2" size="16"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    if (studentList) {
        studentList.innerHTML = students.map(s => `
            <tr>
                <td><strong>${s.admissionNo}</strong></td>
                <td>${s.name}</td>
                <td>${s.class}</td>
                <td>
                    <button class="btn-icon mini" onclick="window.location.href='student-details.html?id=${s.id}'" title="Full Breakdown Page">
                        <i data-lucide="external-link" size="16"></i>
                    </button>
                    <button class="btn-icon mini" onclick="viewStudentHistory(${s.id})" title="Quick History View">
                        <i data-lucide="eye" size="16"></i>
                    </button>
                    ${isAdmin() ? `<button class="btn-icon mini" onclick="deleteStudentAdmin(${s.id})" title="Purge Record"><i data-lucide="user-minus" size="16"></i></button>` : ''}
                </td>
            </tr>
        `).join('');
    }

    if (window.lucide) lucide.createIcons();
}

function handleAddNurse(e) {
    e.preventDefault();
    const id = document.getElementById('new-nurse-id').value;
    const name = document.getElementById('new-nurse-name').value;
    const pass = document.getElementById('new-nurse-pass').value;
    const role = document.getElementById('new-nurse-role').value;

    if (!isNurseIdUnique(id)) {
        alert("SECURITY ALERT: This Officer ID is already registered in the system.");
        return;
    }

    nurses.push({ id, name, pass, role });
    // Note: nurses isn't currently persisted in localStorage in the base code except for specific ones, 
    // but we'll simulate logic if needed or just keep it in memory for this session / update defaultNurses in code
    // Actually, let's persist it if we want it to be useful
    localStorage.setItem('sickbay_nurses', JSON.stringify(nurses));

    document.getElementById('add-nurse-modal').style.display = 'none';
    document.getElementById('add-nurse-form').reset();
    renderAdminData();

    notifications.unshift({
        id: Date.now(),
        type: 'success',
        title: 'Personnel Provisioned',
        desc: `${name} has been granted ${role} clearance.`,
        icon: 'user-plus'
    });
    saveData();
    renderNotifications();
}

function deleteNurse(id) {
    if (confirm(`Revoke all access privileges for Officer ${id}?`)) {
        nurses = nurses.filter(n => n.id !== id);
        localStorage.setItem('sickbay_nurses', JSON.stringify(nurses));
        renderAdminData();
    }
}

function deleteStudentAdmin(id) {
    if (confirm("Permanently purge this student record and all associated clinical history?")) {
        students = students.filter(s => s.id !== id);
        saveData();
        renderAdminData();
    }
}

function viewNurseAudit(nurseName) {
    const modal = document.getElementById('audit-history-modal');
    const content = document.getElementById('audit-history-content');
    const title = document.getElementById('audit-title');
    const subtitle = document.getElementById('audit-subtitle');

    if (!modal || !content) return;

    title.textContent = "Clinical Audit History";
    subtitle.textContent = `Authorized protocols for Officer: ${nurseName}`;

    // Collect all records where nurse matches
    let auditLogs = [];
    students.forEach(student => {
        student.prescriptions.forEach(p => {
            if (typeof p !== 'string' && p.nurse === nurseName) {
                auditLogs.push({ ...p, studentName: student.name });
            }
        });
    });

    // Sort by time
    auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (auditLogs.length === 0) {
        content.innerHTML = `<p style="text-align:center; padding:3rem; color:var(--text-muted);">No clinical interactions found under this officer's authorization.</p>`;
    } else {
        content.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:1rem;">
                ${auditLogs.map(log => `
                    <div class="glass" style="padding:1.25rem; border-radius:16px; border-left:4px solid var(--primary);">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <span style="font-weight:700;">${log.complaint}</span>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">
                            Patient: <strong style="color:var(--text-main);">${log.studentName}</strong>
                        </div>
                        <div style="font-size:0.85rem;">
                            Treatment: <span style="font-weight:600;">${log.item || 'Observation'}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function viewStudentHistory(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const modal = document.getElementById('audit-history-modal');
    const content = document.getElementById('audit-history-content');
    const title = document.getElementById('audit-title');
    const subtitle = document.getElementById('audit-subtitle');

    if (!modal || !content) return;

    title.textContent = `Medical History: ${student.name}`;
    subtitle.textContent = `${student.class} | ADM: ${student.admissionNo}`;

    if (student.prescriptions.length === 0) {
        content.innerHTML = `<p style="text-align:center; padding:3rem; color:var(--text-muted);">No clinical history recorded.</p>`;
    } else {
        content.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:1rem;">
                ${student.prescriptions.map(p => {
            if (typeof p === 'string') {
                return `<div class="glass" style="padding:1rem; border-radius:12px; border-left:4px solid var(--text-muted);">${p}</div>`;
            }
            return `
                        <div class="glass" style="padding:1.25rem; border-radius:16px; border-left:4px solid var(--primary);">
                             <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                                <span style="font-weight:700;">${p.complaint}</span>
                                <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(p.timestamp).toLocaleString()}</span>
                            </div>
                            <div style="font-size:0.85rem;">
                                Treatment: <span style="font-weight:600;">${p.item || 'Observation'}</span>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.5rem;">
                                Authorized by Nurse ${p.nurse}
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function renderMedicationMonitor() {
    const list = document.getElementById('active-medication-list');
    if (!list) return;

    // Define "Active" as anyone treated with a drug in the last 12 hours
    const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);

    const activeTreatments = [];
    students.forEach(student => {
        student.prescriptions.forEach(p => {
            if (typeof p !== 'string' && p.timestamp && !p.completed) {
                const ts = new Date(p.timestamp).getTime();
                if (ts > twelveHoursAgo && p.item && p.item.toLowerCase() !== 'observation') {
                    activeTreatments.push({ student, prescription: p });
                }
            }
        });
    });

    if (activeTreatments.length === 0) {
        list.innerHTML = `
            <div class="placeholder-card" style="text-align:center; padding:3rem; color:var(--text-muted); grid-column: 1/-1;">
                <p>No active medication protocols detected for the current shift.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = activeTreatments.map(({ student, prescription }) => {
        const timeElapsed = Math.round((Date.now() - new Date(prescription.timestamp).getTime()) / (60 * 60 * 1000));
        const progress = Math.min(100, (timeElapsed / 12) * 100);

        return `
            <div class="med-monitor-card glass sheen" style="padding:1.5rem; border-radius:20px; display:flex; flex-direction:column; gap:1rem; background:#ffffff !important; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h4 style="margin:0; font-size:1rem;">${student.name}</h4>
                        <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">${student.class}</p>
                    </div>
                    <div style="background:rgba(16, 185, 129, 0.1); color:var(--success); padding:4px 8px; border-radius:8px; font-size:0.7rem; font-weight:800;">
                        ACTIVE
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <i data-lucide="pill" style="color:var(--primary); width:16px;"></i>
                    <span style="font-weight:700; font-size:0.9rem;">${prescription.item}</span>
                </div>
                <div class="progress-container" style="height:6px; background:#f1f5f9; border-radius:10px; overflow:hidden;">
                    <div class="progress-bar" style="width:${progress}%; height:100%; background:linear-gradient(90deg, var(--primary), var(--secondary)); transition: width 1s ease;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.75rem; color:var(--text-muted);">Shift Protocol</span>
                    <button class="btn-icon-premium mini success" style="padding:4px 10px; font-size:0.7rem;" onclick="markMedicationComplete(${student.id}, '${prescription.timestamp}')">
                        <i data-lucide="check-circle" size="14"></i> COMPLETE
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function markMedicationComplete(studentId, timestamp) {
    const student = students.find(s => s.id === studentId);
    if (student) {
        const p = student.prescriptions.find(p => p.timestamp === timestamp);
        if (p) {
            p.completed = true;
            p.completedAt = new Date().toISOString();
        }
    }

    notifications.unshift({
        id: Date.now(),
        type: 'success',
        title: 'Medication Task Finalized',
        desc: `Shift protocol for ${student ? student.name : 'Student'} has been closed and removed from active monitor.`,
        icon: 'check-square',
        read: false
    });
    saveData();
    renderNotifications();
    updateUnreadCount();
    renderMedicationMonitor();
}

function updateAdminCredentials(oldKey, newKey, newPhrase) {
    if (oldKey !== SUPER_ADMIN.key) {
        alert("SECURITY PROTOCOL DENIED: Previous Master Key is incorrect.");
        return false;
    }

    SUPER_ADMIN.key = newKey;
    SUPER_ADMIN.phrase = newPhrase;
    localStorage.setItem('sickbay_admin_protocol', JSON.stringify(SUPER_ADMIN));
    alert("System Administration Protocol Updated Successfully.");
    return true;
}
function toggleRecordExpansion(studentId) {
    const blocks = document.querySelectorAll('.record-student-block');
    blocks.forEach(block => {
        if (block.dataset.studentId == studentId) {
            block.classList.toggle('compact');
            block.classList.toggle('expanded');
        }
    });
}

function markNotifChecked(id) {
    const notif = notifications.find(n => n.id === id);
    if (notif) {
        notif.read = true;
        saveData();
        updateUnreadCount();
        setupNotificationUI(); // Re-trigger modal content update if we're in modal
        // Ideally we just re-render the modal content but for now this works if we re-open or if we manually refresh modal innerHTML
        // Let's manually refresh modal innerHTML
        notificationBell.dispatchEvent(new Event('dblclick'));
        // dispatcher won't work easily due to the lastClick logic. 
        // Let's just update the UI manually here.
        const items = document.querySelectorAll('.notification-item');
        renderNotifications();
    }
}
// Unified Falling Medical Assets Architecture

/* -----------------------------
   AI Assistant (offline + online)
   ----------------------------- */
function setupAIAssistant() {
    const openBtn = document.getElementById('open-ai-assistant-btn') || document.getElementById('ai-assistant-tab');
    const panel = document.getElementById('ai-assistant-panel');
    const closeBtn = document.getElementById('close-ai-assistant-btn');
    const tabClose = document.getElementById('ai-tab-close');
    const saveKeyBtn = document.getElementById('ai-save-key-btn');
    const sendBtn = document.getElementById('ai-send-btn');
    const apiKeyInput = document.getElementById('ai-api-key');
    const queryInput = document.getElementById('ai-query');
    const messagesEl = document.getElementById('ai-messages');
    const statusEl = document.getElementById('ai-assistant-status');

    if (!openBtn || !panel || !messagesEl) return;

    function getAIStatus() {
        const key = localStorage.getItem('sickbay_gemini_key') || localStorage.getItem('sickbay_ai_key') || normalizeAIKey(apiKeyInput && apiKeyInput.value);
        const online = navigator.onLine;
        if (online && key) return { text: 'Gemini Online', color: 'var(--success)', title: 'Internet is available and Gemini is ready for live answers' };
        if (online && !key) return { text: 'Online (offline fallback)', color: 'var(--warning)', title: 'Internet is available, but a Gemini API key is needed for live answers' };
        return { text: 'Offline', color: 'var(--danger)', title: 'No internet connection; the assistant is using local answers only' };
    }

    function updateAIStatus() {
        if (!statusEl) return;
        const status = getAIStatus();
        statusEl.textContent = status.text;
        statusEl.style.background = status.color;
        statusEl.title = status.title;
    }

    function normalizeAIKey(value) {
        const key = (value || '').trim();
        if (!key) return '';
        const bearerMatch = key.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) return bearerMatch[1].trim();
        const queryMatch = key.match(/[?&]key=([^&#\s]+)/i);
        if (queryMatch) return decodeURIComponent(queryMatch[1]).trim();
        return key.replace(/\s+/g, '');
    }

    // Respect user disabled setting: if assistant disabled, hide the tab and don't initialize
    if (localStorage.getItem('sickbay_ai_disabled') === 'true') {
        if (openBtn) openBtn.style.display = 'none';
        return;
    }

    // Populate saved key if present
    if (apiKeyInput) apiKeyInput.value = normalizeAIKey(localStorage.getItem('sickbay_gemini_key') || localStorage.getItem('sickbay_ai_key') || '');
    updateAIStatus();

    const panelShell = panel.firstElementChild;
    const headerRow = panelShell && panelShell.firstElementChild;
    const titleBlock = headerRow && headerRow.firstElementChild;
    const actionBlock = headerRow && headerRow.lastElementChild;
    const bodyBlock = panelShell && panelShell.querySelector('#ai-assistant-body');
    const queryRow = bodyBlock && bodyBlock.lastElementChild;

    if (panelShell) {
        panelShell.style.display = 'flex';
        panelShell.style.flexDirection = 'column';
        panelShell.style.height = '100%';
        panelShell.style.gap = '0.5rem';
    }

    if (headerRow) {
        headerRow.style.display = 'flex';
        headerRow.style.flexDirection = 'column';
        headerRow.style.alignItems = 'stretch';
        headerRow.style.gap = '0.45rem';
        headerRow.style.width = '100%';
    }

    if (titleBlock) titleBlock.style.width = '100%';

    if (actionBlock) {
        actionBlock.style.display = 'flex';
        actionBlock.style.flexDirection = 'column';
        actionBlock.style.alignItems = 'stretch';
        actionBlock.style.width = '100%';
        actionBlock.style.gap = '0.35rem';
    }

    if (bodyBlock) {
        bodyBlock.style.display = 'flex';
        bodyBlock.style.flexDirection = 'column';
        bodyBlock.style.gap = '0.5rem';
        bodyBlock.style.flex = '1';
        bodyBlock.style.minHeight = '0';
    }

    if (queryRow) {
        queryRow.style.display = 'flex';
        queryRow.style.flexDirection = 'column';
        queryRow.style.alignItems = 'stretch';
        queryRow.style.gap = '0.35rem';
        queryRow.style.width = '100%';
        queryRow.style.marginTop = '0.35rem';
    }

    if (apiKeyInput) {
        apiKeyInput.style.width = '100%';
        apiKeyInput.style.boxSizing = 'border-box';
    }

    if (apiKeyInput && !document.getElementById('ai-key-helper-note')) {
        const helperNote = document.createElement('div');
        helperNote.id = 'ai-key-helper-note';
        helperNote.className = 'ai-key-helper-note';
        helperNote.textContent = 'Paste your key here after creating it.';
        apiKeyInput.insertAdjacentElement('afterend', helperNote);
    }

    const actionStack = document.getElementById('ai-key-action-stack') || (() => {
        if (!saveKeyBtn) return null;
        const stack = document.createElement('div');
        stack.id = 'ai-key-action-stack';
        stack.className = 'ai-key-action-stack';
        saveKeyBtn.insertAdjacentElement('afterend', stack);
        stack.appendChild(saveKeyBtn);
        return stack;
    })();

    const createKeyBtn = document.getElementById('create-ai-key-btn') || (() => {
        if (!actionStack) return null;
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'create-ai-key-btn';
        button.className = 'btn-secondary mini';
        button.innerHTML = '<i data-lucide="external-link"></i><span>Create API key</span>';
        button.title = 'Open the official Gemini API key page';
        button.setAttribute('aria-label', 'Create Gemini API key');
        actionStack.appendChild(button);
        if (window.lucide) lucide.createIcons();
        return button;
    })();

    if (saveKeyBtn) saveKeyBtn.style.width = '100%';

    const closeActionBtn = document.getElementById('close-ai-panel-action-btn') || (() => {
        if (!actionStack || !closeBtn) return null;
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'close-ai-panel-action-btn';
        button.className = 'btn-secondary mini';
        button.innerHTML = '<i data-lucide="x"></i><span>Close</span>';
        button.title = 'Close the AI panel';
        button.setAttribute('aria-label', 'Close AI panel');
        actionStack.appendChild(button);
        if (window.lucide) lucide.createIcons();
        return button;
    })();

    if (createKeyBtn) createKeyBtn.style.width = '100%';
    if (closeActionBtn) closeActionBtn.style.width = '100%';
    if (sendBtn) sendBtn.style.width = '100%';

    if (createKeyBtn && !createKeyBtn.dataset.bound) {
        createKeyBtn.dataset.bound = 'true';
        createKeyBtn.addEventListener('click', () => {
            window.open('https://aistudio.google.com/apikey', '_blank', 'noopener,noreferrer');
        });
    }

    if (closeActionBtn && !closeActionBtn.dataset.bound) {
        closeActionBtn.dataset.bound = 'true';
        closeActionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closePanel();
        });
    }

    function openPanel() {
        panel.style.transform = 'translateX(0)';
        panel.setAttribute('aria-hidden', 'false');
        if (openBtn) openBtn.style.opacity = '0';
        if (queryInput) queryInput.focus();
    }

    function closePanel() {
        panel.style.transform = 'translateX(110%)';
        panel.setAttribute('aria-hidden', 'true');
        if (openBtn) openBtn.style.opacity = '1';
    }

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hidden = panel.getAttribute('aria-hidden') === 'true' || panel.style.transform.includes('110%');
        if (hidden) openPanel(); else closePanel();
    });

    // Close/disable assistant completely (user toggle)
    if (tabClose) tabClose.addEventListener('click', (e) => {
        e.stopPropagation();
        // hide tab and panel, mark disabled
        if (openBtn) openBtn.style.display = 'none';
        if (panel) { panel.style.transform = 'translateX(110%)'; panel.setAttribute('aria-hidden','true'); }
        localStorage.setItem('sickbay_ai_disabled', 'true');
    });

    closeBtn && closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closePanel();
    });

    saveKeyBtn && saveKeyBtn.addEventListener('click', () => {
        if (!apiKeyInput) return;
        const key = normalizeAIKey(apiKeyInput.value);
        if (!key) {
            localStorage.removeItem('sickbay_gemini_key');
            localStorage.removeItem('sickbay_ai_key');
            updateAIStatus();
            alert('Gemini key cleared. The assistant will fall back to offline answers.');
            return;
        }
        localStorage.setItem('sickbay_gemini_key', key);
        localStorage.setItem('sickbay_ai_key', key);
        updateAIStatus();
        apiKeyInput.value = key;
        alert('Gemini key saved locally. Live answers will use Gemini when online.');
    });

    window.addEventListener('online', updateAIStatus);
    window.addEventListener('offline', updateAIStatus);
    apiKeyInput && apiKeyInput.addEventListener('input', updateAIStatus);

    sendBtn && sendBtn.addEventListener('click', () => handleAISend());

    queryInput && queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendBtn && sendBtn.click(); }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel.getAttribute('aria-hidden') === 'false') {
            closePanel();
        }
    });

    function escapeHtml(s) { return (s+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    function renderMessage(who, text) {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '0.6rem';
        wrapper.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(who)}</div><div style="background:rgba(255,255,255,0.6); padding:0.6rem; border-radius:8px; margin-top:4px; color:var(--text-main); white-space:pre-wrap;">${escapeHtml(text)}</div>`;
        messagesEl.appendChild(wrapper);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function handleAISend() {
        const q = (queryInput && queryInput.value || '').trim();
        if (!q) return;
        renderMessage('You', q);
        if (queryInput) queryInput.value = '';

        const key = localStorage.getItem('sickbay_ai_key') || normalizeAIKey(apiKeyInput && apiKeyInput.value);
        const onlineAvailable = navigator.onLine && Boolean(key);

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'SENDING...';
        }

        renderMessage('Assistant', onlineAvailable ? 'Online assistant activating...' : 'Offline assistant activating...');

        try {
            let reply;
            if (onlineAvailable) {
                try {
                    reply = await onlineAssistantQuery(key, q);
                } catch (err) {
                    console.warn('Online assistant error, falling back to local:', err);
                    reply = await localAssistantQuery(q);
                }
            } else {
                reply = await localAssistantQuery(q);
            }

            const last = messagesEl.lastElementChild;
            if (last && last.textContent && last.textContent.includes('activating')) {
                last.remove();
            }

            renderMessage('Assistant', reply);
        } catch (err) {
            renderMessage('Assistant', 'An unexpected error occurred while processing your request.');
            console.error(err);
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
            }
        }
    }

    async function localAssistantQuery(query) {
        const q = query.toLowerCase().trim();
        const now = new Date();
        const timeLabel = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const results = [];

        // Quick inventory lookup
        const invMatches = items.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
        if (invMatches.length) {
            results.push('Local inventory matches:\n' + invMatches.map(i => `• ${i.name} — ${i.quantity} units (exp: ${i.expiry || 'N/A'})`).join('\n'));
        }

        // Student lookup
        const studentMatches = students.filter(s => s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q));
        if (studentMatches.length) {
            results.push('Student matches:\n' + studentMatches.map(s => `• ${s.name} — ${s.class} — ADM:${s.admissionNo}`).join('\n'));
        }

        // Nurse / protocol lookup
        const nurseMatches = nurses.filter(n => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q));
        if (nurseMatches.length) {
            results.push('Personnel matches:\n' + nurseMatches.map(n => `• ${n.name} — ${n.role} (ID: ${n.id})`).join('\n'));
        }

        // Built-in drug info for common items
        const drugInfo = {
            'regenerative paracetamol': 'Regenerative Paracetamol — analgesic/antipyretic. Typical pediatric dosing guidance varies by formulation; consult local protocol. (This is informational, not medical advice).',
            'neural pain blockers': 'Neural Pain Blockers — advanced analgesic category; dosing and contraindications depend on formulation. Refer to medical reference or enable online mode for details.',
            'cetirizine': 'Cetirizine 10mg — antihistamine commonly used for allergic symptoms. Standard dosing typically 10mg once daily for adults; pediatric dosing differs.',
            'quantum gauze nano-pads': 'Quantum Gauze Nano-Pads — advanced bandage. No systemic dosing; use per wound care protocol.'
        };
        Object.keys(drugInfo).forEach(k => {
            if (q.includes(k) || k.includes(q)) results.push(`Drug info: ${drugInfo[k]}`);
        });

        const generalKnowledge = {
            'what is sickbay': 'A sickbay is a medical triage and care area for students and staff; it stores clinical supplies and tracks treatment. It is the central first-aid point for school health services.',
            'what is a prescription': 'A prescription is a written instruction from a clinician for medication or treatment. Follow the prescribed dose and timing carefully.',
            'what is paracetamol': 'Paracetamol is an analgesic and antipyretic commonly used for pain relief and fever reduction. Dosing depends on age and protocol.',
            'how to handle a medical emergency': 'In a medical emergency, ensure the scene is safe, assess airway, breathing, and circulation, and call for help immediately before providing first aid.',
            'what are side effects': 'Side effects differ per medication; monitor the patient closely and consult clinical guidelines for contraindications and adverse reactions.'
        };
        Object.keys(generalKnowledge).forEach(k => {
            if (q.includes(k) || k.includes(q)) results.push(generalKnowledge[k]);
        });

        if (results.length === 0) {
            return `Offline assistant (local mode):\nI can help with inventory, student records, staff info, and general sickbay guidance. I do not have live internet access right now. For fuller answers on any question, paste a Gemini API key in the box above and I will switch to live Gemini mode.\n\nCurrent time: ${timeLabel}`;
        }

        return results.join('\n\n');
    }

    async function onlineAssistantQuery(key, query) {
        const inventorySummary = items.slice(0, 10).map(i => `${i.name} (${i.quantity} units, expiry ${i.expiry || 'N/A'})`).join('; ');
        const studentSummary = students.slice(0, 10).map(s => `${s.name} (${s.class}, ADM:${s.admissionNo})`).join('; ');
        const systemPrompt = `You are a helpful sickbay assistant for a school clinic. Use the local context below when relevant, but answer in a natural, clear way. Do not give dangerous medical instructions. If the user asks for dosing or treatment, include a safety disclaimer and advise consulting the school nurse or clinician. Local inventory: ${inventorySummary}. Local students: ${studentSummary}.`;

        const body = {
            contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser question: ${query}` }] }
            ],
            generationConfig: {
                temperature: 0.25,
                topP: 0.9,
                maxOutputTokens: 700
            }
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${encodeURIComponent(key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(`Gemini API error: ${resp.status} ${txt}`);
            }

            const data = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
            return text || 'No answer returned from Gemini.';
        } catch (err) {
            clearTimeout(timeout);
            throw new Error('Live assistant request failed. Check your Gemini API key and internet connection, then try again.');
        }
    }
    // Ensure icons render if lucide is present
    if (window.lucide) setTimeout(() => lucide.createIcons(), 80);
}

function initFallingAssets(containerId = 'falling-container') {
    const container = document.getElementById(containerId);
    const icons = ['pill', 'heart', 'plus-circle', 'activity', 'thermometer', 'syringe'];
    if (!container) return;

    function createAsset() {
        if (!container || document.visibilityState !== 'visible') return;
        const asset = document.createElement('div');
        asset.className = 'medical-asset';
        const iconName = icons[Math.floor(Math.random() * icons.length)];

        const iconEl = document.createElement('i');
        iconEl.setAttribute('data-lucide', iconName);
        asset.appendChild(iconEl);

        const startX = Math.random() * window.innerWidth;
        const size = 15 + Math.random() * 35;
        const duration = 12 + Math.random() * 18;

        Object.assign(asset.style, {
            left: startX + 'px',
            fontSize: size + 'px',
            animationDuration: duration + 's',
            position: 'absolute',
            color: 'var(--primary)',
            opacity: '0',
            animation: 'fall linear infinite',
            pointerEvents: 'none',
            zIndex: '0'
        });

        container.appendChild(asset);
        scheduleLucideCreate();

        setTimeout(() => {
            if (asset.parentNode) asset.remove();
        }, duration * 1000);
    }

    // Initial burst
    for (let i = 0; i < 10; i++) setTimeout(createAsset, i * 300);
    // Continuous generation (reduced frequency for performance)
    setInterval(createAsset, 5000);
}

// Initialize on load if container exists
document.addEventListener('DOMContentLoaded', () => {
    initFallingAssets('falling-container');
    initFallingAssets('falling-container-overlay');
});
