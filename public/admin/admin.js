/**
 * Puvima IT Service and Research Consultancy — Executive Administration Portal Controller
 * Full client-side management logic for authentication, inquiries review, customer reviews moderation, and site configuration.
 */

// Immediate global export to guarantee window.PUVIMA_ADMIN is always defined
window.PUVIMA_ADMIN = window.PUVIMA_ADMIN || {};

(function () {
  'use strict';

  const TOKEN_KEY = 'puvima_admin_token';
  const API_BASE = (window.PUVIMA_CONFIG && window.PUVIMA_CONFIG.API_BASE_URL) || (function () {
    try {
      let stored = localStorage.getItem('puvima_api_base_url') || '';
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        if (stored && stored.includes('vercel.app')) {
          stored = '';
          localStorage.removeItem('puvima_api_base_url');
        }
      }
      return stored;
    } catch (e) { return ''; }
  })();

  // State
  let currentAdmin = null;
  let contactsList = [];
  let internshipsList = [];
  let reviewsList = [];
  let siteSettings = {};
  let currentFilterContact = 'all';
  let currentFilterInternStatus = 'all';
  let currentFilterInternRole = 'all';
  let currentFilterReview = 'all';
  let activeModalItem = null;
  let activeInternModalItem = null;
  let internshipOffset = 0;
  let internshipLimit = 25;
  let internshipTotal = 0;

  // DOM Elements
  const loginView = document.getElementById('loginView');
  const adminShell = document.getElementById('adminShell');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const loginEmailInput = document.getElementById('loginEmail');
  const loginPassInput = document.getElementById('loginPassword');
  const loginErrorAlert = document.getElementById('loginErrorAlert');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const demoChipBtn = document.getElementById('demoChipBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminEmailDisplay = document.getElementById('adminEmailDisplay');
  const userAvatar = document.getElementById('userAvatar');

  // Modal Elements
  const modalOverlay = document.getElementById('detailModalOverlay');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalStatusBadge = document.getElementById('modalStatusBadge');
  const modalSubjectTitle = document.getElementById('modalSubjectTitle');
  const modalRefId = document.getElementById('modalRefId');
  const modalCreatedAt = document.getElementById('modalCreatedAt');
  const modalSenderName = document.getElementById('modalSenderName');
  const modalSenderEmail = document.getElementById('modalSenderEmail');
  const modalSenderCompany = document.getElementById('modalSenderCompany');
  const modalCompanyWrap = document.getElementById('modalCompanyWrap');
  const modalMessageBody = document.getElementById('modalMessageBody');
  const modalStatusSelect = document.getElementById('modalStatusSelect');
  const modalNotesInput = document.getElementById('modalNotesInput');
  const modalMailtoBtn = document.getElementById('modalMailtoBtn');
  const modalSaveActionBtn = document.getElementById('modalSaveActionBtn');

  // Settings Elements
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  // ==========================================================================
  // 1. INITIALIZATION & AUTH VERIFICATION
  // ==========================================================================
  async function init() {
    setupEventListeners();
    const token = getStoredToken();
    if (token) {
      const valid = await verifySession(token);
      if (valid) {
        showDashboard();
        return;
      }
    }
    showLogin();
  }

  function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }

  function setStoredToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearStoredToken() {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function authHeaders() {
    const token = getStoredToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async function verifySession(token) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        currentAdmin = data.user;
        return true;
      }
    } catch (e) {
      console.error('Session verification network error', e);
    }
    clearStoredToken();
    return false;
  }

  function showLogin() {
    window.location.replace('/login');
  }

  function showDashboard() {
    loginView.style.display = 'none';
    adminShell.style.display = 'flex';
    if (currentAdmin && currentAdmin.email) {
      adminEmailDisplay.textContent = currentAdmin.email;
      userAvatar.textContent = currentAdmin.email.charAt(0).toUpperCase();
    }
    refreshAllData();
  }

  // ==========================================================================
  // 2. CENTRALIZED BADGE & KPI METRIC SYNC
  // ==========================================================================
  function updateBadgesAndKpis() {
    const unreadContacts = contactsList.filter(c => c.status === 'new').length;
    const pendingReviews = reviewsList.filter(r => r.status === 'pending').length;
    const approvedReviews = reviewsList.filter(r => r.status === 'approved').length;
    const newInternships = internshipsList.filter(i => i.recruitment_status === 'received').length;

    // Top Navigation Badges
    const unreadBadge = document.getElementById('unreadContactsBadge');
    if (unreadBadge) unreadBadge.textContent = unreadContacts;

    const pendingBadge = document.getElementById('pendingReviewsBadge');
    if (pendingBadge) pendingBadge.textContent = pendingReviews;

    const internBadge = document.getElementById('newInternshipsBadge');
    if (internBadge) internBadge.textContent = newInternships;

    // Overview KPIs
    const kpiNew = document.getElementById('kpiNewContacts');
    if (kpiNew) kpiNew.textContent = unreadContacts;

    const kpiTotal = document.getElementById('kpiTotalContacts');
    if (kpiTotal) kpiTotal.textContent = contactsList.length;

    const kpiPending = document.getElementById('kpiPendingReviews');
    if (kpiPending) kpiPending.textContent = pendingReviews;

    const kpiApproved = document.getElementById('kpiApprovedReviews');
    if (kpiApproved) kpiApproved.textContent = approvedReviews;

    const kpiIntern = document.getElementById('kpiNewInternships');
    if (kpiIntern) kpiIntern.textContent = newInternships;
  }

  // ==========================================================================
  // 3. EVENT LISTENERS
  // ==========================================================================
  function setupEventListeners() {
    // Quick Demo Autofill
    if (demoChipBtn) {
      demoChipBtn.addEventListener('click', () => {
        loginEmailInput.value = 'admin@puvima.com';
        loginPassInput.value = 'admin123';
        loginEmailInput.focus();
      });
    }

    // Login Form Submit
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', handleLogin);
    }

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    // Refresh Buttons
    const refreshStatsBtn = document.getElementById('refreshStatsBtn');
    if (refreshStatsBtn) {
      refreshStatsBtn.addEventListener('click', async () => {
        await refreshAllData();
        showToast('Dashboard metrics updated.', 'info');
      });
    }

    const reloadContactsBtn = document.getElementById('reloadContactsBtn');
    if (reloadContactsBtn) {
      reloadContactsBtn.addEventListener('click', async () => {
        await Promise.all([loadContacts(), loadStats()]);
        showToast('Inquiries list refreshed.', 'info');
      });
    }

    // Contact Filters
    document.querySelectorAll('[data-filter-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterContact = btn.getAttribute('data-filter-status');
        renderContactsTable();
      });
    });

    const contactSearchInput = document.getElementById('contactSearchInput');
    if (contactSearchInput) {
      contactSearchInput.addEventListener('input', () => renderContactsTable());
    }

    // Internship Refresh & Filters
    const reloadInternshipsBtn = document.getElementById('reloadInternshipsBtn');
    if (reloadInternshipsBtn) {
      reloadInternshipsBtn.addEventListener('click', async () => {
        await Promise.all([loadInternships(), loadStats()]);
        showToast('Internship applications refreshed.', 'info');
      });
    }

    document.querySelectorAll('[data-filter-intern-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter-intern-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterInternStatus = btn.getAttribute('data-filter-intern-status');
        renderInternshipsTable();
      });
    });

    const internRoleFilter = document.getElementById('internRoleFilter');
    if (internRoleFilter) {
      internRoleFilter.addEventListener('change', () => {
        currentFilterInternRole = internRoleFilter.value;
        renderInternshipsTable();
      });
    }

    const internshipSearchInput = document.getElementById('internshipSearchInput');
    if (internshipSearchInput) {
      internshipSearchInput.addEventListener('input', () => renderInternshipsTable());
    }

    // Internship Pagination
    const internPrevBtn = document.getElementById('internshipPrevPageBtn');
    if (internPrevBtn) {
      internPrevBtn.addEventListener('click', () => {
        if (internshipOffset >= internshipLimit) {
          internshipOffset -= internshipLimit;
          loadInternships();
        }
      });
    }

    const internNextBtn = document.getElementById('internshipNextPageBtn');
    if (internNextBtn) {
      internNextBtn.addEventListener('click', () => {
        if (internshipOffset + internshipLimit < internshipTotal) {
          internshipOffset += internshipLimit;
          loadInternships();
        }
      });
    }

    // Internship Modal Actions
    const internModalCloseBtn = document.getElementById('internModalCloseBtn');
    if (internModalCloseBtn) {
      internModalCloseBtn.addEventListener('click', closeInternshipModal);
    }

    const internModalOverlay = document.getElementById('internModalOverlay');
    if (internModalOverlay) {
      internModalOverlay.addEventListener('click', (e) => {
        if (e.target === internModalOverlay) closeInternshipModal();
      });
    }

    const internModalSaveBtn = document.getElementById('internModalSaveBtn');
    if (internModalSaveBtn) {
      internModalSaveBtn.addEventListener('click', saveInternshipModal);
    }

    // Review Refresh & Filters
    const reloadReviewsBtn = document.getElementById('reloadReviewsBtn');
    if (reloadReviewsBtn) {
      reloadReviewsBtn.addEventListener('click', async () => {
        await Promise.all([loadReviews(), loadStats()]);
        showToast('Customer reviews refreshed.', 'info');
      });
    }

    document.querySelectorAll('[data-review-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-review-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterReview = btn.getAttribute('data-review-status');
        renderReviewsTable();
      });
    });

    const reviewSearchInput = document.getElementById('reviewSearchInput');
    if (reviewSearchInput) {
      reviewSearchInput.addEventListener('input', () => renderReviewsTable());
    }

    // Modal Events
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
    }
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }
    if (modalSaveActionBtn) {
      modalSaveActionBtn.addEventListener('click', handleModalSave);
    }

    // Save Settings
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', handleSaveSettings);
    }
  }

  // ==========================================================================
  // 4. AUTHENTICATION HANDLERS
  // ==========================================================================
  async function handleLogin(e) {
    e.preventDefault();
    const email = loginEmailInput.value.trim();
    const password = loginPassInput.value.trim();

    if (!email || !password) {
      showLoginError('Please enter both administrative email and password.');
      return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.innerHTML = '<span>Verifying credentials...</span>';
    loginErrorAlert.style.display = 'none';

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStoredToken(data.token);
        currentAdmin = data.user;
        try {
          localStorage.setItem('puvima_portal_auth_user', JSON.stringify({
            id: 'usr-admin-1',
            userId: 'ADM0001',
            user_code: 'ADM0001',
            name: (data.user && data.user.name) || 'Administrator',
            email: email,
            role: 'SuperAdmin',
            department: 'Executive Board',
            isActive: true
          }));
        } catch (e) {}
        showDashboard();
        showToast('Administrative session established.', 'success');
      } else {
        showLoginError(data.message || 'Authentication failed. Please verify credentials.');
      }
    } catch (err) {
      showLoginError('Network error: Unable to connect to authentication endpoint.');
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.innerHTML = `
        <span>Authenticate &amp; Enter Portal</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;
    }
  }

  function showLoginError(msg) {
    loginErrorAlert.textContent = msg;
    loginErrorAlert.style.display = 'block';
  }

  function handleLogout() {
    if (confirm('Are you sure you want to end your administrative session?')) {
      clearStoredToken();
      currentAdmin = null;
      try {
        localStorage.removeItem('puvima_portal_auth_user');
      } catch (e) {}
      window.location.replace('/login');
    }
  }

  function switchTab(tabId) {
    if (!tabId) return;
    if (tabId === 'inquiries') tabId = 'contacts';

    document.querySelectorAll('.tab-btn').forEach(btn => {
      const bTab = btn.getAttribute('data-tab');
      const isActive = (bTab === tabId) || (tabId === 'contacts' && bTab === 'inquiries');
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `tab-${tabId}`);
    });

    if (tabId === 'contacts') {
      loadContacts();
      loadStats();
    } else if (tabId === 'internships') {
      loadInternships();
      loadStats();
    } else if (tabId === 'reviews') {
      loadReviews();
      loadStats();
    } else if (tabId === 'overview') {
      loadStats();
      loadInternships();
    } else if (tabId === 'settings') {
      loadSettings();
    }
  }

  // ==========================================================================
  // 5. DATA LOADING & METRICS
  // ==========================================================================
  async function refreshAllData() {
    await Promise.all([
      loadStats(),
      loadContacts(),
      loadInternships(),
      loadReviews(),
      loadSettings()
    ]);
  }

  async function loadStats() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const s = data.stats;

        // Health & Uptime
        const healthDot = document.getElementById('systemHealthDot');
        const healthText = document.getElementById('systemHealthText');
        const storageEngineLabel = document.getElementById('storageEngineLabel');

        if (s.dbProvider === 'supabase_postgres') {
          if (healthDot) healthDot.className = 'status-dot';
          if (healthText) healthText.textContent = 'System: Supabase Cloud Connected';
          if (storageEngineLabel) storageEngineLabel.textContent = 'Supabase PostgreSQL (Cloud)';
        } else if (s.dbStatus === 'connected') {
          if (healthDot) healthDot.className = 'status-dot';
          if (healthText) healthText.textContent = 'System: Database Synchronized';
          if (storageEngineLabel) storageEngineLabel.textContent = 'Relational Enterprise Database';
        } else {
          if (healthDot) healthDot.className = 'status-dot degraded';
          if (healthText) healthText.textContent = 'System: Local File Fallback Active';
          if (storageEngineLabel) storageEngineLabel.textContent = 'Resilient Local Store (Supabase Ready)';
        }

        const uptimeLabel = document.getElementById('serverUptimeLabel');
        if (uptimeLabel) {
          const hrs = Math.floor(s.uptimeSeconds / 3600);
          const mins = Math.floor((s.uptimeSeconds % 3600) / 60);
          uptimeLabel.textContent = `${hrs}h ${mins}m active`;
        }

        updateBadgesAndKpis();
      }
    } catch (e) {
      console.error('Stats loading error', e);
    }
  }

  // ==========================================================================
  // 6. CONTACT INQUIRIES MANAGEMENT
  // ==========================================================================
  async function loadContacts() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        contactsList = data.contacts || [];
        updateBadgesAndKpis();
        renderContactsTable();
      }
    } catch (e) {
      showToast('Error loading contact inquiries.', 'error');
    }
  }

  function renderContactsTable() {
    const tbody = document.getElementById('contactsTableBody');
    if (!tbody) return;

    updateBadgesAndKpis();

    const search = (document.getElementById('contactSearchInput')?.value || '').toLowerCase().trim();

    let filtered = contactsList.filter(item => {
      if (currentFilterContact !== 'all' && item.status !== currentFilterContact) {
        return false;
      }
      if (search) {
        const str = `${item.reference_id} ${item.name} ${item.email} ${item.company || ''} ${item.subject || ''} ${item.message}`.toLowerCase();
        return str.includes(search);
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table-state" style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">📬</div>
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); margin-bottom: 4px;">No contact inquiries found</div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">No incoming inquiries match the current filter selection (${escapeHtml(currentFilterContact)}).</p>
            ${currentFilterContact !== 'all' ? `
              <button type="button" class="btn-ghost" style="font-size: 0.8rem; padding: 6px 14px;" onclick="document.querySelector('[data-filter-status=\'all\']').click()">Show All Inquiries</button>
            ` : ''}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const dateFormatted = new Date(c.created_at || Date.now()).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      const statusClass = `status-${c.status || 'new'}`;
      const statusLabel = (c.status || 'new').replace('_', ' ');

      return `
        <tr>
          <td>
            <code style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-teal);">${escapeHtml(c.reference_id)}</code>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(c.name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(c.email)}</div>
            ${c.company ? `<div style="font-size: 0.76rem; color: var(--accent-violet); margin-top: 2px;">${escapeHtml(c.company)}</div>` : ''}
          </td>
          <td style="max-width: 380px;">
            <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-main); margin-bottom: 4px;">${escapeHtml(c.subject || 'General Inquiry')}</div>
            <div style="font-size: 0.82rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(c.message)}
            </div>
            ${c.admin_notes ? `<div style="font-size: 0.74rem; color: var(--accent-amber); margin-top: 4px; font-style: italic;">Note: ${escapeHtml(c.admin_notes)}</div>` : ''}
          </td>
          <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
            ${dateFormatted}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="action-btn-group" style="justify-content: flex-end;">
              <button class="btn-icon" title="Inspect &amp; Update Record" onclick="window.PUVIMA_ADMIN.openContactModal('${escapeHtml(c.reference_id)}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="btn-icon" title="Mark as Responded" onclick="window.PUVIMA_ADMIN.quickStatusContact('${escapeHtml(c.reference_id)}', 'responded', this)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <button class="btn-icon danger" title="Delete Inquiry" onclick="window.PUVIMA_ADMIN.deleteContact('${escapeHtml(c.reference_id)}', this)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // 6b. CANDIDATE INTERNSHIP APPLICATIONS MANAGEMENT (GOOGLE DRIVE RESUMES)
  // ==========================================================================
  async function loadInternships() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/internship-applications?limit=${internshipLimit}&offset=${internshipOffset}`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        internshipsList = data.applications || [];
        internshipTotal = data.total || internshipsList.length;
        updateBadgesAndKpis();
        renderInternshipsTable();
      }
    } catch (e) {
      console.warn('[Admin] Error loading internship applications:', e.message);
      showToast('Error loading internship applications.', 'error');
    }
  }

  function renderInternshipsTable() {
    const tbody = document.getElementById('internshipsTableBody');
    if (!tbody) return;

    updateBadgesAndKpis();

    const search = (document.getElementById('internshipSearchInput')?.value || '').toLowerCase().trim();

    let filtered = internshipsList.filter(item => {
      if (currentFilterInternStatus !== 'all' && item.recruitment_status !== currentFilterInternStatus) {
        return false;
      }
      if (currentFilterInternRole !== 'all' && item.internship_role !== currentFilterInternRole) {
        return false;
      }
      if (search) {
        const str = `${item.reference_id} ${item.full_name} ${item.email} ${item.phone} ${item.college} ${item.degree} ${item.internship_role}`.toLowerCase();
        return str.includes(search);
      }
      return true;
    });

    // Update count display
    const countDisplay = document.getElementById('internshipCountDisplay');
    if (countDisplay) {
      countDisplay.textContent = `Showing ${filtered.length} of ${internshipTotal} applications`;
    }

    // Update pagination buttons
    const prevBtn = document.getElementById('internshipPrevPageBtn');
    const nextBtn = document.getElementById('internshipNextPageBtn');
    if (prevBtn) prevBtn.disabled = internshipOffset === 0;
    if (nextBtn) nextBtn.disabled = (internshipOffset + internshipLimit) >= internshipTotal;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-table-state" style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🎓</div>
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); margin-bottom: 4px;">No internship applications found</div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">No candidate applications match the current filter selection.</p>
            ${currentFilterInternStatus !== 'all' || currentFilterInternRole !== 'all' || search ? `
              <button type="button" class="btn-ghost" style="font-size: 0.8rem; padding: 6px 14px;" onclick="window.PUVIMA_ADMIN.resetInternFilters()">Reset All Filters</button>
            ` : ''}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(app => {
      const dateFormatted = new Date(app.created_at || Date.now()).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });

      const statusClass = `status-${app.recruitment_status || 'received'}`;
      const statusLabel = (app.recruitment_status || 'received').replace('_', ' ');
      const driveUrl = app.resume_drive_url || (app.resume_drive_file_id ? `https://drive.google.com/file/d/${app.resume_drive_file_id}/view` : '#');

      return `
        <tr>
          <td>
            <code style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-teal);">${escapeHtml(app.reference_id)}</code>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(app.full_name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(app.email)}</div>
            <div style="font-size: 0.76rem; color: var(--text-subtle);">${escapeHtml(app.phone)}</div>
          </td>
          <td>
            <div style="font-weight: 500; font-size: 0.86rem; color: var(--text-main);">${escapeHtml(app.college)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(app.degree)} &bull; ${escapeHtml(app.study_year)}</div>
          </td>
          <td>
            <span style="display: inline-block; background: #EFF6FF; color: var(--primary); font-weight: 600; font-size: 0.82rem; padding: 2px 8px; border-radius: 4px; border: 1px solid #BFDBFE;">
              ${escapeHtml(app.internship_role)}
            </span>
          </td>
          <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
            ${dateFormatted}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="action-btn-group" style="justify-content: flex-end; gap: 8px;">
              ${app.resume_drive_url || app.resume_drive_file_id ? `
                <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="btn-ghost" style="padding: 4px 10px; font-size: 0.78rem; color: var(--primary); font-weight: 700; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #BFDBFE; background: #F0F7FF;" title="Open candidate resume in Google Drive">
                  <span>Drive ↗</span>
                </a>
              ` : ''}
              <button class="btn-icon" title="View Full Questionnaire &amp; Evaluate" onclick="window.PUVIMA_ADMIN.openInternshipModal('${escapeHtml(app.reference_id)}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openInternshipModal(refId) {
    const app = internshipsList.find(i => i.reference_id === refId || String(i.id) === String(refId));
    if (!app) {
      showToast('Application details not found.', 'error');
      return;
    }

    activeInternModalItem = app;
    const modal = document.getElementById('internModalOverlay');
    if (!modal) return;

    // Header & Meta
    const badge = document.getElementById('internModalStatusBadge');
    if (badge) {
      badge.className = `status-pill status-${app.recruitment_status || 'received'}`;
      badge.textContent = (app.recruitment_status || 'received').replace('_', ' ').toUpperCase();
    }
    const nameEl = document.getElementById('internModalApplicantName');
    if (nameEl) nameEl.textContent = app.full_name || 'Candidate Application';
    const refEl = document.getElementById('internModalRefId');
    if (refEl) refEl.textContent = app.reference_id || '--';
    const createdEl = document.getElementById('internModalCreatedAt');
    if (createdEl) createdEl.textContent = new Date(app.created_at || Date.now()).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const roleEl = document.getElementById('internModalRole');
    if (roleEl) roleEl.textContent = app.internship_role || '--';

    // Google Drive Resume Card
    const driveBtn = document.getElementById('internModalDriveBtn');
    const driveUrl = app.resume_drive_url || (app.resume_drive_file_id ? `https://drive.google.com/file/d/${app.resume_drive_file_id}/view` : '#');
    if (driveBtn) {
      driveBtn.href = driveUrl;
    }
    const downloadBtn = document.getElementById('internModalDownloadBtn');
    if (downloadBtn) {
      downloadBtn.href = `${API_BASE}/api/admin/internship-applications/${app.id || app.reference_id}/resume`;
      downloadBtn.target = '_blank';
    }
    const filenameEl = document.getElementById('internModalResumeFilename');
    if (filenameEl) filenameEl.textContent = app.resume_filename || 'Candidate_Resume.pdf';
    const sizeKb = Math.round((app.resume_size_bytes || 0) / 1024);
    const sizeEl = document.getElementById('internModalResumeSize');
    if (sizeEl) sizeEl.textContent = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb} KB`;

    // Contact details
    const emailEl = document.getElementById('internModalEmail');
    if (emailEl) {
      emailEl.textContent = app.email;
      emailEl.href = `mailto:${app.email}`;
    }
    const phoneEl = document.getElementById('internModalPhone');
    if (phoneEl) phoneEl.textContent = app.phone || '--';
    const locEl = document.getElementById('internModalCityState');
    if (locEl) locEl.textContent = app.city_state || '--';
    
    const linkedinWrap = document.getElementById('internModalLinkedinWrap');
    const linkedinEl = document.getElementById('internModalLinkedin');
    if (app.linkedin_url) {
      if (linkedinWrap) linkedinWrap.style.display = 'block';
      if (linkedinEl) linkedinEl.href = app.linkedin_url;
    } else {
      if (linkedinWrap) linkedinWrap.style.display = 'none';
    }

    // Academic Background
    const collEl = document.getElementById('internModalCollege');
    if (collEl) collEl.textContent = app.college || '--';
    const degEl = document.getElementById('internModalDegree');
    if (degEl) degEl.textContent = app.degree || '--';
    const yrEl = document.getElementById('internModalStudyYear');
    if (yrEl) yrEl.textContent = app.study_year || '--';
    const gradEl = document.getElementById('internModalGradYear');
    if (gradEl) gradEl.textContent = app.graduation_year || '--';
    const cgpaEl = document.getElementById('internModalCgpa');
    if (cgpaEl) cgpaEl.textContent = app.cgpa_range || '--';

    // Skills
    const skillsContainer = document.getElementById('internModalSkillsChips');
    if (skillsContainer) {
      const skillsArray = Array.isArray(app.skills) ? app.skills : (typeof app.skills === 'string' ? JSON.parse(app.skills || '[]') : []);
      if (skillsArray.length > 0) {
        skillsContainer.innerHTML = skillsArray.map(s => `
          <span style="display: inline-block; background: #EFF6FF; color: var(--primary); font-size: 0.82rem; padding: 4px 10px; border-radius: 4px; border: 1px solid #BFDBFE; font-weight: 500;">
            ${escapeHtml(s)}
          </span>
        `).join('');
      } else {
        skillsContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">None specified</span>';
      }
    }

    const strongEl = document.getElementById('internModalStrongestSkills');
    if (strongEl) strongEl.textContent = app.strongest_skills || 'None provided.';

    // Projects / Portfolio
    const projectsWrap = document.getElementById('internModalProjectsWrap');
    const projEl = document.getElementById('internModalProjects');
    if (app.projects_experience) {
      if (projectsWrap) projectsWrap.style.display = 'block';
      if (projEl) projEl.textContent = app.projects_experience;
    } else {
      if (projectsWrap) projectsWrap.style.display = 'none';
    }

    const portfolioWrap = document.getElementById('internModalPortfolioUrlWrap');
    const portfolioEl = document.getElementById('internModalPortfolioUrl');
    if (app.github_portfolio_url) {
      if (portfolioWrap) portfolioWrap.style.display = 'block';
      if (portfolioEl) {
        portfolioEl.textContent = app.github_portfolio_url;
        portfolioEl.href = app.github_portfolio_url;
      }
    } else {
      if (portfolioWrap) portfolioWrap.style.display = 'none';
    }

    // Motivation & Contribution
    const motEl = document.getElementById('internModalMotivation');
    if (motEl) motEl.textContent = app.motivation || '--';
    const contEl = document.getElementById('internModalContribution');
    if (contEl) contEl.textContent = app.expected_contribution || '--';

    // Availability
    const modeEl = document.getElementById('internModalMode');
    if (modeEl) modeEl.textContent = app.internship_mode || '--';
    const durEl = document.getElementById('internModalDuration');
    if (durEl) durEl.textContent = app.duration || '--';
    const joinEl = document.getElementById('internModalJoining');
    if (joinEl) joinEl.textContent = app.joining_availability === 'On a specific future date' && app.specific_joining_date
      ? `Specific Date: ${app.specific_joining_date}`
      : (app.joining_availability || '--');
    const hrsEl = document.getElementById('internModalHours');
    if (hrsEl) hrsEl.textContent = app.weekly_hours || '--';
    const refSrcEl = document.getElementById('internModalReferral');
    if (refSrcEl) refSrcEl.textContent = app.referral_source === 'Other' && app.other_referral_details
      ? `Other (${app.other_referral_details})`
      : (app.referral_source || '--');

    // Additional info
    const addlWrap = document.getElementById('internModalAddlInfoWrap');
    const addlEl = document.getElementById('internModalAddlInfo');
    if (app.additional_information) {
      if (addlWrap) addlWrap.style.display = 'block';
      if (addlEl) addlEl.textContent = app.additional_information;
    } else {
      if (addlWrap) addlWrap.style.display = 'none';
    }

    // Email Candidate mailto link
    const mailtoBtn = document.getElementById('internModalMailtoBtn');
    if (mailtoBtn) {
      mailtoBtn.href = `mailto:${app.email}?subject=Puvima%20IT%20Service%20and%20Research%20Consultancy%20Internship%20Application%20%5B${encodeURIComponent(app.reference_id)}%5D`;
    }

    // Workflow controls
    const statusSelect = document.getElementById('internModalStatusSelect');
    if (statusSelect) statusSelect.value = app.recruitment_status || 'received';
    const notesInput = document.getElementById('internModalNotesInput');
    if (notesInput) notesInput.value = app.admin_notes || '';

    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeInternshipModal() {
    const modal = document.getElementById('internModalOverlay');
    if (modal) modal.classList.remove('visible');
    document.body.style.overflow = '';
    activeInternModalItem = null;
  }

  async function saveInternshipModal() {
    if (!activeInternModalItem) return;

    const status = document.getElementById('internModalStatusSelect')?.value;
    const admin_notes = (document.getElementById('internModalNotesInput')?.value || '').trim();
    const saveBtn = document.getElementById('internModalSaveBtn');

    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/admin/internship-applications/${activeInternModalItem.reference_id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status, admin_notes })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Application status updated to '${status}'.`, 'success');
        // Update local state
        activeInternModalItem.recruitment_status = status;
        activeInternModalItem.admin_notes = admin_notes;
        const idx = internshipsList.findIndex(i => i.reference_id === activeInternModalItem.reference_id);
        if (idx !== -1) {
          internshipsList[idx].recruitment_status = status;
          internshipsList[idx].admin_notes = admin_notes;
        }
        updateBadgesAndKpis();
        renderInternshipsTable();
        closeInternshipModal();
      } else {
        showToast(data.message || 'Failed to update status.', 'error');
      }
    } catch (err) {
      showToast('Network error while updating status.', 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  function resetInternFilters() {
    currentFilterInternStatus = 'all';
    currentFilterInternRole = 'all';
    document.querySelectorAll('[data-filter-intern-status]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-filter-intern-status') === 'all');
    });
    const roleSelect = document.getElementById('internRoleFilter');
    if (roleSelect) roleSelect.value = 'all';
    const searchInput = document.getElementById('internshipSearchInput');
    if (searchInput) searchInput.value = '';
    renderInternshipsTable();
  }
  }

  // ==========================================================================
  // 7. CUSTOMER REVIEWS MANAGEMENT & PUSH TO MAIN PAGE
  // ==========================================================================
  async function loadReviews() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        reviewsList = data.reviews || [];
        updateBadgesAndKpis();
        renderReviewsTable();
      }
    } catch (e) {
      showToast('Error loading customer reviews.', 'error');
    }
  }

  function renderReviewsTable() {
    const tbody = document.getElementById('reviewsTableBody');
    if (!tbody) return;

    updateBadgesAndKpis();

    const search = (document.getElementById('reviewSearchInput')?.value || '').toLowerCase().trim();

    let filtered = reviewsList.filter(item => {
      if (currentFilterReview !== 'all' && item.status !== currentFilterReview) {
        return false;
      }
      if (search) {
        const str = `${item.reference_id} ${item.name} ${item.company || ''} ${item.review_text}`.toLowerCase();
        return str.includes(search);
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table-state" style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">⭐</div>
            <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); margin-bottom: 4px;">No reviews in this category</div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">No reviews match the current filter selection (${escapeHtml(currentFilterReview)}).</p>
            ${currentFilterReview !== 'all' ? `
              <button type="button" class="btn-ghost" style="font-size: 0.8rem; padding: 6px 14px;" onclick="document.querySelector('[data-review-status=\'all\']').click()">Show All Reviews</button>
            ` : ''}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const isApproved = r.status === 'approved';
      const statusClass = isApproved ? 'status-responded' : 'status-in_review';
      const statusLabel = isApproved ? 'Published on Main Page' : 'Pending Approval';
      const stars = '★'.repeat(Math.min(5, Math.max(1, r.rating || 5)));
      const initials = (function(name) {
        if (!name) return 'CL';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      })(r.name);

      const reviewId = escapeHtml(r.reference_id || String(r.id));

      const hasAvatar = Boolean(r.avatar_url && r.avatar_url.trim() && !r.avatar_url.includes('assets/images/team/'));
      const avatarHtml = hasAvatar
        ? `<img src="${escapeHtml(r.avatar_url)}" alt="${escapeHtml(r.name)}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1.5px solid var(--border-color); box-shadow: 0 2px 6px rgba(0,0,0,0.08);" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div style="display: none; width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0072ce 0%, #0284c7 100%); color: #fff; font-weight: 700; font-size: 0.82rem; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0, 114, 206, 0.25);">${initials}</div>`
        : `<div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0072ce 0%, #0284c7 100%); color: #fff; font-weight: 700; font-size: 0.82rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0, 114, 206, 0.25);">${initials}</div>`;

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              ${avatarHtml}
              <div>
                <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(r.name)}</div>
                ${r.company ? `<div style="font-size: 0.78rem; color: var(--accent-teal);">${escapeHtml(r.company)}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span style="color: #f59e0b; font-size: 0.95rem; letter-spacing: 2px;">${stars}</span>
          </td>
          <td style="max-width: 320px;">
            <div style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.55;">"${escapeHtml(r.review_text)}"</div>
          </td>
          <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
            ${escapeHtml(r.date_display || new Date(r.created_at || Date.now()).toLocaleDateString())}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="action-btn-group" style="justify-content: flex-end; gap: 8px;">
              ${!isApproved ? `
                <button class="btn-table-publish" title="Publish Review to Main Page Carousel" onclick="window.PUVIMA_ADMIN.pushReviewToMainPage('${reviewId}', this)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Push to Main Page</span>
                </button>
              ` : `
                <button class="btn-table-takedown" title="Take Down from Main Page Carousel" onclick="window.PUVIMA_ADMIN.unpublishReview('${reviewId}', this)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <span>Take Down</span>
                </button>
              `}
              <button class="btn-icon danger" style="padding: 7px; border-radius: 6px;" title="Permanently Delete Review" onclick="window.PUVIMA_ADMIN.deleteReview('${reviewId}', this)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function pushReviewToMainPage(id, btn) {
    if (btn) btn.disabled = true;

    // Optimistically update memory so UI updates in 0ms
    const rev = reviewsList.find(x => x.reference_id === id || String(x.id) === String(id));
    const previousStatus = rev ? rev.status : 'pending';
    if (rev) rev.status = 'approved';

    updateBadgesAndKpis();
    renderReviewsTable();
    showToast('Review approved & published to live homepage carousel!', 'success');

    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'approved' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (rev) rev.status = previousStatus;
        updateBadgesAndKpis();
        renderReviewsTable();
        showToast((data && data.message) || 'Failed to approve review.', 'error');
      }
    } catch (e) {
      if (rev) rev.status = previousStatus;
      updateBadgesAndKpis();
      renderReviewsTable();
      showToast('Network error while pushing review.', 'error');
    }
  }

  async function unpublishReview(id, btn) {
    if (btn) btn.disabled = true;

    // Optimistically update memory so UI updates in 0ms
    const rev = reviewsList.find(x => x.reference_id === id || String(x.id) === String(id));
    const previousStatus = rev ? rev.status : 'approved';
    if (rev) rev.status = 'pending';

    updateBadgesAndKpis();
    renderReviewsTable();
    showToast('Review taken down from main page and marked as Pending.', 'info');

    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'pending' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (rev) rev.status = previousStatus;
        updateBadgesAndKpis();
        renderReviewsTable();
        showToast((data && data.message) || 'Failed to update review.', 'error');
      }
    } catch (e) {
      if (rev) rev.status = previousStatus;
      updateBadgesAndKpis();
      renderReviewsTable();
      showToast('Network error while updating review.', 'error');
    }
  }

  async function deleteReview(id, btn) {
    if (!confirm('Are you sure you want to permanently delete this customer review?')) return;
    if (btn) btn.disabled = true;

    // Optimistically remove from list
    const deletedIndex = reviewsList.findIndex(x => x.reference_id === id || String(x.id) === String(id));
    let removedItem = null;
    if (deletedIndex !== -1) {
      removedItem = reviewsList.splice(deletedIndex, 1)[0];
      updateBadgesAndKpis();
      renderReviewsTable();
      showToast('Review permanently removed.', 'info');
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (removedItem) {
          reviewsList.splice(deletedIndex, 0, removedItem);
          updateBadgesAndKpis();
          renderReviewsTable();
        }
        showToast((data && data.message) || 'Error deleting review.', 'error');
      }
    } catch (e) {
      if (removedItem) {
        reviewsList.splice(deletedIndex, 0, removedItem);
        updateBadgesAndKpis();
        renderReviewsTable();
      }
      showToast('Error deleting review.', 'error');
    }
  }

  // ==========================================================================
  // 8. DETAIL INSPECTION MODAL (FOR INQUIRIES)
  // ==========================================================================
  function openContactModal(refId) {
    const contact = contactsList.find(c => c.reference_id === refId);
    if (!contact) return;

    activeModalItem = { type: 'contact', data: contact };

    modalRefId.textContent = contact.reference_id;
    modalSubjectTitle.textContent = contact.subject || 'General Technical Inquiry';
    modalCreatedAt.textContent = new Date(contact.created_at || Date.now()).toLocaleString();
    modalSenderName.textContent = contact.name;
    modalSenderEmail.textContent = contact.email;
    modalSenderEmail.href = `mailto:${contact.email}?subject=Puvima IT Service and Research Consultancy — Regarding your inquiry [${contact.reference_id}]`;

    if (contact.company) {
      modalCompanyWrap.style.display = 'block';
      modalSenderCompany.textContent = contact.company;
    } else {
      modalCompanyWrap.style.display = 'none';
    }

    modalMessageBody.textContent = contact.message;
    modalNotesInput.value = contact.admin_notes || '';

    // Populate Status Options
    modalStatusSelect.innerHTML = `
      <option value="new">New (Unread)</option>
      <option value="in_review">In Review (Evaluating with Lead)</option>
      <option value="responded">Responded (Email Sent)</option>
      <option value="archived">Archived</option>
    `;
    modalStatusSelect.value = contact.status || 'new';

    modalStatusBadge.className = `status-pill status-${contact.status || 'new'}`;
    modalStatusBadge.textContent = (contact.status || 'new').replace('_', ' ').toUpperCase();

    modalMailtoBtn.href = `mailto:${contact.email}?subject=PUVIMA Advisory — Response to ${encodeURIComponent(contact.subject || 'Inquiry')} [${contact.reference_id}]&body=Dear ${encodeURIComponent(contact.name)},%0D%0A%0D%0AThank you for reaching out to Puvima IT Service and Research Consultancy.%0D%0A%0D%0A---%0D%0AAdvisory Team%0D%0APuvima IT Service and Research Consultancy`;

    modalOverlay.style.display = 'flex';
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
    activeModalItem = null;
  }

  async function handleModalSave() {
    if (!activeModalItem) return;
    const newStatus = modalStatusSelect.value;
    const notes = modalNotesInput.value.trim();

    modalSaveActionBtn.disabled = true;
    modalSaveActionBtn.innerHTML = '<span>Saving Changes...</span>';

    try {
      if (activeModalItem.type === 'contact') {
        const refId = activeModalItem.data.reference_id;
        const res = await fetch(`${API_BASE}/api/admin/contacts/${encodeURIComponent(refId)}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: newStatus, admin_notes: notes })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Inquiry record updated successfully.', 'success');
          const contact = contactsList.find(c => c.reference_id === refId);
          if (contact) {
            contact.status = newStatus;
            contact.admin_notes = notes;
          }
          closeModal();
          updateBadgesAndKpis();
          renderContactsTable();
        } else {
          showToast((data && data.message) || 'Failed to update record.', 'error');
        }
      }
    } catch (e) {
      showToast('Error saving record updates.', 'error');
    } finally {
      modalSaveActionBtn.disabled = false;
      modalSaveActionBtn.innerHTML = '<span>Update Record</span>';
    }
  }

  // Quick Action Handlers for table rows
  async function quickStatusContact(refId, newStatus, btn) {
    if (btn) btn.disabled = true;

    // Optimistically update
    const contact = contactsList.find(c => c.reference_id === refId);
    const previousStatus = contact ? contact.status : 'new';
    if (contact) contact.status = newStatus;

    updateBadgesAndKpis();
    renderContactsTable();
    showToast(`Inquiry marked as ${newStatus.replace('_', ' ')}.`, 'success');

    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/${encodeURIComponent(refId)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (contact) contact.status = previousStatus;
        updateBadgesAndKpis();
        renderContactsTable();
        showToast((data && data.message) || 'Error updating status.', 'error');
      }
    } catch (e) {
      if (contact) contact.status = previousStatus;
      updateBadgesAndKpis();
      renderContactsTable();
      showToast('Error updating status.', 'error');
    }
  }

  async function deleteContact(refId, btn) {
    if (!confirm(`Are you sure you want to permanently delete inquiry ${refId}?`)) return;
    if (btn) btn.disabled = true;

    const deletedIndex = contactsList.findIndex(c => c.reference_id === refId);
    let removedItem = null;
    if (deletedIndex !== -1) {
      removedItem = contactsList.splice(deletedIndex, 1)[0];
      updateBadgesAndKpis();
      renderContactsTable();
      showToast('Inquiry permanently removed.', 'info');
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/${encodeURIComponent(refId)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (removedItem) {
          contactsList.splice(deletedIndex, 0, removedItem);
          updateBadgesAndKpis();
          renderContactsTable();
        }
        showToast((data && data.message) || 'Error deleting inquiry.', 'error');
      }
    } catch (e) {
      if (removedItem) {
        contactsList.splice(deletedIndex, 0, removedItem);
        updateBadgesAndKpis();
        renderContactsTable();
      }
      showToast('Error deleting inquiry.', 'error');
    }
  }

  // ==========================================================================
  // 9. MAIN PAGE SETTINGS MANAGEMENT
  // ==========================================================================
  async function loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        siteSettings = data.settings || {};
        populateSettingsForm(siteSettings);
      }
    } catch (e) {
      showToast('Error loading site settings.', 'error');
    }
  }

  function populateSettingsForm(s) {
    // Announcement
    const ann = s.announcement || {};
    document.getElementById('announcementEnabled').checked = ann.enabled !== false;
    document.getElementById('announcementBadge').value = ann.badge || 'NEW';
    document.getElementById('announcementText').value = ann.text || '';
    document.getElementById('announcementLinkText').value = ann.linkText || '';
    document.getElementById('announcementLinkUrl').value = ann.linkUrl || '';

    // Hero
    const hero = s.hero || {};
    const heroEyebrowEl = document.getElementById('heroEyebrow');
    if (heroEyebrowEl) heroEyebrowEl.value = hero.eyebrow || '';
    document.getElementById('heroHeadlineMain').value = hero.headlineMain || 'Innovation.';
    document.getElementById('heroHeadlineGradient').value = hero.headlineGradient || 'Research. Excellence.';
    document.getElementById('heroSubhead').value = hero.subhead || '';

    // Contact
    const contact = s.contact || {};
    document.getElementById('contactEmailSetting').value = contact.email || 'contact@puvima.com';
    document.getElementById('contactPhoneSetting').value = contact.phone || '+91 93847 87701';
    document.getElementById('contactHoursSetting').value = contact.hours || 'Mon – Fri: 09:00 – 18:00 IST';
    document.getElementById('contactLocationSetting').value = contact.location || 'Chennai & Bangalore, India';

    // Stats
    const stats = s.stats || {};
    document.getElementById('statConsultations').value = stats.consultationsDelivered || '120+';
    document.getElementById('statPrototypes').value = stats.activePrototypes || '18';
    document.getElementById('statDomains').value = stats.researchDomains || '4';
    document.getElementById('statSatisfaction').value = stats.clientSatisfaction || '99.4%';

    // Careers Application Form URL
    const careersUrl = s.careersFormUrl || (s.careers && s.careers.formUrl) || '';
    const careersSettingInput = document.getElementById('careersFormUrlSetting');
    if (careersSettingInput) careersSettingInput.value = careersUrl;
  }

  async function handleSaveSettings() {
    const careersUrlVal = (document.getElementById('careersFormUrlSetting')?.value || '').trim();

    const payload = {
      announcement: {
        enabled: document.getElementById('announcementEnabled').checked,
        badge: document.getElementById('announcementBadge').value.trim(),
        text: document.getElementById('announcementText').value.trim(),
        linkText: document.getElementById('announcementLinkText').value.trim(),
        linkUrl: document.getElementById('announcementLinkUrl').value.trim()
      },
      hero: {
        eyebrow: (document.getElementById('heroEyebrow')?.value || '').trim(),
        headlineMain: document.getElementById('heroHeadlineMain').value.trim(),
        headlineGradient: document.getElementById('heroHeadlineGradient').value.trim(),
        subhead: document.getElementById('heroSubhead').value.trim()
      },
      contact: {
        email: document.getElementById('contactEmailSetting').value.trim(),
        phone: document.getElementById('contactPhoneSetting').value.trim(),
        hours: document.getElementById('contactHoursSetting').value.trim(),
        location: document.getElementById('contactLocationSetting').value.trim()
      },
      stats: {
        consultationsDelivered: document.getElementById('statConsultations').value.trim(),
        activePrototypes: document.getElementById('statPrototypes').value.trim(),
        researchDomains: document.getElementById('statDomains').value.trim(),
        clientSatisfaction: document.getElementById('statSatisfaction').value.trim()
      },
      careersFormUrl: careersUrlVal
    };

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.innerHTML = '<span>Publishing Changes...</span>';

    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Site settings updated live across all pages.', 'success');
        siteSettings = data.settings;
      } else {
        showToast((data && data.message) || 'Error saving settings.', 'error');
      }
    } catch (e) {
      showToast('Network error while saving settings.', 'error');
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        <span>Save &amp; Publish Changes</span>
      `;
    }
  }

  // Toast Utility
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose global methods for inline HTML event triggers
  window.PUVIMA_ADMIN.switchTab = switchTab;
  window.PUVIMA_ADMIN.openContactModal = openContactModal;
  window.PUVIMA_ADMIN.quickStatusContact = quickStatusContact;
  window.PUVIMA_ADMIN.deleteContact = deleteContact;
  window.PUVIMA_ADMIN.openInternshipModal = openInternshipModal;
  window.PUVIMA_ADMIN.closeInternshipModal = closeInternshipModal;
  window.PUVIMA_ADMIN.resetInternFilters = resetInternFilters;
  window.PUVIMA_ADMIN.loadInternships = loadInternships;
  window.PUVIMA_ADMIN.pushReviewToMainPage = pushReviewToMainPage;
  window.PUVIMA_ADMIN.unpublishReview = unpublishReview;
  window.PUVIMA_ADMIN.deleteReview = deleteReview;

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
