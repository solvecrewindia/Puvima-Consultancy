/**
 * PUVIMA Consultancy — Executive Administration Controller
 * SuperAdmin & Admin portal views, user lifecycle & metrics
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Enforce SuperAdmin/Admin access
  const currentUser = window.Auth.requireAuth(['Admin', 'SuperAdmin']);
  if (!currentUser) return;

  let currentTab = 'overview';
  let allUsers = [];
  let allProjects = [];
  let allApplications = [];
  let appStats = { total: 0, new: 0, under_review: 0, shortlisted: 0, interview: 0, selected: 0, rejected: 0, unread_by_hr: 0 };
  let adminAppFilterStatus = 'all';
  let adminAppFilterRole = 'all';
  let adminAppFilterDate = '';
  let adminAppSearchQuery = '';

  function getAdminPortalHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'x-portal-user-role': currentUser.role || 'SuperAdmin',
      'x-portal-user-id': currentUser.userId || currentUser.id || 'ADM001',
      'x-portal-user-name': encodeURIComponent(currentUser.name || 'System Administrator')
    };
    const token = localStorage.getItem('puvima_admin_token') || sessionStorage.getItem('puvima_admin_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async function fetchAdminApplicationsData() {
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch('/api/admin/internship-applications/stats', { headers: getAdminPortalHeaders() }),
        fetch('/api/admin/internship-applications?limit=300', { headers: getAdminPortalHeaders() })
      ]);

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.stats) {
          appStats = statsJson.stats;
        }
      }

      if (listRes.ok) {
        const listJson = await listRes.json();
        if (listJson.success && Array.isArray(listJson.applications)) {
          allApplications = listJson.applications;
        }
      }
    } catch (err) {
      console.warn('[adminController] Error fetching applications:', err);
    }
  }

  // Tab Switching
  document.querySelectorAll('[data-admin-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      currentTab = tabBtn.getAttribute('data-admin-tab');
      renderCurrentTab();
    });
  });

  // Search & Filter listeners
  const searchInput = document.getElementById('adminSearchInput');
  const deptFilter = document.getElementById('adminDeptFilter');

  if (searchInput) {
    searchInput.addEventListener('input', () => renderCurrentTab());
  }
  if (deptFilter) {
    deptFilter.addEventListener('change', () => renderCurrentTab());
  }

  // Load Initial Data
  await loadData();

  async function loadData() {
    if (window.UI) window.UI.showLoading('Loading Executive Portal...');
    try {
      allUsers = await window.UserService.getUsers();
      allProjects = await window.ProjectService.getProjects();
      await fetchAdminApplicationsData();
      updateStatCards();
      renderCurrentTab();
    } catch (e) {
      if (window.UI) window.UI.showToast('Data Error', 'Unable to load executive metrics.', 'error');
    } finally {
      if (window.UI) window.UI.hideLoading();
    }
  }

  function updateStatCards() {
    const hrCount = allUsers.filter((u) => String(u.role).toLowerCase() === 'hr').length;
    const empCount = allUsers.filter((u) => String(u.role).toLowerCase() === 'employee').length;
    const intCount = allUsers.filter((u) => String(u.role).toLowerCase() === 'intern').length;
    const projCount = allProjects.length;

    const elHr = document.getElementById('statTotalHR');
    const elEmp = document.getElementById('statTotalEmployees');
    const elInt = document.getElementById('statTotalInterns');
    const elProj = document.getElementById('statTotalProjects');

    if (elHr) elHr.textContent = hrCount;
    if (elEmp) elEmp.textContent = empCount;
    if (elInt) elInt.textContent = intCount;
    if (elProj) elProj.textContent = projCount;

    // Update tab counters
    const countAll = document.getElementById('countAllUsers');
    const countHr = document.getElementById('countHrUsers');
    const countEmp = document.getElementById('countEmpUsers');
    const countInt = document.getElementById('countIntUsers');
    const countProj = document.getElementById('countProjects');
    const countApps = document.getElementById('countInternshipApps');
    const adminNavBadge = document.getElementById('adminNewAppsNavBadge');

    if (countAll) countAll.textContent = allUsers.length;
    if (countHr) countHr.textContent = hrCount;
    if (countEmp) countEmp.textContent = empCount;
    if (countInt) countInt.textContent = intCount;
    if (countProj) countProj.textContent = projCount;
    if (countApps) countApps.textContent = appStats.total || allApplications.length;
    if (adminNavBadge) {
      const newCount = appStats.new || 0;
      adminNavBadge.textContent = newCount;
      adminNavBadge.style.display = newCount > 0 ? 'inline-block' : 'none';
    }
  }

  function getFilteredUsers(roleFilter = null) {
    let list = [...allUsers];
    if (roleFilter) {
      list = list.filter((u) => String(u.role).toLowerCase() === String(roleFilter).toLowerCase());
    }

    const s = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const dept = deptFilter ? deptFilter.value : '';

    if (dept) {
      list = list.filter((u) => u.department === dept);
    }

    if (s) {
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(s)) ||
          (u.email && u.email.toLowerCase().includes(s)) ||
          (u.user_code && u.user_code.toLowerCase().includes(s))
      );
    }

    return list;
  }

  function getAdminAppStatusBadge(status) {
    const s = String(status || 'New').trim();
    switch (s) {
      case 'New':
        return '<span class="badge badge-blue"><span style="width:6px;height:6px;border-radius:50%;background:#0072ce;display:inline-block;"></span>New</span>';
      case 'Under Review':
        return '<span class="badge badge-amber">Under Review</span>';
      case 'Shortlisted':
        return '<span class="badge badge-violet">Shortlisted</span>';
      case 'Interview':
        return '<span class="badge badge-blue" style="background:#e0f2fe;color:#0284c7;border-color:#bae6fd;">Interview</span>';
      case 'Selected':
        return '<span class="badge badge-emerald">Selected</span>';
      case 'Rejected':
        return '<span class="badge badge-rose">Rejected</span>';
      default:
        return `<span class="badge badge-slate">${window.UI.escapeHtml(s)}</span>`;
    }
  }

  function getFilteredAdminApplications() {
    let list = [...allApplications];

    if (adminAppFilterStatus && adminAppFilterStatus !== 'all') {
      list = list.filter((a) => {
        const s = String(a.recruitment_status || 'New').toLowerCase();
        return s === adminAppFilterStatus.toLowerCase();
      });
    }

    if (adminAppFilterRole && adminAppFilterRole !== 'all') {
      list = list.filter((a) => a.internship_role === adminAppFilterRole);
    }

    if (adminAppFilterDate) {
      list = list.filter((a) => (a.created_at || '').slice(0, 10) === adminAppFilterDate);
    }

    if (adminAppSearchQuery && adminAppSearchQuery.trim()) {
      const q = adminAppSearchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.full_name && a.full_name.toLowerCase().includes(q)) ||
          (a.email && a.email.toLowerCase().includes(q)) ||
          (a.phone && a.phone.toLowerCase().includes(q)) ||
          (a.reference_id && a.reference_id.toLowerCase().includes(q)) ||
          (a.college && a.college.toLowerCase().includes(q))
      );
    }

    return list;
  }

  function renderCurrentTab() {
    const tableBody = document.getElementById('adminTableBody');
    const tableHead = document.getElementById('adminTableHead');
    const overviewSection = document.getElementById('adminAppsOverviewSection');
    const userFilterGroup = document.getElementById('adminUserFilterGroup');
    const appsFilterGroup = document.getElementById('adminAppsFilterGroup');
    const breadcrumb = document.getElementById('headerBreadcrumbTitle');

    if (!tableBody || !tableHead) return;

    if (currentTab === 'applications') {
      if (overviewSection) overviewSection.style.display = 'block';
      if (userFilterGroup) userFilterGroup.style.display = 'none';
      if (appsFilterGroup) appsFilterGroup.style.display = 'flex';
      if (breadcrumb) breadcrumb.textContent = 'New Applications Management';

      // 1. Render 7 Status Metric Cards
      if (overviewSection) {
        overviewSection.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
            <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #0072ce; ${adminAppFilterStatus === 'all' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterAdminAppsByStatus('all')">
              <div class="stat-info">
                <span class="stat-label" style="font-size: 11px;">Total Applications</span>
                <span class="stat-value" style="font-size: 20px;">${appStats.total || allApplications.length}</span>
                <span class="stat-desc" style="font-size: 11px;">All submissions</span>
              </div>
            </div>

            <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #0284c7; ${adminAppFilterStatus === 'New' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterAdminAppsByStatus('New')">
              <div class="stat-info">
                <span class="stat-label" style="font-size: 11px;">New Applications</span>
                <span class="stat-value" style="font-size: 20px; color: #0284c7;">${appStats.new || 0}</span>
                <span class="stat-desc" style="font-size: 11px;">Awaiting action</span>
              </div>
            </div>

            <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #d97706; ${adminAppFilterStatus === 'Under Review' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterAdminAppsByStatus('Under Review')">
              <div class="stat-info">
                <span class="stat-label" style="font-size: 11px;">Under Review</span>
                <span class="stat-value" style="font-size: 20px; color: #d97706;">${appStats.under_review || 0}</span>
                <span class="stat-desc" style="font-size: 11px;">HR / Evaluation</span>
              </div>
            </div>

            <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #7c3aed; ${adminAppFilterStatus === 'Shortlisted' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterAdminAppsByStatus('Shortlisted')">
              <div class="stat-info">
                <span class="stat-label" style="font-size: 11px;">Shortlisted</span>
                <span class="stat-value" style="font-size: 20px; color: #7c3aed;">${appStats.shortlisted || 0}</span>
                <span class="stat-desc" style="font-size: 11px;">Screened</span>
              </div>
            </div>

            <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #0284c7; ${adminAppFilterStatus === 'Interview' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterAdminAppsByStatus('Interview')">
              <div class="stat-info">
                <span class="stat-label" style="font-size: 11px;">Interview</span>
                <span class="stat-value" style="font-size: 20px; color: #0284c7;">${appStats.interview || 0}</span>
                <span class="stat-desc" style="font-size: 11px;">Technical round</span>
              </div>
            </div>

            <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #059669; ${adminAppFilterStatus === 'Selected' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterAdminAppsByStatus('Selected')">
              <div class="stat-info">
                <span class="stat-label" style="font-size: 11px;">Selected</span>
                <span class="stat-value" style="font-size: 20px; color: #059669;">${appStats.selected || 0}</span>
                <span class="stat-desc" style="font-size: 11px;">Offer extended</span>
              </div>
            </div>

            <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #dc2626; ${adminAppFilterStatus === 'Rejected' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterAdminAppsByStatus('Rejected')">
              <div class="stat-info">
                <span class="stat-label" style="font-size: 11px;">Rejected</span>
                <span class="stat-value" style="font-size: 20px; color: #dc2626;">${appStats.rejected || 0}</span>
                <span class="stat-desc" style="font-size: 11px;">Closed</span>
              </div>
            </div>
          </div>
        `;
      }

      // 2. Render Table Headers
      tableHead.innerHTML = `
        <tr>
          <th>Reference ID</th>
          <th>Applicant Name</th>
          <th>Email Address</th>
          <th>Internship Role</th>
          <th>Submitted Date</th>
          <th>HR Review Status</th>
          <th>Application Status</th>
          <th style="text-align: right;">Action</th>
        </tr>
      `;

      // 3. Render Table Rows
      const apps = getFilteredAdminApplications();
      const countIndicator = document.getElementById('adminAppsCountIndicator');
      if (countIndicator) {
        countIndicator.textContent = `Showing ${apps.length} of ${allApplications.length} applications`;
      }

      if (apps.length === 0) {
        tableBody.innerHTML = `
          <tr><td colspan="8" style="text-align: center; padding: 36px; color: var(--text-dim);">
            No internship applications found matching the search/filter criteria.
          </td></tr>
        `;
        return;
      }

      tableBody.innerHTML = apps
        .map((app) => {
          const isReviewed = Boolean(app.is_reviewed_by_hr);
          return `
            <tr id="admin-app-row-${app.id}" data-row-id="${app.id}" data-ref="${window.UI.escapeHtml(app.reference_id)}">
              <td>
                <span style="font-family: monospace; font-size: 12px; font-weight: 600; color: var(--puvima-blue);">${window.UI.escapeHtml(app.reference_id)}</span>
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <strong style="color: var(--text-main);">${window.UI.escapeHtml(app.full_name)}</strong>
                  ${!isReviewed ? `<span class="badge badge-rose" style="font-size: 9px; padding: 1px 6px; font-weight: 700;">NEW</span>` : ''}
                </div>
              </td>
              <td>
                <a href="mailto:${window.UI.escapeHtml(app.email)}" style="color: var(--puvima-blue); text-decoration: none;">${window.UI.escapeHtml(app.email)}</a>
              </td>
              <td>
                <span class="badge badge-slate" style="font-size: 11px;">${window.UI.escapeHtml(app.internship_role)}</span>
              </td>
              <td>
                <span style="font-size: 12px; color: var(--text-muted);">${window.UI.formatDate(app.created_at)}</span>
              </td>
              <td>
                ${
                  isReviewed
                    ? `<span class="badge badge-emerald" style="font-size: 11px;">&#10003; Reviewed (${window.UI.escapeHtml(app.hr_reviewed_by || 'HR')})</span>`
                    : `<span class="badge badge-amber" style="font-size: 11px;">&#9888; Pending HR</span>`
                }
              </td>
              <td class="admin-app-status-cell">
                ${getAdminAppStatusBadge(app.recruitment_status)}
              </td>
              <td style="text-align: right; white-space: nowrap;">
                <button type="button" class="btn btn-sm btn-primary action-btn-view" data-action="view-dossier" data-id="${app.id}" data-ref="${app.reference_id}" onclick="window.viewAdminApplicationDetails('${app.id}')" title="View Dossier & History" style="padding: 4px 10px; font-size: 12px;">
                  View Dossier
                </button>
                <button type="button" class="btn btn-sm btn-outline action-btn-resume" data-action="view-resume" data-id="${app.id}" data-ref="${app.reference_id}" onclick="window.viewAdminApplicationResume('${app.reference_id || app.id}')" title="View Resume" style="padding: 4px 8px; font-size: 12px; margin-left: 4px;">
                  Resume
                </button>
                <button type="button" class="btn btn-sm btn-secondary action-btn-status" data-action="update-status" data-id="${app.id}" data-ref="${app.reference_id}" onclick="window.openAdminStatusModal('${app.reference_id || app.id}')" title="Update Status & Notes" style="padding: 4px 8px; font-size: 12px; margin-left: 4px;">
                  Status
                </button>
              </td>
            </tr>
          `;
        })
        .join('');

      // Delegated click handler on table body
      if (tableBody && !tableBody.dataset.adminAppsBound) {
        tableBody.dataset.adminAppsBound = 'true';
        tableBody.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-action]');
          if (!btn) return;
          e.preventDefault();
          const action = btn.getAttribute('data-action');
          const id = btn.getAttribute('data-ref') || btn.getAttribute('data-id');
          if (!id) return;
          if (action === 'view-dossier') window.viewAdminApplicationDetails(id);
          else if (action === 'view-resume') window.viewAdminApplicationResume(id);
          else if (action === 'update-status') window.openAdminStatusModal(id);
        });
      }
      return;
    }

    // Restore standard view for other tabs
    if (overviewSection) overviewSection.style.display = 'none';
    if (userFilterGroup) userFilterGroup.style.display = 'flex';
    if (appsFilterGroup) appsFilterGroup.style.display = 'none';
    if (breadcrumb) breadcrumb.textContent = 'System Administration';

    if (currentTab === 'projects') {
      // Projects Table
      tableHead.innerHTML = `
        <tr>
          <th>Project Title</th>
          <th>Category</th>
          <th>Status</th>
          <th>Team Lead</th>
          <th>Start Date</th>
          <th>Actions</th>
        </tr>
      `;

      let projects = [...allProjects];
      const s = searchInput ? searchInput.value.trim().toLowerCase() : '';
      if (s) {
        projects = projects.filter((p) => p.name.toLowerCase().includes(s));
      }

      if (projects.length === 0) {
        tableBody.innerHTML = `
          <tr><td colspan="6" class="text-center" style="padding: 32px; text-align: center; color: var(--text-dim);">
            No projects found matching the criteria.
          </td></tr>
        `;
        return;
      }

      tableBody.innerHTML = projects
        .map((p) => {
          const lead = allUsers.find((u) => u.id === p.lead_id);
          return `
          <tr>
            <td>
              <div style="font-weight: 600; color: var(--text-main);">${window.UI.escapeHtml(p.name)}</div>
              <div style="font-size: 11px; color: var(--text-dim); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${window.UI.escapeHtml(p.description || '')}
              </div>
            </td>
            <td><span class="badge badge-slate">${window.UI.escapeHtml(p.category)}</span></td>
            <td>${window.UI.getStatusBadge(p.status)}</td>
            <td>${lead ? window.UI.escapeHtml(lead.name) : '<span style="color:var(--text-dim);">Unassigned</span>'}</td>
            <td>${window.UI.formatDate(p.start_date || p.created_at)}</td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="window.viewProjectDetails('${p.id}')">View</button>
            </td>
          </tr>
        `;
        })
        .join('');
      return;
    }

    // User Table
    tableHead.innerHTML = `
      <tr>
        <th>User Details</th>
        <th>Role</th>
        <th>Department</th>
        <th>Status</th>
        <th>Registered</th>
        <th>Actions</th>
      </tr>
    `;

    let roleFilter = null;
    if (currentTab === 'hr') roleFilter = 'hr';
    if (currentTab === 'employees') roleFilter = 'employee';
    if (currentTab === 'interns') roleFilter = 'intern';

    const users = getFilteredUsers(roleFilter);

    if (users.length === 0) {
      tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center" style="padding: 32px; text-align: center; color: var(--text-dim);">
          No user profiles found.
        </td></tr>
      `;
      return;
    }

    tableBody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-cell-avatar">${window.UI.getInitials(u.name)}</div>
            <div class="user-cell-info">
              <span class="user-cell-name">${window.UI.escapeHtml(u.name)}</span>
              <span class="user-cell-code">${window.UI.escapeHtml(u.user_code || u.userId)} &bull; ${window.UI.escapeHtml(u.email)}</span>
            </div>
          </div>
        </td>
        <td>${window.UI.getRoleBadge(u.role)}</td>
        <td>${window.UI.escapeHtml(u.department || '—')}</td>
        <td>${
          u.is_active
            ? '<span class="badge badge-emerald">Active</span>'
            : '<span class="badge badge-rose">Inactive</span>'
        }</td>
        <td>${window.UI.formatDate(u.created_at)}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-secondary" onclick="window.viewUserDetails('${u.id}')">Details</button>
            <button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-outline'}" onclick="window.toggleUserActive('${u.id}')">
              ${u.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  }

  // Global action handlers
  window.viewUserDetails = function (userId) {
    const user = allUsers.find((u) => u.id === userId || u.user_code === userId);
    if (!user) return;

    const modalBody = document.getElementById('userDetailsModalBody');
    if (modalBody) {
      modalBody.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
          <div class="user-avatar" style="width: 56px; height: 56px; font-size: 20px;">${window.UI.getInitials(user.name)}</div>
          <div>
            <h3 style="font-size: 18px; font-weight: 700; color: var(--text-main); margin: 0;">${window.UI.escapeHtml(user.name)}</h3>
            <p style="font-size: 13px; color: var(--text-dim); margin-top: 4px; font-family: var(--font-mono);">${window.UI.escapeHtml(user.user_code || user.id)}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Role</label>
            <div style="margin-top: 4px;">${window.UI.getRoleBadge(user.role)}</div>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Status</label>
            <div style="margin-top: 4px;">${user.is_active ? '<span class="badge badge-emerald">Active Account</span>' : '<span class="badge badge-rose">Deactivated</span>'}</div>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Corporate Email</label>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 4px;">${window.UI.escapeHtml(user.email)}</div>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Department</label>
            <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 4px;">${window.UI.escapeHtml(user.department || 'Not Assigned')}</div>
          </div>
        </div>
      `;
      window.UI.openModal('userDetailsModal');
    }
  };

  window.toggleUserActive = async function (userId) {
    const user = allUsers.find((u) => u.id === userId || u.user_code === userId);
    if (!user) return;

    const action = user.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} account ${user.user_code || user.name}?`)) {
      return;
    }

    try {
      await window.UserService.toggleUserStatus(user.id);
      user.is_active = !user.is_active;
      window.UI.showToast('Status Updated', `Account ${user.name} is now ${user.is_active ? 'active' : 'inactive'}.`, 'success');
      updateStatCards();
      renderCurrentTab();
    } catch (e) {
      window.UI.showToast('Error', 'Unable to change user status.', 'error');
    }
  };

  window.viewProjectDetails = function (projectId) {
    const p = allProjects.find((x) => x.id === projectId);
    if (!p) return;
    alert(`Project: ${p.name}\nStatus: ${p.status}\nCategory: ${p.category}\nDescription: ${p.description}`);
  };

    // Open Add User Modal handlers
  window.openAddUserModal = function () {
    if (window.UI && typeof window.UI.openModal === 'function') {
      window.UI.openModal('addUserModal');
    } else {
      const modal = document.getElementById('addUserModal');
      if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
      }
    }
  };

  // Bind Add User buttons explicitly
  document.querySelectorAll('#adminAddUserBtn, #adminToolbarAddUserBtn, [data-action="add-user"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.openAddUserModal();
    });
  });

  // Delegated handler to guarantee Add User button works anywhere in the portal
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#adminAddUserBtn, #adminToolbarAddUserBtn, [data-action="add-user"]');
    if (btn) {
      e.preventDefault();
      window.openAddUserModal();
    }
  });

  // Add User Form Submission
  const addUserForm = document.getElementById('addUserForm');
  if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newUserName').value.trim();
      const email = document.getElementById('newUserEmail').value.trim();
      const role = document.getElementById('newUserRole').value;
      const department = document.getElementById('newUserDepartment').value;

      const submitBtn = addUserForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Create Profile';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating Profile...</span>';
      }

      if (!name || !email) {
        alert('Please fill out all required fields.');
        return;
      }

      try {
        const created = await window.UserService.createUser({
          name,
          email,
          role,
          department,
        });

        allUsers.unshift(created);
        window.UI.showToast('User Created', `Assigned Company Code: ${created.user_code}`, 'success');
        window.UI.closeModal('addUserModal');
        addUserForm.reset();
        updateStatCards();
        renderCurrentTab();
      } catch (err) {
        window.UI.showToast('Error', err.message || 'Unable to create user.', 'error');
      }
    });
  }

  // ==========================================================================
  // SUPER ADMIN INTERNSHIP APPLICATIONS MODULE
  // ==========================================================================

  window.filterAdminAppsByStatus = function (status) {
    adminAppFilterStatus = status;
    const select = document.getElementById('adminAppStatusFilter');
    if (select) select.value = status;
    renderCurrentTab();
  };

  window.viewAdminApplicationResume = async function (idOrRef) {
    if (window.UI) window.UI.showLoading('Retrieving candidate resume...');
    try {
      const token = localStorage.getItem('puvima_admin_token') || sessionStorage.getItem('puvima_admin_token') || '';
      const query = new URLSearchParams({
        role: currentUser.role || 'SuperAdmin',
        userId: currentUser.userId || currentUser.id || 'ADMIN001',
        userName: currentUser.name || 'System Administrator'
      });
      if (token) query.set('token', token);

      const resumeUrl = `/api/admin/internship-applications/${encodeURIComponent(idOrRef)}/resume?${query.toString()}`;
      const res = await fetch(resumeUrl, { headers: getAdminPortalHeaders() });

      if (res.status === 404) {
        const isJson = (res.headers.get('content-type') || '').includes('application/json');
        const errData = isJson ? await res.json() : null;
        const msg = (errData && errData.message)
          ? errData.message
          : 'Candidate resume document is currently unavailable in server storage.';
        if (window.UI) window.UI.showToast('Resume Unavailable', msg, 'warning');
        else alert(msg);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to retrieve resume (HTTP ${res.status})`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        // Honest unavailable HTML card returned by server
        window.open(resumeUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      // PDF or binary file stream -> Blob URL
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      if (window.UI) window.UI.showToast('Error', err.message || 'Unable to retrieve resume document.', 'error');
      else alert('Unable to retrieve resume document: ' + err.message);
    } finally {
      if (window.UI) window.UI.hideLoading();
    }
  };

  window.viewAdminApplicationDetails = async function (idOrRef) {
    if (window.UI) window.UI.showLoading('Loading applicant dossier & history...');
    let app = null;
    let history = [];

    try {
      const [appRes, histRes] = await Promise.all([
        fetch(`/api/admin/internship-applications/${encodeURIComponent(idOrRef)}`, { headers: getAdminPortalHeaders() }),
        fetch(`/api/admin/internship-applications/${encodeURIComponent(idOrRef)}/history`, { headers: getAdminPortalHeaders() })
      ]);

      if (!appRes.ok) {
        const errJson = await appRes.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch application dossier (HTTP ${appRes.status})`);
      }

      const appJson = await appRes.json();
      if (!appJson.success || !appJson.application) {
        throw new Error(appJson.message || 'Application dossier not found.');
      }
      app = appJson.application;

      if (histRes.ok) {
        const hJson = await histRes.json();
        if (hJson.success && Array.isArray(hJson.history)) history = hJson.history;
      }
    } catch (err) {
      if (window.UI) {
        window.UI.hideLoading();
        window.UI.showToast('Error', err.message || 'Unable to retrieve candidate dossier.', 'error');
      } else {
        alert('Error: ' + err.message);
      }
      return;
    } finally {
      if (window.UI) window.UI.hideLoading();
    }

    const titleEl = document.getElementById('adminAppModalTitle');
    const refEl = document.getElementById('adminAppModalRef');
    const statusEl = document.getElementById('adminAppModalStatus');
    const bodyEl = document.getElementById('adminAppModalBody');
    const resumeBtn = document.getElementById('adminAppResumeBtn');
    const quickUpdateBtn = document.getElementById('adminAppQuickUpdateBtn');

    if (titleEl) titleEl.textContent = app.full_name;
    if (refEl) refEl.textContent = app.reference_id;
    if (statusEl) statusEl.innerHTML = getAdminAppStatusBadge(app.recruitment_status);

    if (resumeBtn) {
      resumeBtn.onclick = (e) => {
        e.preventDefault();
        window.viewAdminApplicationResume(app.reference_id || app.id);
      };
    }

    if (quickUpdateBtn) {
      quickUpdateBtn.onclick = () => {
        window.UI.closeModal('adminApplicationModal');
        window.openAdminStatusModal(app.reference_id || app.id);
      };
    }

    const skills = Array.isArray(app.skills)
      ? app.skills
      : (typeof app.skills === 'string' ? JSON.parse(app.skills || '[]') : []);

    const isReviewed = Boolean(app.is_reviewed_by_hr);

    bodyEl.innerHTML = `
      <!-- Review & Submission Meta Banner -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="font-size: 13px; color: #475569;">
          <strong>Submitted:</strong> ${window.UI.formatDateTime(app.created_at)}
        </div>
        <div>
          ${
            isReviewed
              ? `<span style="font-size: 13px; color: #059669; font-weight: 600;">
                  &#10003; Reviewed by HR (${window.UI.escapeHtml(app.hr_reviewed_by || 'HR')}) on ${window.UI.formatDate(app.hr_reviewed_at || app.updated_at)}
                </span>`
              : `<span style="font-size: 13px; color: #d97706; font-weight: 600;">
                  &#9888; Pending HR Review — No evaluation recorded yet
                </span>`
          }
        </div>
      </div>

      <!-- Section 01: Personal & Academic Information -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #0072ce; padding-bottom: 6px; margin-bottom: 14px;">
          Section 01 — Personal &amp; Academic Information
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; font-size: 13px;">
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Full Legal Name</span><strong>${window.UI.escapeHtml(app.full_name)}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Email Address</span><a href="mailto:${window.UI.escapeHtml(app.email)}" style="color: #0072ce;">${window.UI.escapeHtml(app.email)}</a></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Mobile Number</span><strong>${window.UI.escapeHtml(app.phone || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">City &amp; State</span><strong>${window.UI.escapeHtml(app.city_state || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">College / University</span><strong>${window.UI.escapeHtml(app.college || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Degree &amp; Specialization</span><strong>${window.UI.escapeHtml(app.degree || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Year of Study</span><strong>${window.UI.escapeHtml(app.study_year || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Expected Graduation Year</span><strong>${window.UI.escapeHtml(app.graduation_year || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">CGPA / Percentage Range</span><strong>${window.UI.escapeHtml(app.cgpa_range || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">LinkedIn Profile</span>${app.linkedin_url ? `<a href="${window.UI.escapeHtml(app.linkedin_url)}" target="_blank" style="color: #0072ce;">View Profile &rarr;</a>` : '—'}</div>
        </div>
      </div>

      <!-- Section 02: Internship Role & Skills -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #0072ce; padding-bottom: 6px; margin-bottom: 14px;">
          Section 02 — Internship Role &amp; Technical Skills
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; font-size: 13px; margin-bottom: 14px;">
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Target Role / Department</span><strong style="color: #0072ce; font-size: 14px;">${window.UI.escapeHtml(app.internship_role)}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">GitHub / Portfolio URL</span>${app.github_portfolio_url ? `<a href="${window.UI.escapeHtml(app.github_portfolio_url)}" target="_blank" style="color: #0072ce;">${window.UI.escapeHtml(app.github_portfolio_url)}</a>` : '—'}</div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Resume Document</span><strong>${window.UI.escapeHtml(app.resume_filename || 'resume.pdf')}</strong> (${window.UI.formatFileSize(app.resume_size_bytes || 0)})</div>
        </div>

        <div style="margin-bottom: 12px;">
          <span style="color: var(--text-muted); display: block; font-size: 11px; margin-bottom: 6px;">Skills &amp; Technologies</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${skills.length > 0 ? skills.map((s) => `<span class="badge badge-slate" style="background: #eff6ff; color: #1e40af; border-color: #bfdbfe;">${window.UI.escapeHtml(s)}</span>`).join('') : '<em>None specified</em>'}
          </div>
        </div>

        <div style="background: #f8fafc; border-left: 3px solid #0072ce; padding: 12px 14px; border-radius: 4px; margin-bottom: 12px;">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px;">Strongest Skills Description</span>
          <div style="font-size: 13px; color: var(--text-main); white-space: pre-wrap; line-height: 1.5;">${window.UI.escapeHtml(app.strongest_skills || '—')}</div>
        </div>

        ${
          app.projects_experience
            ? `<div style="background: #f8fafc; border-left: 3px solid #0072ce; padding: 12px 14px; border-radius: 4px;">
                <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px;">Projects &amp; Experience</span>
                <div style="font-size: 13px; color: var(--text-main); white-space: pre-wrap; line-height: 1.5;">${window.UI.escapeHtml(app.projects_experience)}</div>
              </div>`
            : ''
        }
      </div>

      <!-- Section 03: Motivation & Availability -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #0072ce; padding-bottom: 6px; margin-bottom: 14px;">
          Section 03 — Motivation &amp; Availability
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; font-size: 13px; margin-bottom: 14px;">
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Preferred Mode</span><strong>${window.UI.escapeHtml(app.internship_mode || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Duration</span><strong>${window.UI.escapeHtml(app.duration || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Availability</span><strong>${window.UI.escapeHtml(app.joining_availability || '—')}${app.specific_joining_date ? ` (${app.specific_joining_date})` : ''}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Hours / Week</span><strong>${window.UI.escapeHtml(app.weekly_hours || '—')}</strong></div>
        </div>

        <div style="background: #f8fafc; border-left: 3px solid #0072ce; padding: 12px 14px; border-radius: 4px; margin-bottom: 12px;">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px;">Why Applicant Wants to Join PUVIMA</span>
          <div style="font-size: 13px; color: var(--text-main); white-space: pre-wrap; line-height: 1.5;">${window.UI.escapeHtml(app.motivation || '—')}</div>
        </div>

        <div style="background: #f8fafc; border-left: 3px solid #0072ce; padding: 12px 14px; border-radius: 4px;">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px;">Expected Contribution to Team</span>
          <div style="font-size: 13px; color: var(--text-main); white-space: pre-wrap; line-height: 1.5;">${window.UI.escapeHtml(app.expected_contribution || '—')}</div>
        </div>
      </div>

      <!-- Section 04: Final Details -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #0072ce; padding-bottom: 6px; margin-bottom: 14px;">
          Section 04 — Final Details &amp; Referral
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; font-size: 13px; margin-bottom: 10px;">
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Referral Source</span><strong>${window.UI.escapeHtml(app.referral_source || '—')}${app.other_referral_details ? ` (${window.UI.escapeHtml(app.other_referral_details)})` : ''}</strong></div>
        </div>
        ${
          app.additional_information
            ? `<div style="background: #f8fafc; border-left: 3px solid #0072ce; padding: 10px 14px; border-radius: 4px; font-size: 13px;">
                <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px;">Additional Information</span>
                <div>${window.UI.escapeHtml(app.additional_information)}</div>
              </div>`
            : ''
        }
      </div>

      <!-- Section 05: Status Transition Audit History (Immutable Timeline) -->
      <div>
        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #0072ce; padding-bottom: 6px; margin-bottom: 14px;">
          Section 05 — Status Transition Audit History
        </h4>
        ${
          history.length === 0
            ? `<p style="font-size: 13px; color: var(--text-muted); font-style: italic;">No audit events recorded yet.</p>`
            : `
              <div style="position: relative; padding-left: 20px; border-left: 2px solid #e2e8f0; margin-left: 8px;">
                ${history
                  .map((h) => {
                    return `
                      <div style="position: relative; margin-bottom: 18px;">
                        <span style="position: absolute; left: -26px; top: 3px; width: 10px; height: 10px; border-radius: 50%; background: #0072ce; border: 2px solid #fff;"></span>
                        <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px;">
                          <div>
                            <strong style="color: #0f172a; font-size: 13px;">${window.UI.escapeHtml(h.previous_status)}</strong>
                            &rarr;
                            <strong style="color: #0072ce; font-size: 13px;">${window.UI.escapeHtml(h.new_status)}</strong>
                          </div>
                          <span style="font-size: 11px; color: var(--text-muted);">${window.UI.formatDateTime(h.created_at)}</span>
                        </div>
                        <div style="font-size: 12px; color: #475569; margin-top: 2px;">
                          Changed by: <strong>${window.UI.escapeHtml(h.changed_by_name || 'Staff')}</strong>
                          (${window.UI.escapeHtml(h.changed_by_role || 'Admin')})
                        </div>
                        ${
                          h.notes
                            ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; font-size: 12px; color: #334155; margin-top: 6px; white-space: pre-wrap;">
                                <em>Notes:</em> ${window.UI.escapeHtml(h.notes)}
                              </div>`
                            : ''
                        }
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `
        }
      </div>
    `;

    window.UI.openModal('adminApplicationModal');
  };

  window.openAdminStatusModal = function (idOrRef) {
    const app = allApplications.find((a) => String(a.id) === String(idOrRef) || a.reference_id === String(idOrRef));
    if (!app) {
      if (window.UI) window.UI.showToast('Error', 'Application not found in current list.', 'error');
      return;
    }

    const idInput = document.getElementById('adminStatusAppId');
    const nameEl = document.getElementById('adminStatusAppName');
    const refEl = document.getElementById('adminStatusAppRef');
    const selEl = document.getElementById('adminStatusSelect');
    const notesEl = document.getElementById('adminStatusNotes');

    if (idInput) idInput.value = app.id;
    if (nameEl) nameEl.textContent = app.full_name;
    if (refEl) refEl.textContent = app.reference_id;
    if (selEl) selEl.value = app.recruitment_status || 'New';
    if (notesEl) notesEl.value = app.admin_notes || '';

    window.UI.openModal('adminUpdateStatusModal');
  };

  // Bind filter events for Super Admin applications
  const appSearch = document.getElementById('adminAppSearchInput');
  const appRole = document.getElementById('adminAppRoleFilter');
  const appStatus = document.getElementById('adminAppStatusFilter');
  const appDate = document.getElementById('adminAppDateFilter');
  const appReset = document.getElementById('adminAppResetBtn');

  if (appSearch) {
    appSearch.addEventListener('input', (e) => {
      adminAppSearchQuery = e.target.value;
      renderCurrentTab();
    });
  }

  if (appRole) {
    appRole.addEventListener('change', (e) => {
      adminAppFilterRole = e.target.value;
      renderCurrentTab();
    });
  }

  if (appStatus) {
    appStatus.addEventListener('change', (e) => {
      adminAppFilterStatus = e.target.value;
      renderCurrentTab();
    });
  }

  if (appDate) {
    appDate.addEventListener('change', (e) => {
      adminAppFilterDate = e.target.value;
      renderCurrentTab();
    });
  }

  if (appReset) {
    appReset.addEventListener('click', () => {
      adminAppSearchQuery = '';
      adminAppFilterRole = 'all';
      adminAppFilterStatus = 'all';
      adminAppFilterDate = '';
      if (appSearch) appSearch.value = '';
      if (appRole) appRole.value = 'all';
      if (appStatus) appStatus.value = 'all';
      if (appDate) appDate.value = '';
      renderCurrentTab();
    });
  }

  // Super Admin Status Update Form submission
  const adminStatusForm = document.getElementById('adminUpdateStatusForm');
  if (adminStatusForm) {
    adminStatusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('adminStatusAppId').value;
      const newStatus = document.getElementById('adminStatusSelect').value;
      const notes = document.getElementById('adminStatusNotes').value;
      const saveBtn = document.getElementById('adminSaveStatusBtn');

      if (!id) return;

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      try {
        const res = await fetch(`/api/admin/internship-applications/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          headers: getAdminPortalHeaders(),
          body: JSON.stringify({ status: newStatus, notes, admin_notes: notes })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || `Failed to update status (HTTP ${res.status})`);
        }

        window.UI.showToast('Status Updated', `Status transitioned to "${newStatus}". Audit log updated.`, 'success');
        window.UI.closeModal('adminUpdateStatusModal');

        // 1. Update in-memory record
        const idx = allApplications.findIndex((a) => String(a.id) === String(id) || a.reference_id === String(id));
        if (idx !== -1) {
          allApplications[idx].recruitment_status = newStatus;
          allApplications[idx].admin_notes = notes;
        }

        // 2. Update table row DOM directly without full reload
        const row = document.getElementById(`admin-app-row-${id}`) || document.querySelector(`tr[data-row-id="${id}"]`);
        if (row) {
          const statusCell = row.querySelector('.admin-app-status-cell');
          if (statusCell) {
            statusCell.innerHTML = getAdminAppStatusBadge(newStatus);
          }
        }

        // 3. Update stats and counter
        await fetchAdminApplicationsData();
        updateStatCards();
      } catch (err) {
        if (window.UI) window.UI.showToast('Error', err.message || 'Unable to update status.', 'error');
        else alert('Error: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Status & Audit Log';
        }
      }
    });
  }
});
