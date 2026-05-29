// =============================================
// app.js — No.1 Delivery Shared Foundation
// Load this file on every page
// =============================================

// ---- CONFIGURATION ----
const SUPABASE_URL = 'https://mnhwcuawsdxeyzqkjdwq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uaHdjdWF3c2R4ZXl6cWtqZHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMjM1ODksImV4cCI6MjA5NTU5OTU4OX0.ALToJk7zpFYRLZPwoAN7d8EHsU6AE0wNKfNxVCoS_tk';

// ---- SUPABASE CLIENT ----
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- CURRENT USER (populated by initApp) ----
window.App = {
  user: null,       // Supabase auth user
  staff: null,      // Staff record from DB
  role: null,       // Role string
  branchId: null,   // Branch UUID
  staffId: null,    // Staff UUID
  branchName: null, // Branch display name
};

// ---- ROLE DEFINITIONS ----
const ROLES = {
  super_admin:      { label: 'Super Admin',       color: '#00479f' },
  branch_manager:   { label: 'Branch Manager',    color: '#4b7fb9' },
  planner:          { label: 'Planner',           color: '#0e7490' },
  driver:           { label: 'Driver',            color: '#5b21b6' },
  picker:           { label: 'Picker / Loader',   color: '#8a5a00' },
  branch_requester: { label: 'Branch Requester',  color: '#b91c1c' },
};

// Pages each role can access
const ROLE_ROUTES = {
  super_admin:      'dashboard.html',
  branch_manager:   'dashboard.html',
  planner:          'dashboard.html',
  driver:           'driver.html',
  picker:           'picker.html',
  branch_requester: 'request.html',
};

// ---- STATUS DEFINITIONS ----
const JOB_STATUSES = {
  unpicked:  { label: 'Unpicked',  color: '#a3a4a4', bg: '#f0f4f8' },
  picked:    { label: 'Picked',    color: '#8a5a00', bg: '#fef3dc' },
  loaded:    { label: 'Loaded',    color: '#0e7490', bg: '#ecfeff' },
  departed:  { label: 'Departed',  color: '#5b21b6', bg: '#f5f3ff' },
  arrived:   { label: 'Arrived',   color: '#00479f', bg: '#e5ebef' },
  delivered: { label: 'Delivered', color: '#1a7a4a', bg: '#e8f5ee' },
};

const STATUS_NEXT = {
  unpicked:  'picked',
  picked:    'loaded',
  loaded:    'departed',
  departed:  'arrived',
  arrived:   'delivered',
};

const JOB_TYPES = {
  standard: { label: 'Standard',       color: '#565656', bg: '#f0f4f8',  icon: '📦' },
  priority: { label: 'Priority 7am',   color: '#8a5a00', bg: '#fef3dc',  icon: '⚡' },
  recovery: { label: 'Recovery',       color: '#b91c1c', bg: '#fef2f2',  icon: '🔴' },
  shed:     { label: 'Shed',           color: '#0e7490', bg: '#ecfeff',  icon: '🏠' },
};

const RUN_SLOTS = ['1st', '2nd', '3rd', '4th', '5th', 'unassigned'];
const REGIONS   = [
  { value: 'sydney-metro',  label: 'Sydney Metro' },
  { value: 'regional-nsw',  label: 'Regional NSW' },
  { value: 'act',           label: 'ACT' },
];

// ---- INIT APP ----
// Call this at the top of every page
// Pass allowedRoles array to restrict access e.g. ['super_admin','branch_manager','planner']
// Pass null to allow any authenticated role
async function initApp(allowedRoles = null) {
  try {
    // Check Supabase auth session
    const { data: { session } } = await sb.auth.getSession();
    const pinAuth = sessionStorage.getItem('pin_auth');

    if (!session && !pinAuth) {
      window.location.href = 'login.html';
      return false;
    }

    let staffRecord = null;

    if (session) {
      // Email login — fetch staff record from DB
      const { data, error } = await sb
        .from('staff')
        .select('id, name, role, branch_id, active, email, phone')
        .eq('auth_user_id', session.user.id)
        .single();

      if (error || !data) {
        await sb.auth.signOut();
        window.location.href = 'login.html';
        return false;
      }
      staffRecord = data;
    } else {
      // PIN login — get from sessionStorage
      const staffId = sessionStorage.getItem('staff_id');
      if (staffId) {
        const { data } = await sb
          .from('staff')
          .select('id, name, role, branch_id, active, email, phone')
          .eq('id', staffId)
          .single();
        staffRecord = data;
      }
    }

    if (!staffRecord || !staffRecord.active) {
      sessionStorage.clear();
      window.location.href = 'login.html';
      return false;
    }

    // Check role access
    if (allowedRoles && !allowedRoles.includes(staffRecord.role)) {
      window.location.href = ROLE_ROUTES[staffRecord.role] || 'login.html';
      return false;
    }

    // Populate global App object
    App.user    = session?.user || null;
    App.staff   = staffRecord;
    App.role    = staffRecord.role;
    App.branchId = staffRecord.branch_id;
    App.staffId  = staffRecord.id;

    // Store in sessionStorage for faster subsequent loads
    sessionStorage.setItem('staff_role', staffRecord.role);
    sessionStorage.setItem('staff_name', staffRecord.name);
    sessionStorage.setItem('staff_id',   staffRecord.id);
    sessionStorage.setItem('branch_id',  staffRecord.branch_id);

    // Fetch branch name
    if (staffRecord.branch_id) {
      const { data: branch } = await sb
        .from('branches')
        .select('name')
        .eq('id', staffRecord.branch_id)
        .single();
      App.branchName = branch?.name || 'No.1 Delivery';
    }

    // Render topbar if element exists
    renderTopbar();

    return true;

  } catch (err) {
    console.error('initApp error:', err);
    window.location.href = 'login.html';
    return false;
  }
}

// ---- SIGN OUT ----
async function signOut() {
  await sb.auth.signOut();
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// ---- TOPBAR ----
function renderTopbar(activePage = '') {
  const el = document.getElementById('topbar');
  if (!el) return;

  const role = App.role;
  const name = App.staff?.name || '';
  const branch = App.branchName || 'No.1 Delivery';

  // Nav items visible to office/manager roles
  const officeNav = ['super_admin', 'branch_manager', 'planner'].includes(role);

  el.innerHTML = `
    <div class="topbar-brand">
      <div class="brand-name">No.1 Delivery</div>
      <div class="brand-branch">${branch}</div>
    </div>
    ${officeNav ? `
    <div class="topbar-nav">
      <a href="dashboard.html" class="nav-item ${activePage==='dashboard'?'active':''}">Dashboard</a>
      <a href="jobs.html"      class="nav-item ${activePage==='jobs'?'active':''}">
        Jobs <span class="nav-badge" id="jobs-badge" style="display:none"></span>
      </a>
      <a href="runs.html"      class="nav-item ${activePage==='runs'?'active':''}">Runs</a>
      <a href="calendar.html"  class="nav-item ${activePage==='calendar'?'active':''}">Calendar</a>
      ${role === 'super_admin' || role === 'branch_manager' ? `
      <a href="requests-admin.html" class="nav-item ${activePage==='requests'?'active':''}">Requests <span class="nav-badge" id="requests-badge" style="display:none"></span></a>
      <a href="fleet.html"     class="nav-item ${activePage==='fleet'?'active':''}">Fleet</a>
      <a href="staff-mgmt.html" class="nav-item ${activePage==='staff'?'active':''}">Staff</a>
      ` : ''}
    </div>` : ''}
    <div class="topbar-right">
      <div class="topbar-staff">
        <div class="topbar-staff-name">${name}</div>
        <div class="topbar-staff-role">${ROLES[role]?.label || role}</div>
      </div>
      <button class="topbar-signout" onclick="signOut()">Sign out</button>
    </div>
  `;

  // Load unread notification count
  loadJobsBadge();
}

async function loadJobsBadge() {
  const el = document.getElementById('jobs-badge');
  if (el) {
    const { count } = await sb.from('jobs')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'delivered');
    if (count > 0) { el.textContent = count; el.style.display = 'inline-flex'; }
  }
  const rb = document.getElementById('requests-badge');
  if (rb) {
    const { count } = await sb.from('branch_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (count > 0) { rb.textContent = count; rb.style.display = 'inline-flex'; }
  }
}

// ---- SHARED CSS ----
// Injects topbar + shared styles into any page that loads app.js
function injectSharedStyles() {
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --brand:#00479f; --brand-mid:#4b7fb9; --brand-light:#79a1cb;
      --brand-pale:#b4cbe1; --brand-surface:#e5ebef;
      --bg:#f0f4f8; --surface:#ffffff; --border:#b4cbe1; --border2:#79a1cb;
      --text:#1a1a2e; --text2:#565656; --text3:#a3a4a4;
      --green:#1a7a4a; --green-bg:#e8f5ee; --green-border:#7ec8a0;
      --amber:#8a5a00; --amber-bg:#fef3dc; --amber-border:#f0b429;
      --red:#b91c1c; --red-bg:#fef2f2; --red-border:#fca5a5;
      --purple:#5b21b6; --purple-bg:#f5f3ff; --purple-border:#c4b5fd;
      --teal:#0e7490; --teal-bg:#ecfeff; --teal-border:#67e8f9;
      --radius:8px; --radius-lg:12px; --radius-xl:16px;
      --font:'DM Sans',system-ui,sans-serif; --mono:'DM Mono',monospace;
    }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:var(--bg); color:var(--text); font-family:var(--font); font-size:14px; min-height:100vh; }
    a { text-decoration:none; }

    /* TOPBAR */
    #topbar { background:var(--brand); padding:0 24px; display:flex; align-items:center; height:56px; position:sticky; top:0; z-index:100; gap:0; overflow-x:auto; }
    .topbar-brand { display:flex; flex-direction:column; margin-right:28px; flex-shrink:0; }
    .brand-name { font-size:15px; font-weight:700; color:#fff; letter-spacing:-.2px; }
    .brand-branch { font-size:10px; color:rgba(255,255,255,.6); margin-top:1px; }
    .topbar-nav { display:flex; height:56px; align-items:stretch; flex:1; }
    .nav-item { display:flex; align-items:center; padding:0 14px; font-size:13px; font-weight:500; color:rgba(255,255,255,.65); border-bottom:2px solid transparent; cursor:pointer; transition:all .15s; white-space:nowrap; gap:5px; }
    .nav-item:hover { color:#fff; }
    .nav-item.active { color:#fff; border-bottom-color:#fff; }
    .nav-badge { background:#b91c1c; color:#fff; border-radius:20px; min-width:18px; height:18px; font-size:10px; font-weight:700; padding:0 5px; display:inline-flex; align-items:center; justify-content:center; }
    .topbar-right { margin-left:auto; display:flex; align-items:center; gap:12px; flex-shrink:0; }
    .topbar-staff { text-align:right; }
    .topbar-staff-name { font-size:12px; font-weight:600; color:#fff; }
    .topbar-staff-role { font-size:10px; color:rgba(255,255,255,.6); margin-top:1px; }
    .topbar-signout { background:rgba(255,255,255,.15); border:none; border-radius:6px; color:#fff; font-size:11px; font-weight:500; padding:5px 12px; cursor:pointer; font-family:var(--font); white-space:nowrap; }
    .topbar-signout:hover { background:rgba(255,255,255,.25); }

    /* PAGE WRAPPER */
    .page-wrap { padding:20px 24px; max-width:1400px; margin:0 auto; }

    /* CARDS */
    .card { background:var(--surface); border:0.5px solid var(--border); border-radius:var(--radius-lg); padding:20px; }
    .card-sm { padding:14px 16px; }

    /* BUTTONS */
    .btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:var(--radius); font-family:var(--font); font-size:13px; font-weight:500; cursor:pointer; border:0.5px solid; transition:all .15s; }
    .btn-primary { background:var(--brand); color:#fff; border-color:var(--brand); }
    .btn-primary:hover { background:#003a85; border-color:#003a85; }
    .btn-ghost { background:transparent; color:var(--text2); border-color:var(--border); }
    .btn-ghost:hover { border-color:var(--brand); color:var(--brand); }
    .btn-danger { background:transparent; color:var(--red); border-color:var(--red-border); }
    .btn-danger:hover { background:var(--red-bg); }
    .btn-amber { background:transparent; color:var(--amber); border-color:var(--amber-border); }
    .btn-amber:hover { background:var(--amber-bg); }
    .btn-green { background:var(--green-bg); color:var(--green); border-color:var(--green-border); }
    .btn-green:hover { background:rgba(26,122,74,.15); }
    .btn-sm { padding:5px 10px; font-size:12px; }
    .btn:disabled { opacity:.5; cursor:not-allowed; }

    /* TAGS & BADGES */
    .tag { display:inline-flex; align-items:center; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; letter-spacing:.3px; border:0.5px solid; }
    .tag-priority { background:var(--amber-bg); color:var(--amber); border-color:var(--amber-border); }
    .tag-recovery { background:var(--red-bg); color:var(--red); border-color:var(--red-border); }
    .tag-shed { background:var(--teal-bg); color:var(--teal); border-color:var(--teal-border); }
    .tag-standard { background:var(--bg); color:var(--text3); border-color:var(--border); }
    .tag-warn { background:var(--red-bg); color:var(--red); border-color:var(--red-border); }
    .tag-po { background:var(--teal-bg); color:var(--teal); border-color:var(--teal-border); }
    .status-pill { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:.3px; }

    /* FORMS */
    .form-group { display:flex; flex-direction:column; gap:6px; }
    .form-label { font-size:11px; font-weight:600; color:var(--text2); letter-spacing:.4px; text-transform:uppercase; }
    .form-input, .form-select, .form-textarea {
      border:1px solid var(--border); border-radius:var(--radius); padding:9px 12px;
      font-family:var(--font); font-size:14px; color:var(--text); background:var(--surface);
      width:100%; outline:none; transition:border .15s;
    }
    .form-input:focus, .form-select:focus, .form-textarea:focus { border-color:var(--brand); }
    .form-textarea { resize:vertical; min-height:80px; line-height:1.5; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-row3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }

    /* GRIDS */
    .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
    .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    .grid5 { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }

    /* MODAL */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:500; display:flex; align-items:center; justify-content:center; padding:16px; }
    .modal { background:var(--surface); border-radius:var(--radius-xl); width:100%; max-width:640px; max-height:92vh; overflow-y:auto; padding:24px; }
    .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
    .modal-title { font-size:17px; font-weight:600; color:var(--text); }
    .modal-close { background:none; border:none; font-size:22px; cursor:pointer; color:var(--text3); padding:2px; line-height:1; }
    .modal-close:hover { color:var(--text); }

    /* ALERTS */
    .alert { padding:10px 14px; border-radius:var(--radius); font-size:13px; }
    .alert-error { background:var(--red-bg); color:var(--red); border:0.5px solid var(--red-border); }
    .alert-success { background:var(--green-bg); color:var(--green); border:0.5px solid var(--green-border); }
    .alert-warn { background:var(--amber-bg); color:var(--amber); border:0.5px solid var(--amber-border); }
    .alert-info { background:rgba(0,71,159,.06); color:var(--brand); border:0.5px solid var(--brand-pale); }

    /* DIVIDER */
    .divider { height:0.5px; background:var(--border); margin:16px 0; }

    /* EMPTY STATE */
    .empty-state { text-align:center; padding:48px 24px; color:var(--text3); }
    .empty-state-icon { font-size:36px; margin-bottom:12px; }
    .empty-state-title { font-size:15px; font-weight:500; color:var(--text2); margin-bottom:6px; }
    .empty-state-desc { font-size:13px; line-height:1.5; }

    /* SECTION HEADER */
    .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px; }
    .section-title { font-size:18px; font-weight:600; color:var(--text); }
    .section-sub { font-size:13px; color:var(--text3); margin-top:2px; }

    /* SPINNER */
    .spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(0,71,159,.2); border-top-color:var(--brand); border-radius:50%; animation:spin .7s linear infinite; }
    .spinner-lg { width:32px; height:32px; border-width:3px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .loading-wrap { display:flex; align-items:center; justify-content:center; padding:48px; gap:12px; color:var(--text3); font-size:13px; }

    /* CALL BUTTON */
    .call-btn { display:inline-flex; align-items:center; gap:5px; background:var(--green-bg); border:0.5px solid var(--green-border); border-radius:6px; padding:4px 10px; font-size:11px; font-weight:600; color:var(--green); cursor:pointer; white-space:nowrap; text-decoration:none; }
    .call-btn:hover { background:rgba(26,122,74,.15); }

    /* MAPS BUTTON */
    .maps-btn { display:inline-flex; align-items:center; gap:4px; color:var(--brand); font-size:11px; font-weight:500; padding:3px 8px; border:0.5px solid var(--brand-pale); border-radius:4px; background:rgba(0,71,159,.04); text-decoration:none; }
    .maps-btn:hover { background:rgba(0,71,159,.1); }

    /* MONO TEXT */
    .mono { font-family:var(--mono); }

    /* INVOICE NUMBER */
    .invoice-num { font-family:var(--mono); font-weight:700; color:var(--brand); font-size:13px; letter-spacing:.3px; }

    /* RESPONSIVE */
    @media(max-width:768px) {
      .grid2, .grid3, .grid4, .grid5 { grid-template-columns:1fr; }
      .form-row, .form-row3 { grid-template-columns:1fr; }
      .page-wrap { padding:12px; }
      #topbar { padding:0 12px; }
    }

    /* PRINT */
    @media print {
      #topbar, .btn, .no-print { display:none !important; }
      body { background:#fff; color:#000; }
      .card { border:1px solid #ccc; }
    }
  `;
  document.head.appendChild(style);
}

// ---- HELPER FUNCTIONS ----

// Format date string DD/MM/YYYY
function fmtDate(d) {
  if (!d) return '—';
  const p = d.split('-');
  if (p.length !== 3) return d;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

// Format timestamp to readable string
function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-AU', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
}

// Format item length mm to metres
function fmtLen(mm) {
  if (!mm && mm !== 0) return '—';
  return (mm / 1000).toFixed(3).replace(/\.?0+$/, '') + 'm';
}

// Get today's date as YYYY-MM-DD
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Generate a status pill HTML
function statusPill(status) {
  const s = JOB_STATUSES[status] || { label: status, color: '#a3a4a4', bg: '#f0f4f8' };
  return `<span class="status-pill" style="background:${s.bg};color:${s.color}">${s.label}</span>`;
}

// Generate a job type tag HTML
function typeTag(type) {
  const t = JOB_TYPES[type];
  if (!type || type === 'standard' || !t) return '';
  return `<span class="tag tag-${type}">${t.icon} ${t.label}</span>`;
}

// Close modal when clicking overlay
function closeModal(id, e) {
  if (!e || e.target === document.getElementById(id)) {
    document.getElementById(id).style.display = 'none';
  }
}

// Show a toast notification
function showToast(msg, type = 'success') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    padding:12px 20px; border-radius:10px; font-size:13px; font-weight:500;
    z-index:9999; max-width:400px; text-align:center;
    box-shadow:0 4px 20px rgba(0,0,0,.15);
    background:${type==='success'?'#1a7a4a':type==='error'?'#b91c1c':'#8a5a00'};
    color:#fff; font-family:var(--font);
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Format phone number as clickable link
function phoneLink(phone) {
  if (!phone) return '—';
  const clean = phone.replace(/\s/g, '');
  return `<a class="call-btn" href="tel:${clean}">📞 ${phone}</a>`;
}

// Google Maps link from address
function mapsLink(address) {
  if (!address) return '';
  return `<a class="maps-btn" href="https://maps.google.com/?q=${encodeURIComponent(address)}" target="_blank">📍 Maps</a>`;
}

// Check if role can edit jobs
function canEditJobs() {
  return ['super_admin', 'branch_manager', 'planner'].includes(App.role);
}

// Check if role can reopen locked jobs
function canReopenJobs() {
  return ['super_admin', 'branch_manager'].includes(App.role);
}

// Check if role is admin or manager
function isAdminOrManager() {
  return ['super_admin', 'branch_manager'].includes(App.role);
}

// ---- AUTO INIT ----
// Inject styles as soon as app.js loads
injectSharedStyles();
