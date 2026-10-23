/**
 * PUVIMA Consultancy — Executive Administration Portal Controller
 * Full client-side management logic for authentication, inquiries review, bookings, and site configuration.
 */

(function () {
  'use strict';

  const TOKEN_KEY = 'puvima_admin_token';
  const API_BASE = ''; // Relative to origin

  // State
  let currentAdmin = null;
  let contactsList = [];
  let bookingsList = [];
  let reviewsList = [];
  let siteSettings = {};
  let currentFilterContact = 'all';
  let currentFilterBooking = 'all';
  let currentFilterReview = 'all';
  let activeModalItem = null; // { type: 'contact' | 'booking', data }
  let jobsList = [];
  let applicationsList = [];
  let currentFilterJob = 'all';
  let currentFilterApp = 'all';
  let selectedAppJobFilter = 'all';
  let activeAppItem = null;

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
    loginView.style.display = 'flex';
    adminShell.style.display = 'none';
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
  // 2. EVENT LISTENERS
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
    if (refreshStatsBtn) refreshStatsBtn.addEventListener('click', loadStats);

    const reloadContactsBtn = document.getElementById('reloadContactsBtn');
    if (reloadContactsBtn) reloadContactsBtn.addEventListener('click', loadContacts);

    const reloadBookingsBtn = document.getElementById('reloadBookingsBtn');
    if (reloadBookingsBtn) reloadBookingsBtn.addEventListener('click', loadBookings);

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

    // Booking Filters
    document.querySelectorAll('[data-booking-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-booking-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterBooking = btn.getAttribute('data-booking-status');
        renderBookingsTable();
      });
    });

    const bookingSearchInput = document.getElementById('bookingSearchInput');
    if (bookingSearchInput) {
      bookingSearchInput.addEventListener('input', () => renderBookingsTable());
    }

    // Review Refresh & Filters
    const reloadReviewsBtn = document.getElementById('reloadReviewsBtn');
    if (reloadReviewsBtn) reloadReviewsBtn.addEventListener('click', loadReviews);

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

    // Careers & Recruitment Subtab Switching
    const subtabJobsBtn = document.getElementById('subtabJobsBtn');
    const subtabAppsBtn = document.getElementById('subtabAppsBtn');
    const careersJobsSubView = document.getElementById('careersJobsSubView');
    const careersAppsSubView = document.getElementById('careersAppsSubView');

    if (subtabJobsBtn && subtabAppsBtn) {
      subtabJobsBtn.addEventListener('click', () => {
        subtabJobsBtn.classList.add('active');
        subtabAppsBtn.classList.remove('active');
        if (careersJobsSubView) careersJobsSubView.style.display = 'block';
        if (careersAppsSubView) careersAppsSubView.style.display = 'none';
      });
      subtabAppsBtn.addEventListener('click', () => {
        subtabAppsBtn.classList.add('active');
        subtabJobsBtn.classList.remove('active');
        if (careersJobsSubView) careersJobsSubView.style.display = 'none';
        if (careersAppsSubView) careersAppsSubView.style.display = 'block';
      });
    }

    // Careers Job Management Events
    const openCreateJobModalBtn = document.getElementById('openCreateJobModalBtn');
    if (openCreateJobModalBtn) openCreateJobModalBtn.addEventListener('click', openCreateJobModal);

    const reloadJobsBtn = document.getElementById('reloadJobsBtn');
    if (reloadJobsBtn) reloadJobsBtn.addEventListener('click', loadJobs);

    document.querySelectorAll('[data-job-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-job-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterJob = btn.getAttribute('data-job-status');
        renderJobsTable();
      });
    });

    const jobSearchInput = document.getElementById('jobSearchInput');
    if (jobSearchInput) {
      jobSearchInput.addEventListener('input', () => renderJobsTable());
    }

    // Job Modal Form & Overlay Events
    const jobModalOverlay = document.getElementById('jobModalOverlay');
    const closeJobModalBtn = document.getElementById('closeJobModalBtn');
    const cancelJobModalBtn = document.getElementById('cancelJobModalBtn');
    const jobPositionForm = document.getElementById('jobPositionForm');

    if (closeJobModalBtn) closeJobModalBtn.addEventListener('click', closeJobModal);
    if (cancelJobModalBtn) cancelJobModalBtn.addEventListener('click', closeJobModal);
    if (jobModalOverlay) {
      jobModalOverlay.addEventListener('click', (e) => {
        if (e.target === jobModalOverlay) closeJobModal();
      });
    }
    if (jobPositionForm) {
      jobPositionForm.addEventListener('submit', handleJobFormSubmit);
    }

    // Candidate Applications Management Events
    const reloadAppsBtn = document.getElementById('reloadAppsBtn');
    if (reloadAppsBtn) reloadAppsBtn.addEventListener('click', loadApplications);

    document.querySelectorAll('[data-app-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-app-status]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilterApp = btn.getAttribute('data-app-status');
        renderApplicationsTable();
      });
    });

    const appJobFilterSelect = document.getElementById('appJobFilterSelect');
    if (appJobFilterSelect) {
      appJobFilterSelect.addEventListener('change', () => {
        selectedAppJobFilter = appJobFilterSelect.value;
        renderApplicationsTable();
      });
    }

    const appSearchInput = document.getElementById('appSearchInput');
    if (appSearchInput) {
      appSearchInput.addEventListener('input', () => renderApplicationsTable());
    }

    // Application Detail Modal Events
    const appDetailModalOverlay = document.getElementById('appDetailModalOverlay');
    const closeAppDetailModalBtn = document.getElementById('closeAppDetailModalBtn');
    const closeAppDetailFooterBtn = document.getElementById('closeAppDetailFooterBtn');
    const saveAppDetailStatusBtn = document.getElementById('saveAppDetailStatusBtn');
    const downloadAppResumeBtn = document.getElementById('downloadAppResumeBtn');

    if (closeAppDetailModalBtn) closeAppDetailModalBtn.addEventListener('click', closeAppDetailModal);
    if (closeAppDetailFooterBtn) closeAppDetailFooterBtn.addEventListener('click', closeAppDetailModal);
    if (appDetailModalOverlay) {
      appDetailModalOverlay.addEventListener('click', (e) => {
        if (e.target === appDetailModalOverlay) closeAppDetailModal();
      });
    }
    if (saveAppDetailStatusBtn) saveAppDetailStatusBtn.addEventListener('click', handleSaveAppStatus);
    if (downloadAppResumeBtn) downloadAppResumeBtn.addEventListener('click', handleDownloadResume);
  }

  // ==========================================================================
  // 3. AUTHENTICATION HANDLERS
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
      showLogin();
      showToast('Signed out successfully.', 'info');
    }
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `tab-${tabId}`);
    });
  }

  // ==========================================================================
  // 4. DATA LOADING & METRICS
  // ==========================================================================
  async function refreshAllData() {
    await Promise.all([
      loadStats(),
      loadContacts(),
      loadBookings(),
      loadReviews(),
      loadSettings(),
      loadJobs(),
      loadApplications()
    ]);
  }

  async function loadStats() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const s = data.stats;
        document.getElementById('kpiNewContacts').textContent = s.newContacts;
        document.getElementById('kpiTotalContacts').textContent = s.totalContacts;
        document.getElementById('kpiPendingBookings').textContent = s.pendingBookings;
        document.getElementById('kpiConfirmedBookings').textContent = s.confirmedBookings;

        const pendingRevEl = document.getElementById('kpiPendingReviews');
        if (pendingRevEl) pendingRevEl.textContent = s.pendingReviews || 0;
        const appRevEl = document.getElementById('kpiApprovedReviews');
        if (appRevEl) appRevEl.textContent = s.approvedReviews || 0;

        const openPosEl = document.getElementById('kpiOpenPositions');
        if (openPosEl) openPosEl.textContent = s.openPositions || 0;
        const totalAppsEl = document.getElementById('kpiTotalApplications');
        if (totalAppsEl) totalAppsEl.textContent = s.totalApplications || 0;
        const careersBadge = document.getElementById('careersApplicationsBadge');
        if (careersBadge) careersBadge.textContent = s.pendingApplications || s.totalApplications || 0;

        // Health & Uptime
        const healthDot = document.getElementById('systemHealthDot');
        const healthText = document.getElementById('systemHealthText');
        if (s.dbStatus === 'connected') {
          healthDot.className = 'status-dot';
          healthText.textContent = 'System: MySQL Synchronized';
        } else {
          healthDot.className = 'status-dot degraded';
          healthText.textContent = 'System: Resilient File Fallback Active';
        }

        const uptimeLabel = document.getElementById('serverUptimeLabel');
        if (uptimeLabel) {
          const hrs = Math.floor(s.uptimeSeconds / 3600);
          const mins = Math.floor((s.uptimeSeconds % 3600) / 60);
          uptimeLabel.textContent = `${hrs}h ${mins}m active`;
        }
      }
    } catch (e) {
      console.error('Stats loading error', e);
    }
  }

  // ==========================================================================
  // 5. CONTACT INQUIRIES MANAGEMENT
  // ==========================================================================
  async function loadContacts() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        contactsList = data.contacts || [];
        const unreadCount = contactsList.filter(c => c.status === 'new').length;
        document.getElementById('unreadContactsBadge').textContent = unreadCount;
        renderContactsTable();
      }
    } catch (e) {
      showToast('Error loading contact inquiries.', 'error');
    }
  }

  function renderContactsTable() {
    const tbody = document.getElementById('contactsTableBody');
    if (!tbody) return;

    const search = (document.getElementById('contactSearchInput')?.value || '').toLowerCase().trim();

    let filtered = contactsList.filter(item => {
      // Status filter
      if (currentFilterContact !== 'all' && item.status !== currentFilterContact) {
        return false;
      }
      // Search filter
      if (search) {
        const str = `${item.reference_id} ${item.name} ${item.email} ${item.company || ''} ${item.subject || ''} ${item.message}`.toLowerCase();
        return str.includes(search);
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table-state">
            <div class="empty-icon">📭</div>
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-main); margin-bottom: 4px;">No contact inquiries found</div>
            <p style="font-size: 0.85rem;">Try adjusting the filter status or search term.</p>
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
            <div style="font-weight: 600; font-size: 0.86rem; color: #f1f5f9; margin-bottom: 4px;">${escapeHtml(c.subject || 'General Inquiry')}</div>
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
              <button class="btn-icon" title="Inspect &amp; Update Record" onclick="window.PUVIMA_ADMIN.openContactModal('${c.reference_id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="btn-icon" title="Mark as Responded" onclick="window.PUVIMA_ADMIN.quickStatusContact('${c.reference_id}', 'responded')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <button class="btn-icon danger" title="Delete Inquiry" onclick="window.PUVIMA_ADMIN.deleteContact('${c.reference_id}')">
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
  // 6. BOOKINGS MANAGEMENT
  // ==========================================================================
  async function loadBookings() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bookings`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        bookingsList = data.bookings || [];
        const pendingCount = bookingsList.filter(b => b.status === 'pending_review').length;
        document.getElementById('pendingBookingsBadge').textContent = pendingCount;
        renderBookingsTable();
      }
    } catch (e) {
      showToast('Error loading consultation bookings.', 'error');
    }
  }

  function renderBookingsTable() {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;

    const search = (document.getElementById('bookingSearchInput')?.value || '').toLowerCase().trim();

    let filtered = bookingsList.filter(item => {
      if (currentFilterBooking !== 'all' && item.status !== currentFilterBooking) {
        return false;
      }
      if (search) {
        const str = `${item.reference_id} ${item.name} ${item.email} ${item.company || ''} ${item.topic}`.toLowerCase();
        return str.includes(search);
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table-state">
            <div class="empty-icon">📅</div>
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-main); margin-bottom: 4px;">No consultation bookings found</div>
            <p style="font-size: 0.85rem;">Try adjusting the status filter or search parameters.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(b => {
      const statusClass = `status-${b.status || 'pending_review'}`;
      const statusLabel = (b.status || 'pending_review').replace('_', ' ');

      return `
        <tr>
          <td>
            <code style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-violet);">${escapeHtml(b.reference_id)}</code>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(b.name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(b.email)}</div>
            ${b.company ? `<div style="font-size: 0.76rem; color: var(--accent-teal);">${escapeHtml(b.company)}</div>` : ''}
          </td>
          <td>
            <div style="font-weight: 600; font-size: 0.86rem; color: #f1f5f9;">${escapeHtml(b.topic)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(b.meeting_format || 'Virtual Session')}</div>
          </td>
          <td>
            <div style="font-family: var(--font-mono); font-size: 0.86rem; font-weight: 600; color: var(--text-main);">${escapeHtml(b.preferred_date || 'TBD')}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(b.preferred_time || '')}</div>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="action-btn-group" style="justify-content: flex-end;">
              <button class="btn-icon" title="Inspect / Reschedule" onclick="window.PUVIMA_ADMIN.openBookingModal('${b.reference_id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="btn-icon" title="Confirm Consultation" onclick="window.PUVIMA_ADMIN.quickStatusBooking('${b.reference_id}', 'confirmed')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <button class="btn-icon danger" title="Remove Booking" onclick="window.PUVIMA_ADMIN.deleteBooking('${b.reference_id}')">
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
  // 7. MAIN PAGE SETTINGS MANAGEMENT
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
    document.getElementById('heroEyebrow').value = hero.eyebrow || '';
    document.getElementById('heroHeadlineMain').value = hero.headlineMain || 'Innovation.';
    document.getElementById('heroHeadlineGradient').value = hero.headlineGradient || 'Research. Excellence.';
    document.getElementById('heroSubhead').value = hero.subhead || '';

    // Contact
    const contact = s.contact || {};
    document.getElementById('contactEmailSetting').value = contact.email || 'advisory@puvima.com';
    document.getElementById('contactPhoneSetting').value = contact.phone || '+91 (0) 44 2810 5000';
    document.getElementById('contactHoursSetting').value = contact.hours || 'Mon – Fri: 09:00 – 18:00 IST';
    document.getElementById('contactLocationSetting').value = contact.location || 'Chennai & Bangalore, India';

    // Stats
    const stats = s.stats || {};
    document.getElementById('statConsultations').value = stats.consultationsDelivered || '120+';
    document.getElementById('statPrototypes').value = stats.activePrototypes || '18';
    document.getElementById('statDomains').value = stats.researchDomains || '4';
    document.getElementById('statSatisfaction').value = stats.clientSatisfaction || '99.4%';
  }

  async function handleSaveSettings() {
    const payload = {
      announcement: {
        enabled: document.getElementById('announcementEnabled').checked,
        badge: document.getElementById('announcementBadge').value.trim(),
        text: document.getElementById('announcementText').value.trim(),
        linkText: document.getElementById('announcementLinkText').value.trim(),
        linkUrl: document.getElementById('announcementLinkUrl').value.trim()
      },
      hero: {
        eyebrow: document.getElementById('heroEyebrow').value.trim(),
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
      }
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
        siteSettings = data.settings;
        showToast('Main page content updated and published live!', 'success');
      } else {
        showToast(data.message || 'Failed to save settings.', 'error');
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

  // ==========================================================================
  // 8. MODAL INSPECT & ACTION LOGIC
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
    modalSenderEmail.href = `mailto:${contact.email}?subject=PUVIMA Consultancy — Regarding your inquiry [${contact.reference_id}]`;

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

    modalMailtoBtn.href = `mailto:${contact.email}?subject=PUVIMA Advisory — Response to ${encodeURIComponent(contact.subject || 'Inquiry')} [${contact.reference_id}]&body=Dear ${encodeURIComponent(contact.name)},%0D%0A%0D%0AThank you for reaching out to PUVIMA Consultancy.%0D%0A%0D%0A---%0D%0AAdvisory Team%0D%0APUVIMA Consultancy`;

    modalOverlay.style.display = 'flex';
  }

  function openBookingModal(refId) {
    const booking = bookingsList.find(b => b.reference_id === refId);
    if (!booking) return;

    activeModalItem = { type: 'booking', data: booking };

    modalRefId.textContent = booking.reference_id;
    modalSubjectTitle.textContent = `Consultation: ${booking.topic}`;
    modalCreatedAt.textContent = new Date(booking.created_at || Date.now()).toLocaleString();
    modalSenderName.textContent = booking.name;
    modalSenderEmail.textContent = booking.email;
    modalSenderEmail.href = `mailto:${booking.email}?subject=PUVIMA Consultancy — Consultation Request [${booking.reference_id}]`;

    modalCompanyWrap.style.display = 'block';
    modalSenderCompany.textContent = booking.company || 'Private Client / Independent';

    modalMessageBody.textContent = `Format: ${booking.meeting_format}\nPreferred Schedule: ${booking.preferred_date} @ ${booking.preferred_time}\n\nClient Notes:\n${booking.message || 'No additional note provided.'}`;
    modalNotesInput.value = booking.admin_notes || '';

    modalStatusSelect.innerHTML = `
      <option value="pending_review">Pending Review</option>
      <option value="under_evaluation">Under Evaluation</option>
      <option value="confirmed">Confirmed (Meeting Locked)</option>
      <option value="rescheduled">Rescheduled</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    `;
    modalStatusSelect.value = booking.status || 'pending_review';

    modalStatusBadge.className = `status-pill status-${booking.status || 'pending_review'}`;
    modalStatusBadge.textContent = (booking.status || 'pending_review').replace('_', ' ').toUpperCase();

    modalMailtoBtn.href = `mailto:${booking.email}?subject=PUVIMA Consultation Confirmation [${booking.reference_id}]&body=Dear ${encodeURIComponent(booking.name)},%0D%0A%0D%0AWe are pleased to follow up regarding your consultation session on ${encodeURIComponent(booking.topic)}.%0D%0A%0D%0A---%0D%0APUVIMA Advisory Desk`;

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

    try {
      if (activeModalItem.type === 'contact') {
        const res = await fetch(`${API_BASE}/api/admin/contacts/${activeModalItem.data.reference_id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: newStatus, admin_notes: notes })
        });
        if (res.ok) {
          showToast('Contact record updated.', 'success');
          closeModal();
          loadContacts();
          loadStats();
        }
      } else if (activeModalItem.type === 'booking') {
        const res = await fetch(`${API_BASE}/api/admin/bookings/${activeModalItem.data.reference_id}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: newStatus, admin_notes: notes })
        });
        if (res.ok) {
          showToast('Consultation booking updated.', 'success');
          closeModal();
          loadBookings();
          loadStats();
        }
      }
    } catch (e) {
      showToast('Error saving record updates.', 'error');
    } finally {
      modalSaveActionBtn.disabled = false;
    }
  }

  // Quick Action Handlers for table rows
  async function quickStatusContact(refId, newStatus) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/${refId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Contact inquiry marked as ${newStatus}.`, 'success');
        loadContacts();
        loadStats();
      }
    } catch (e) {
      showToast('Error updating status.', 'error');
    }
  }

  async function deleteContact(refId) {
    if (!confirm(`Are you sure you want to permanently delete inquiry ${refId}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/${refId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        showToast('Inquiry deleted.', 'info');
        loadContacts();
        loadStats();
      }
    } catch (e) {
      showToast('Error deleting inquiry.', 'error');
    }
  }

  async function quickStatusBooking(refId, newStatus) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/bookings/${refId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Consultation marked as ${newStatus}.`, 'success');
        loadBookings();
        loadStats();
      }
    } catch (e) {
      showToast('Error updating booking.', 'error');
    }
  }

  async function deleteBooking(refId) {
    if (!confirm(`Are you sure you want to delete consultation booking ${refId}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/bookings/${refId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        showToast('Booking deleted.', 'info');
        loadBookings();
        loadStats();
      }
    } catch (e) {
      showToast('Error deleting booking.', 'error');
    }
  }

  // ==========================================================================
  // CUSTOMER REVIEWS MANAGEMENT & PUSH TO MAIN PAGE
  // ==========================================================================
  async function loadReviews() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        reviewsList = data.reviews || [];
        const pendingCount = reviewsList.filter(r => r.status === 'pending').length;
        const pendingBadge = document.getElementById('pendingReviewsBadge');
        if (pendingBadge) pendingBadge.textContent = pendingCount;
        renderReviewsTable();
      }
    } catch (e) {
      showToast('Error loading customer reviews.', 'error');
    }
  }

  function renderReviewsTable() {
    const tbody = document.getElementById('reviewsTableBody');
    if (!tbody) return;

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
          <td colspan="7" class="empty-table-state">
            <div class="empty-icon">⭐</div>
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-main); margin-bottom: 4px;">No reviews found</div>
            <p style="font-size: 0.85rem;">Reviews submitted from the main page will appear here for your review and approval.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const isApproved = r.status === 'approved';
      const statusClass = isApproved ? 'status-responded' : 'status-in_review';
      const statusLabel = isApproved ? 'Published on Main Page' : 'Pending Approval';
      const stars = '★'.repeat(Math.min(5, r.rating || 5));

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="../${escapeHtml(r.avatar_url || 'assets/images/team/member-1.svg')}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" onerror="this.src='../assets/images/team/member-1.svg'">
              <div>
                <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(r.name)}</div>
                ${r.company ? `<div style="font-size: 0.78rem; color: var(--accent-teal);">${escapeHtml(r.company)}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span style="text-transform: capitalize; font-weight: 600; font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(r.platform || 'Google')}</span>
          </td>
          <td>
            <span style="color: #f59e0b; font-size: 0.95rem; letter-spacing: 2px;">${stars}</span>
          </td>
          <td style="max-width: 320px;">
            <div style="font-size: 0.84rem; color: #e2e8f0; line-height: 1.5;">"${escapeHtml(r.review_text)}"</div>
          </td>
          <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
            ${escapeHtml(r.date_display || new Date(r.created_at).toLocaleDateString())}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="action-btn-group" style="justify-content: flex-end;">
              ${!isApproved ? `
                <button class="btn-primary" style="padding: 6px 12px; font-size: 0.78rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%);" title="Push Review to Main Page Carousel" onclick="window.PUVIMA_ADMIN.pushReviewToMainPage('${r.reference_id}')">
                  <span>🚀 Push to Main Page</span>
                </button>
              ` : `
                <button class="btn-ghost" style="padding: 6px 10px; font-size: 0.78rem;" title="Take Down from Main Page" onclick="window.PUVIMA_ADMIN.unpublishReview('${r.reference_id}')">
                  <span>Take Down</span>
                </button>
              `}
              <button class="btn-icon danger" title="Delete Review" onclick="window.PUVIMA_ADMIN.deleteReview('${r.reference_id}')">
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

  async function pushReviewToMainPage(id) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'approved' })
      });
      if (res.ok) {
        showToast('Review approved and pushed to the Main Page rotating showcase!', 'success');
        loadReviews();
        loadStats();
      } else {
        showToast('Failed to approve review.', 'error');
      }
    } catch (e) {
      showToast('Network error while pushing review.', 'error');
    }
  }

  async function unpublishReview(id) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'pending' })
      });
      if (res.ok) {
        showToast('Review unpublished from main page.', 'info');
        loadReviews();
        loadStats();
      }
    } catch (e) {
      showToast('Network error while updating review.', 'error');
    }
  }

  async function deleteReview(id) {
    if (!confirm('Are you sure you want to permanently delete this customer review?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        showToast('Review deleted.', 'info');
        loadReviews();
        loadStats();
      }
    } catch (e) {
      showToast('Error deleting review.', 'error');
    }
  }

  // ==========================================================================
  // 10. CAREERS & RECRUITMENT MANAGEMENT
  // ==========================================================================

  // --- JOB POSITIONS ---
  async function loadJobs() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/careers`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        jobsList = data.positions || [];
        const jobsCountBadge = document.getElementById('jobsCountBadge');
        if (jobsCountBadge) jobsCountBadge.textContent = jobsList.length;
        populateAppJobFilterDropdown();
        renderJobsTable();
      }
    } catch (e) {
      showToast('Error loading job positions.', 'error');
    }
  }

  function populateAppJobFilterDropdown() {
    const select = document.getElementById('appJobFilterSelect');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="all">All Configured Positions</option>';
    jobsList.forEach(job => {
      const opt = document.createElement('option');
      opt.value = String(job.id);
      opt.textContent = `${job.title} (${job.department})`;
      select.appendChild(opt);
    });
    if (jobsList.some(j => String(j.id) === currentVal)) {
      select.value = currentVal;
    }
  }

  function renderJobsTable() {
    const tbody = document.getElementById('jobsTableBody');
    if (!tbody) return;

    const search = (document.getElementById('jobSearchInput')?.value || '').toLowerCase().trim();

    let filtered = jobsList.filter(job => {
      if (currentFilterJob !== 'all' && job.status !== currentFilterJob) {
        return false;
      }
      if (search) {
        const str = `${job.id} ${job.title} ${job.department} ${job.work_arrangement} ${job.location || ''} ${job.required_skills || ''}`.toLowerCase();
        return str.includes(search);
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table-state">
            <div class="empty-icon">💼</div>
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-main); margin-bottom: 4px;">No job positions found</div>
            <p style="font-size: 0.85rem;">Click "Create Job Position" to configure technical roles for PUVIMA.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(job => {
      const statusClass = `status-${job.status || 'draft'}`;
      const statusLabel = (job.status || 'draft').toUpperCase();

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.92rem;">${escapeHtml(job.title)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
              <code style="font-family: var(--font-mono); color: var(--accent-teal);">ID #${job.id}</code>
              ${job.salary_range ? ` &bull; <span style="color: var(--accent-emerald);">${escapeHtml(job.salary_range)}</span>` : ''}
            </div>
          </td>
          <td>
            <span style="display: inline-block; background: rgba(99, 102, 241, 0.12); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 4px; padding: 2px 8px; font-size: 0.78rem; font-weight: 600;">
              ${escapeHtml(job.department)}
            </span>
          </td>
          <td>
            <div style="font-size: 0.84rem; color: var(--text-main); font-weight: 500;">
              ${escapeHtml(job.work_arrangement)} &bull; ${escapeHtml(job.employment_type || 'Full-time')}
            </div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(job.location || 'Chennai / Bangalore')}</div>
          </td>
          <td>
            <div style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(job.experience_level || 'Open')}</div>
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="action-btn-group" style="justify-content: flex-end;">
              <button class="btn-icon" title="Edit Position" onclick="window.PUVIMA_ADMIN.openEditJobModal('${job.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              ${job.status === 'published' ? `
                <button class="btn-icon" title="Unpublish / Set to Draft" onclick="window.PUVIMA_ADMIN.quickStatusJob('${job.id}', 'draft')">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                </button>
                <button class="btn-icon danger" title="Close Vacancy" onclick="window.PUVIMA_ADMIN.quickStatusJob('${job.id}', 'closed')">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </button>
              ` : `
                <button class="btn-icon" title="Publish on Careers Page" onclick="window.PUVIMA_ADMIN.quickStatusJob('${job.id}', 'published')">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openCreateJobModal() {
    const form = document.getElementById('jobPositionForm');
    if (form) form.reset();
    document.getElementById('jobModalPositionId').value = '';
    document.getElementById('jobModalTitle').textContent = 'Create New Job Position';
    document.getElementById('jobModalOverlay').style.display = 'flex';
  }

  function openEditJobModal(jobId) {
    const job = jobsList.find(j => String(j.id) === String(jobId));
    if (!job) return;

    document.getElementById('jobModalPositionId').value = job.id;
    document.getElementById('jobModalTitle').textContent = `Edit Position: ${job.title}`;
    document.getElementById('jobTitleInput').value = job.title || '';
    document.getElementById('jobDeptSelect').value = job.department || 'Software Development';
    document.getElementById('jobStatusSelect').value = job.status || 'draft';
    document.getElementById('jobTypeSelect').value = job.employment_type || 'Full-time';
    document.getElementById('jobArrangementSelect').value = job.work_arrangement || 'Hybrid';
    document.getElementById('jobExpInput').value = job.experience_level || '';
    document.getElementById('jobLocationInput').value = job.location || 'Chennai / Bangalore, India';
    document.getElementById('jobSalaryInput').value = job.salary_range || '';
    document.getElementById('jobDescInput').value = job.description || '';
    document.getElementById('jobRespInput').value = job.responsibilities || '';
    document.getElementById('jobSkillsInput').value = job.required_skills || '';

    document.getElementById('jobModalOverlay').style.display = 'flex';
  }

  function closeJobModal() {
    const overlay = document.getElementById('jobModalOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  async function handleJobFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('jobModalPositionId').value;
    const saveBtn = document.getElementById('saveJobModalBtn');

    const payload = {
      title: document.getElementById('jobTitleInput').value.trim(),
      department: document.getElementById('jobDeptSelect').value,
      status: document.getElementById('jobStatusSelect').value,
      employment_type: document.getElementById('jobTypeSelect').value,
      work_arrangement: document.getElementById('jobArrangementSelect').value,
      experience_level: document.getElementById('jobExpInput').value.trim(),
      location: document.getElementById('jobLocationInput').value.trim(),
      salary_range: document.getElementById('jobSalaryInput').value.trim() || null,
      description: document.getElementById('jobDescInput').value.trim(),
      responsibilities: document.getElementById('jobRespInput').value.trim() || null,
      required_skills: document.getElementById('jobSkillsInput').value.trim() || null
    };

    if (!payload.title || !payload.description) {
      showToast('Job Title and Role Overview are required.', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>Saving...</span>';

    try {
      const url = id ? `${API_BASE}/api/admin/careers/${id}` : `${API_BASE}/api/admin/careers`;
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(id ? 'Job position updated successfully.' : 'Job position created successfully.', 'success');
        closeJobModal();
        loadJobs();
        loadStats();
      } else {
        showToast(data.message || 'Failed to save job position.', 'error');
      }
    } catch (err) {
      showToast('Network error while saving job position.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>Save Job Position</span>';
    }
  }

  async function quickStatusJob(jobId, newStatus) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/careers/${jobId}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Position status updated to ${newStatus}.`, 'success');
        loadJobs();
        loadStats();
      } else {
        showToast('Error updating position status.', 'error');
      }
    } catch (e) {
      showToast('Network error while updating position.', 'error');
    }
  }

  // --- CANDIDATE APPLICATIONS ---
  async function loadApplications() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/applications`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        applicationsList = data.applications || [];
        const appsCountBadge = document.getElementById('appsCountBadge');
        if (appsCountBadge) appsCountBadge.textContent = applicationsList.length;
        const careersBadge = document.getElementById('careersApplicationsBadge');
        const unreviewed = applicationsList.filter(a => a.recruitment_status === 'received').length;
        if (careersBadge) careersBadge.textContent = unreviewed;
        renderApplicationsTable();
      }
    } catch (e) {
      showToast('Error loading candidate applications.', 'error');
    }
  }

  function renderApplicationsTable() {
    const tbody = document.getElementById('applicationsTableBody');
    if (!tbody) return;

    const search = (document.getElementById('appSearchInput')?.value || '').toLowerCase().trim();

    let filtered = applicationsList.filter(app => {
      if (currentFilterApp !== 'all' && app.recruitment_status !== currentFilterApp) {
        return false;
      }
      if (selectedAppJobFilter !== 'all' && String(app.job_position_id) !== String(selectedAppJobFilter)) {
        return false;
      }
      if (search) {
        const str = `${app.reference_id || ''} ${app.applicant_name} ${app.applicant_email} ${app.applicant_phone || ''} ${app.position_title || ''} ${app.skills || ''}`.toLowerCase();
        return str.includes(search);
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-table-state">
            <div class="empty-icon">📁</div>
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-main); margin-bottom: 4px;">No candidate applications found</div>
            <p style="font-size: 0.85rem;">Applications submitted by candidates will appear here.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(app => {
      const statusClass = `status-${app.recruitment_status || 'received'}`;
      const statusLabel = (app.recruitment_status || 'received').replace('_', ' ').toUpperCase();
      const submittedDate = new Date(app.created_at || Date.now()).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.92rem;">${escapeHtml(app.applicant_name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 1px;">
              ${escapeHtml(app.applicant_email)} &bull; ${escapeHtml(app.applicant_phone)}
            </div>
            <div style="margin-top: 2px;">
              <code style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--accent-teal);">${escapeHtml(app.reference_id || 'APP-' + app.id)}</code>
            </div>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 0.86rem; color: #f1f5f9;">${escapeHtml(app.position_title || 'Position #' + app.job_position_id)}</div>
            ${app.education ? `<div style="font-size: 0.76rem; color: var(--accent-violet); margin-top: 2px;">${escapeHtml(app.education)}</div>` : ''}
          </td>
          <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
            ${submittedDate}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="action-btn-group" style="justify-content: flex-end;">
              <button class="btn-icon" title="Inspect Candidate &amp; Resume" onclick="window.PUVIMA_ADMIN.openAppDetailModal('${app.id}')">
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

  function openAppDetailModal(appId) {
    const app = applicationsList.find(a => String(a.id) === String(appId));
    if (!app) return;

    activeAppItem = app;

    document.getElementById('appDetailApplicantName').textContent = app.applicant_name;
    const badge = document.getElementById('appDetailStatusBadge');
    badge.className = `status-pill status-${app.recruitment_status || 'received'}`;
    badge.textContent = (app.recruitment_status || 'received').replace('_', ' ').toUpperCase();

    document.getElementById('appDetailRefId').textContent = app.reference_id || ('APP-' + app.id);
    document.getElementById('appDetailPositionTitle').textContent = app.position_title || ('Position #' + app.job_position_id);
    document.getElementById('appDetailCreatedAt').textContent = new Date(app.created_at || Date.now()).toLocaleString();

    const emailLink = document.getElementById('appDetailEmailLink');
    emailLink.textContent = app.applicant_email;
    emailLink.href = `mailto:${app.applicant_email}?subject=PUVIMA Consultancy — Application for ${encodeURIComponent(app.position_title || 'Technical Position')} [${app.reference_id || app.id}]`;

    document.getElementById('appDetailPhone').textContent = app.applicant_phone || 'N/A';
    document.getElementById('appDetailEducationExp').textContent = `${app.education || 'N/A'}${app.years_of_experience ? ` • ${app.years_of_experience} yrs exp` : ''}`;

    // Links Row
    const linksRow = document.getElementById('appDetailLinksRow');
    const linkedinWrap = document.getElementById('appDetailLinkedinWrap');
    const linkedinLink = document.getElementById('appDetailLinkedinLink');
    const portfolioWrap = document.getElementById('appDetailPortfolioWrap');
    const portfolioLink = document.getElementById('appDetailPortfolioLink');

    let hasLink = false;
    if (app.linkedin_url) {
      hasLink = true;
      linkedinWrap.style.display = 'block';
      linkedinLink.href = app.linkedin_url;
    } else {
      linkedinWrap.style.display = 'none';
    }

    if (app.portfolio_url) {
      hasLink = true;
      portfolioWrap.style.display = 'block';
      portfolioLink.href = app.portfolio_url;
    } else {
      portfolioWrap.style.display = 'none';
    }

    if (linksRow) linksRow.style.display = hasLink ? 'flex' : 'none';

    // Skills
    const skillsList = document.getElementById('appDetailSkillsList');
    if (skillsList) {
      skillsList.innerHTML = '';
      const skillsArray = Array.isArray(app.skills) ? app.skills : (app.skills ? String(app.skills).split(',').map(s => s.trim()).filter(Boolean) : []);
      if (skillsArray.length > 0) {
        skillsArray.forEach(sk => {
          const pill = document.createElement('span');
          pill.className = 'tab-pill';
          pill.style.cssText = 'background: rgba(14, 165, 233, 0.12); color: var(--accent-teal); border: 1px solid rgba(14, 165, 233, 0.25); padding: 3px 8px; border-radius: 4px; font-size: 0.76rem; font-weight: 500;';
          pill.textContent = sk;
          skillsList.appendChild(pill);
        });
      } else {
        skillsList.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">None provided</span>';
      }
    }

    // Cover letter
    document.getElementById('appDetailCoverLetterBody').textContent = app.cover_letter || 'No cover letter or message was provided.';

    // Resume meta
    document.getElementById('appDetailResumeFileName').textContent = app.resume_original_name || 'Resume_Document.pdf';
    document.getElementById('appDetailResumeMeta').textContent = `${app.resume_size_bytes ? formatBytes(app.resume_size_bytes) : 'Document'} • ${app.resume_mime_type || 'Securely Stored in Private Vault'}`;

    // Status & Notes
    document.getElementById('appDetailStatusSelect').value = app.recruitment_status || 'received';
    document.getElementById('appDetailAdminNotes').value = app.admin_notes || '';

    document.getElementById('appDetailModalOverlay').style.display = 'flex';
  }

  function closeAppDetailModal() {
    const overlay = document.getElementById('appDetailModalOverlay');
    if (overlay) overlay.style.display = 'none';
    activeAppItem = null;
  }

  async function handleSaveAppStatus() {
    if (!activeAppItem) return;
    const newStatus = document.getElementById('appDetailStatusSelect').value;
    const notes = document.getElementById('appDetailAdminNotes').value.trim();
    const btn = document.getElementById('saveAppDetailStatusBtn');

    btn.disabled = true;
    btn.innerHTML = '<span>Updating...</span>';

    try {
      const res = await fetch(`${API_BASE}/api/admin/applications/${activeAppItem.id}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ recruitment_status: newStatus, admin_notes: notes })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Candidate recruitment status updated.', 'success');
        closeAppDetailModal();
        loadApplications();
        loadStats();
      } else {
        showToast(data.message || 'Failed to update recruitment status.', 'error');
      }
    } catch (e) {
      showToast('Network error while updating application status.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>Update Candidate Status</span>';
    }
  }

  async function handleDownloadResume() {
    if (!activeAppItem) return;
    const btn = document.getElementById('downloadAppResumeBtn');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span>Retrieving...</span>';

    try {
      const res = await fetch(`${API_BASE}/api/admin/applications/${activeAppItem.id}/resume`, {
        headers: { 'Authorization': `Bearer ${getStoredToken()}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.message || 'Unable to retrieve resume file from private storage.', 'error');
        return;
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = activeAppItem.resume_original_name || `resume_${activeAppItem.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
      showToast('Resume downloaded securely.', 'success');
    } catch (err) {
      showToast('Network error downloading resume.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
  window.PUVIMA_ADMIN = {
    openContactModal,
    openBookingModal,
    quickStatusContact,
    quickStatusBooking,
    deleteContact,
    deleteBooking,
    pushReviewToMainPage,
    unpublishReview,
    deleteReview,
    openCreateJobModal,
    openEditJobModal,
    quickStatusJob,
    openAppDetailModal
  };

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
