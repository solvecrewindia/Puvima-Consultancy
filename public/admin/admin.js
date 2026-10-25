/**
 * PUVIMA Consultancy — Executive Administration Portal Controller
 * Full client-side management logic for authentication, inquiries review, bookings, and site configuration.
 */

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
  })(); // Configurable or relative to origin

  // State
  let currentAdmin = null;
  let contactsList = [];
  let reviewsList = [];
  let siteSettings = {};
  let currentFilterContact = 'all';
  let currentFilterReview = 'all';
  let activeModalItem = null; // { type: 'contact', data }

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

    if (tabId === 'contacts') {
      loadContacts();
      loadStats();
    } else if (tabId === 'reviews') {
      loadReviews();
      loadStats();
    } else if (tabId === 'overview') {
      loadStats();
    } else if (tabId === 'settings') {
      loadSettings();
    }
  }

  // ==========================================================================
  // 4. DATA LOADING & METRICS
  // ==========================================================================
  async function refreshAllData() {
    await Promise.all([
      loadStats(),
      loadContacts(),
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
        document.getElementById('kpiNewContacts').textContent = s.newContacts;
        document.getElementById('kpiTotalContacts').textContent = s.totalContacts;

        const pendingRevEl = document.getElementById('kpiPendingReviews');
        if (pendingRevEl) pendingRevEl.textContent = s.pendingReviews || 0;
        const appRevEl = document.getElementById('kpiApprovedReviews');
        if (appRevEl) appRevEl.textContent = s.approvedReviews || 0;


        // Health & Uptime
        const healthDot = document.getElementById('systemHealthDot');
        const healthText = document.getElementById('systemHealthText');
        const storageEngineLabel = document.getElementById('storageEngineLabel');

        if (s.dbProvider === 'supabase_postgres') {
          if (healthDot) healthDot.className = 'status-dot';
          if (healthText) healthText.textContent = 'System: Supabase Cloud Connected';
          if (storageEngineLabel) storageEngineLabel.textContent = 'Supabase PostgreSQL (Cloud: jarrtmqdhfcijarbuntl)';
        } else if (s.dbStatus === 'connected') {
          if (healthDot) healthDot.className = 'status-dot';
          if (healthText) healthText.textContent = 'System: MySQL Synchronized';
          if (storageEngineLabel) storageEngineLabel.textContent = 'MySQL Enterprise Database';
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
              <button class="btn-icon" title="Inspect &amp; Update Record" onclick="window.PUVIMA_ADMIN.openContactModal('${c.reference_id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <button class="btn-icon" title="Mark as Responded" onclick="window.PUVIMA_ADMIN.quickStatusContact('${c.reference_id}', 'responded', this)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <button class="btn-icon danger" title="Delete Inquiry" onclick="window.PUVIMA_ADMIN.deleteContact('${c.reference_id}', this)">
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
    const heroEyebrowEl = document.getElementById('heroEyebrow');
    if (heroEyebrowEl) heroEyebrowEl.value = hero.eyebrow || '';
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
        const res = await fetch(`${API_BASE}/api/admin/contacts/${refId}`, {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({ status: newStatus, admin_notes: notes })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Contact record updated successfully.', 'success');
          // Update local memory in place
          const contact = contactsList.find(c => c.reference_id === refId);
          if (contact) {
            contact.status = newStatus;
            contact.admin_notes = notes;
          }
          closeModal();
          renderContactsTable();
          loadStats();
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
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/${refId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Contact inquiry marked as ${newStatus}.`, 'success');
        const contact = contactsList.find(c => c.reference_id === refId);
        if (contact) contact.status = newStatus;
        renderContactsTable();
        loadStats();
      } else {
        showToast((data && data.message) || 'Error updating status.', 'error');
        if (btn) btn.disabled = false;
      }
    } catch (e) {
      showToast('Error updating status.', 'error');
      if (btn) btn.disabled = false;
    }
  }

  async function deleteContact(refId, btn) {
    if (!confirm(`Are you sure you want to permanently delete inquiry ${refId}?`)) return;
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/api/admin/contacts/${refId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Inquiry permanently removed.', 'info');
        contactsList = contactsList.filter(c => c.reference_id !== refId);
        renderContactsTable();
        loadStats();
      } else {
        showToast((data && data.message) || 'Error deleting inquiry.', 'error');
        if (btn) btn.disabled = false;
      }
    } catch (e) {
      showToast('Error deleting inquiry.', 'error');
      if (btn) btn.disabled = false;
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
          <td colspan="6" class="empty-table-state">
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
      const initials = (function(name) {
        if (!name) return 'CL';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      })(r.name);

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #0072ce 0%, #0284c7 100%); color: #fff; font-weight: 700; font-size: 0.82rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0, 114, 206, 0.25);">
                ${initials}
              </div>
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
            ${escapeHtml(r.date_display || new Date(r.created_at).toLocaleDateString())}
          </td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
          <td>
            <div class="action-btn-group" style="justify-content: flex-end;">
              ${!isApproved ? `
                <button class="btn-primary" style="padding: 6px 12px; font-size: 0.78rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); cursor: pointer;" title="Push Review to Main Page Carousel" onclick="window.PUVIMA_ADMIN.pushReviewToMainPage('${r.reference_id || r.id}', this)">
                  <span>🚀 Push to Main Page</span>
                </button>
              ` : `
                <button class="btn-ghost" style="padding: 6px 10px; font-size: 0.78rem; cursor: pointer;" title="Take Down from Main Page" onclick="window.PUVIMA_ADMIN.unpublishReview('${r.reference_id || r.id}', this)">
                  <span>Take Down</span>
                </button>
              `}
              <button class="btn-icon danger" title="Delete Review" onclick="window.PUVIMA_ADMIN.deleteReview('${r.reference_id || r.id}', this)">
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
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Publishing...</span>';
    }
    // Optimistically update memory so UI updates immediately
    const rev = reviewsList.find(x => x.reference_id === id || String(x.id) === String(id));
    const previousStatus = rev ? rev.status : 'pending';
    if (rev) rev.status = 'approved';
    renderReviewsTable();

    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'approved' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Review approved and published to live homepage!', 'success');
        loadStats();
      } else {
        if (rev) rev.status = previousStatus;
        renderReviewsTable();
        showToast((data && data.message) || 'Failed to approve review.', 'error');
      }
    } catch (e) {
      if (rev) rev.status = previousStatus;
      renderReviewsTable();
      showToast('Network error while pushing review.', 'error');
    }
  }

  async function unpublishReview(id, btn) {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Taking Down...</span>';
    }
    // Optimistically update memory so UI updates immediately
    const rev = reviewsList.find(x => x.reference_id === id || String(x.id) === String(id));
    const previousStatus = rev ? rev.status : 'approved';
    if (rev) rev.status = 'pending';
    renderReviewsTable();

    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status: 'pending' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Review taken down from main page.', 'info');
        loadStats();
      } else {
        if (rev) rev.status = previousStatus;
        renderReviewsTable();
        showToast((data && data.message) || 'Failed to update review.', 'error');
      }
    } catch (e) {
      if (rev) rev.status = previousStatus;
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
      renderReviewsTable();
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Review permanently removed.', 'info');
        loadStats();
      } else {
        if (removedItem) {
          reviewsList.splice(deletedIndex, 0, removedItem);
          renderReviewsTable();
        }
        showToast((data && data.message) || 'Error deleting review.', 'error');
      }
    } catch (e) {
      if (removedItem) {
        reviewsList.splice(deletedIndex, 0, removedItem);
        renderReviewsTable();
      }
      showToast('Error deleting review.', 'error');
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
    switchTab,
    openContactModal,
    quickStatusContact,
    deleteContact,
    pushReviewToMainPage,
    unpublishReview,
    deleteReview
  };

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
