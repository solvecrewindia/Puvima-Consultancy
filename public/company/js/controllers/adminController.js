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

    if (countAll) countAll.textContent = allUsers.length;
    if (countHr) countHr.textContent = hrCount;
    if (countEmp) countEmp.textContent = empCount;
    if (countInt) countInt.textContent = intCount;
    if (countProj) countProj.textContent = projCount;
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

  function renderCurrentTab() {
    const tableBody = document.getElementById('adminTableBody');
    const tableHead = document.getElementById('adminTableHead');
    if (!tableBody || !tableHead) return;

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

  // Add User Form Submission
  const addUserForm = document.getElementById('addUserForm');
  if (addUserForm) {
    addUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newUserName').value.trim();
      const email = document.getElementById('newUserEmail').value.trim();
      const role = document.getElementById('newUserRole').value;
      const department = document.getElementById('newUserDepartment').value;

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
});
