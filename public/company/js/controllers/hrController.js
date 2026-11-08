/**
 * PUVIMA Consultancy — HR Operations & Workforce Management Controller
 * Handles project creation wizard, employee assignments, and reviews
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = window.Auth.requireAuth(['HR', 'Admin', 'SuperAdmin']);
  if (!currentUser) return;

  let allUsers = [];
  let allProjects = [];
  let allApplications = [];
  let appStats = { total: 0, new: 0, under_review: 0, shortlisted: 0, interview: 0, selected: 0, rejected: 0, unread_by_hr: 0 };
  let appFilterStatus = 'all';
  let appFilterRole = 'all';
  let appSearchQuery = '';
  let currentTab = 'projects';

  function getPortalHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'x-portal-user-role': currentUser.role || 'HR',
      'x-portal-user-id': currentUser.userId || currentUser.id || 'HR001',
      'x-portal-user-name': encodeURIComponent(currentUser.name || 'HR Coordinator')
    };
    const token = localStorage.getItem('puvima_admin_token') || sessionStorage.getItem('puvima_admin_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async function fetchApplicationsData() {
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch('/api/hr/internship-applications/stats', { headers: getPortalHeaders() }),
        fetch('/api/hr/internship-applications?limit=200', { headers: getPortalHeaders() })
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
      console.warn('[hrController] Error fetching internship applications:', err);
    }
  }

  // Wizard state
  let wizardStep = 1;
  const projectDraft = {
    name: '',
    category: 'Main Project',
    description: '',
    leadId: '',
    memberIds: [],
    startDate: new Date().toISOString().split('T')[0],
    dueDate: '',
  };

  // Tab switching
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  if (urlTab) {
    currentTab = urlTab;
  }

  document.querySelectorAll('[data-hr-tab]').forEach((tabBtn) => {
    if (tabBtn.getAttribute('data-hr-tab') === currentTab) {
      document.querySelectorAll('[data-hr-tab]').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
    }
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('[data-hr-tab]').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      currentTab = tabBtn.getAttribute('data-hr-tab');
      renderCurrentTab();
    });
  });

  await loadData();

  async function loadData() {
    if (window.UI) window.UI.showLoading('Loading Workforce & Project Pipeline...');
    try {
      allUsers = await window.UserService.getUsers();
      allProjects = await window.ProjectService.getProjects();
      await fetchApplicationsData();
      updateStats();
      renderCurrentTab();
    } catch (e) {
      if (window.UI) window.UI.showToast('Error', 'Unable to load HR data.', 'error');
    } finally {
      if (window.UI) window.UI.hideLoading();
    }
  }

  function updateStats() {
    const activeProjects = allProjects.filter((p) => p.status === 'In Progress' || p.status === 'Published').length;
    const totalStaff = allUsers.filter((u) => u.role === 'Employee' || u.role === 'Intern').length;
    const internCount = allUsers.filter((u) => u.role === 'Intern').length;
    const drafts = allProjects.filter((p) => p.status === 'Draft').length;

    const elActive = document.getElementById('statHrActiveProjects');
    const elStaff = document.getElementById('statHrWorkforce');
    const elInterns = document.getElementById('statHrInterns');
    const elDrafts = document.getElementById('statHrDrafts');

    if (elActive) elActive.textContent = activeProjects;
    if (elStaff) elStaff.textContent = totalStaff;
    if (elInterns) elInterns.textContent = internCount;
    if (elDrafts) elDrafts.textContent = drafts;

    const elAppTotal = document.getElementById('statHrTotalApplications');
    const elAppNew = document.getElementById('statHrNewApplications');
    const elNavBadge = document.getElementById('hrNewAppsNavBadge');

    if (elAppTotal) elAppTotal.textContent = appStats.total || allApplications.length;
    if (elAppNew) elAppNew.textContent = appStats.new || 0;
    if (elNavBadge) {
      const unreadCount = appStats.unread_by_hr !== undefined ? appStats.unread_by_hr : appStats.new;
      elNavBadge.textContent = unreadCount;
      elNavBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }


    // Check LOR endorsement stats for badge
    fetch('/api/hr/lor/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          const badge = document.getElementById('hrLorBadge');
          if (badge) {
            if (data.stats.confirmed_by_professor > 0) {
              badge.textContent = `${data.stats.confirmed_by_professor} Endorsed`;
              badge.style.display = 'inline-block';
            } else if (data.stats.total > 0) {
              badge.textContent = `${data.stats.total}`;
              badge.style.display = 'inline-block';
            } else {
              badge.style.display = 'none';
            }
          }
        }
      })
      .catch(() => {});
  }

  function renderCurrentTab() {
    const container = document.getElementById('hrTabContent');
    if (!container) return;

    if (currentTab === 'applications') {
      renderApplicationsView(container);
    } else if (currentTab === 'projects') {
      renderProjectsGrid(container);
    } else if (currentTab === 'people') {
      renderPeopleTable(container);
    } else if (currentTab === 'interns') {
      renderInternsTable(container);
    } else if (currentTab === 'reviews') {
      renderReviewsList(container);
    } else if (currentTab === 'onboarding') {
      if (window.initHrOnboardingModule) {
        window.initHrOnboardingModule(container);
      }
    } else if (currentTab === 'lor') {
      if (window.initHrLorModule) {
        window.initHrLorModule(container);
      }
    }
  }

  function renderProjectsGrid(container) {
    if (allProjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <div class="empty-state-title">No Projects</div>
          <div class="empty-state-desc">Create a new project to get started.</div>
          <button class="btn btn-primary btn-sm" onclick="window.openCreateProjectModal()">New Project</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
        ${allProjects
          .map((p) => {
            const lead = allUsers.find((u) => u.id === p.lead_id);
            const memberCount = (p.members && p.members.length) || 0;
            return `
            <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between;">
              <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px;">
                  <span class="badge badge-slate">${window.UI.escapeHtml(p.category)}</span>
                  ${window.UI.getStatusBadge(p.status)}
                </div>
                <h3 style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
                  ${window.UI.escapeHtml(p.name)}
                </h3>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                  ${window.UI.escapeHtml(p.description)}
                </p>
                
                <div style="font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                  <div><strong>Lead:</strong> ${lead ? window.UI.escapeHtml(lead.name) : 'Unassigned'}</div>
                  <div><strong>Members:</strong> ${memberCount} assigned</div>
                  <div><strong>Period:</strong> ${window.UI.formatDate(p.start_date)} &rarr; ${window.UI.formatDate(p.due_date)}</div>
                </div>
              </div>
              <div class="card-header" style="background: var(--bg-surface-subtle); padding: 12px 20px; border-top: 1px solid var(--border-main);">
                ${
                  p.status === 'Draft'
                    ? `<button class="btn btn-sm btn-primary" onclick="window.publishProject('${p.id}')">Publish</button>`
                    : `<button class="btn btn-sm btn-outline" onclick="window.openProjectTimeline('${p.id}')">Timeline</button>`
                }
                <button class="btn btn-sm btn-secondary" onclick="window.viewProjectDetails('${p.id}')">Details</button>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;
  }

  function renderPeopleTable(container) {
    const people = allUsers.filter((u) => u.role === 'Employee' || u.role === 'Intern');
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Workforce Directory</h3>
            <p class="card-subtitle">Active employees and research interns available for project assignment</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Active Projects</th>
              </tr>
            </thead>
            <tbody>
              ${people
                .map((u) => {
                  const assignedCount = allProjects.filter(
                    (p) => p.lead_id === u.id || (p.members && p.members.includes(u.id))
                  ).length;
                  return `
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
                        ? '<span class="badge badge-emerald">Available</span>'
                        : '<span class="badge badge-rose">Inactive</span>'
                    }</td>
                    <td><strong>${assignedCount}</strong> projects</td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderInternsTable(container) {
    const interns = allUsers.filter((u) => u.role === 'Intern');
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Internship Management</h3>
            <p class="card-subtitle">Research interns undergoing training and mentorship at PUVIMA</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Intern</th>
                <th>Department</th>
                <th>Status</th>
                <th>Enrollment Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${interns
                .map(
                  (u) => `
                <tr>
                  <td>
                    <div class="user-cell">
                      <div class="user-cell-avatar">${window.UI.getInitials(u.name)}</div>
                      <div class="user-cell-info">
                        <span class="user-cell-name">${window.UI.escapeHtml(u.name)}</span>
                        <span class="user-cell-code">${window.UI.escapeHtml(u.user_code || u.userId)}</span>
                      </div>
                    </div>
                  </td>
                  <td>${window.UI.escapeHtml(u.department || 'General Research')}</td>
                  <td>${
                    u.is_active
                      ? '<span class="badge badge-emerald">Active Intern</span>'
                      : '<span class="badge badge-rose">Inactive</span>'
                  }</td>
                  <td>${window.UI.formatDate(u.created_at)}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary" onclick="window.viewUserDetails('${u.id}')">View Record</button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderReviewsList(container) {
    const drafts = allProjects.filter((p) => p.status === 'Draft');
    if (drafts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div class="empty-state-title">No Pending Drafts</div>
          <div class="empty-state-desc">All project initiatives are active.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Pending Project Approvals</h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
          ${drafts
            .map(
              (p) => `
            <div style="border: 1px solid var(--border-main); border-radius: var(--radius-sm); padding: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div>
                <span class="badge badge-amber" style="margin-bottom: 6px;">Draft Project</span>
                <h4 style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">${window.UI.escapeHtml(p.name)}</h4>
                <p style="font-size: 13px; color: var(--text-muted); margin: 0;">${window.UI.escapeHtml(p.description)}</p>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary" onclick="window.publishProject('${p.id}')">Approve & Publish</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // Project Creation Wizard Logic
  window.openCreateProjectModal = function () {
    wizardStep = 1;
    updateWizardUI();
    window.UI.openModal('createProjectModal');
  };

  function updateWizardUI() {
    document.querySelectorAll('.wizard-step-pane').forEach((pane) => {
      pane.style.display = 'none';
    });

    const currentPane = document.getElementById(`wizardStep${wizardStep}`);
    if (currentPane) currentPane.style.display = 'block';

    // Update step indicators
    for (let i = 1; i <= 3; i++) {
      const stepEl = document.getElementById(`stepIndicator${i}`);
      if (stepEl) {
        if (i === wizardStep) {
          stepEl.style.fontWeight = '700';
          stepEl.style.color = 'var(--puvima-blue)';
        } else if (i < wizardStep) {
          stepEl.style.color = 'var(--color-emerald)';
        } else {
          stepEl.style.color = 'var(--text-dim)';
        }
      }
    }

    // Step 2: Populate Leads & Members
    if (wizardStep === 2) {
      const leadSelect = document.getElementById('projectLeadSelect');
      const membersContainer = document.getElementById('projectMembersContainer');

      if (leadSelect) {
        const leads = allUsers.filter((u) => u.role === 'Employee');
        leadSelect.innerHTML = `
          <option value="">-- Select Project Lead --</option>
          ${leads
            .map(
              (l) =>
                `<option value="${l.id}" ${l.id === projectDraft.leadId ? 'selected' : ''}>${l.name} (${l.user_code || l.department})</option>`
            )
            .join('')}
        `;
      }

      if (membersContainer) {
        const potentialMembers = allUsers.filter((u) => u.role === 'Employee' || u.role === 'Intern');
        membersContainer.innerHTML = potentialMembers
          .map(
            (m) => `
          <label style="display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 6px; cursor: pointer;">
            <input type="checkbox" value="${m.id}" ${projectDraft.memberIds.includes(m.id) ? 'checked' : ''} onchange="window.toggleMemberDraft('${m.id}')">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">${m.name}</span>
            <span class="badge ${m.role === 'Intern' ? 'badge-slate' : 'badge-emerald'}" style="margin-left: auto;">${m.role}</span>
          </label>
        `
          )
          .join('');
      }
    }

    // Step 3: Populate Review Summary
    if (wizardStep === 3) {
      const summaryEl = document.getElementById('projectReviewSummary');
      const lead = allUsers.find((u) => u.id === projectDraft.leadId);
      const memberNames = allUsers
        .filter((u) => projectDraft.memberIds.includes(u.id))
        .map((u) => u.name)
        .join(', ');

      if (summaryEl) {
        summaryEl.innerHTML = `
          <div style="background: var(--bg-surface-subtle); border-radius: var(--radius-sm); padding: 18px; border: 1px solid var(--border-main);">
            <h4 style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">${window.UI.escapeHtml(projectDraft.name)}</h4>
            <div style="margin-bottom: 12px;"><span class="badge badge-slate">${projectDraft.category}</span></div>
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">${window.UI.escapeHtml(projectDraft.description)}</p>
            <div style="font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
              <div><strong>Team Lead:</strong> ${lead ? lead.name : 'None'}</div>
              <div><strong>Assigned Team:</strong> ${memberNames || 'None selected'}</div>
              <div><strong>Proposed Duration:</strong> ${projectDraft.startDate || 'Immediate'} to ${projectDraft.dueDate || 'Flexible'}</div>
            </div>
          </div>
        `;
      }
    }
  }

  window.toggleMemberDraft = function (id) {
    if (projectDraft.memberIds.includes(id)) {
      projectDraft.memberIds = projectDraft.memberIds.filter((m) => m !== id);
    } else {
      projectDraft.memberIds.push(id);
    }
  };

  window.nextWizardStep = function () {
    if (wizardStep === 1) {
      const name = document.getElementById('projectNameInput').value.trim();
      const cat = document.getElementById('projectCategorySelect').value;
      const desc = document.getElementById('projectDescInput').value.trim();

      if (!name) {
        alert('Please enter a project title.');
        return;
      }

      projectDraft.name = name;
      projectDraft.category = cat;
      projectDraft.description = desc;
      wizardStep = 2;
      updateWizardUI();
    } else if (wizardStep === 2) {
      const leadSelect = document.getElementById('projectLeadSelect');
      projectDraft.leadId = leadSelect ? leadSelect.value : '';
      wizardStep = 3;
      updateWizardUI();
    }
  };

  window.prevWizardStep = function () {
    if (wizardStep > 1) {
      wizardStep--;
      updateWizardUI();
    }
  };

  window.submitProjectDraft = async function (publishImmediately) {
    projectDraft.publishImmediately = publishImmediately;
    projectDraft.startDate = document.getElementById('projectStartDateInput')
      ? document.getElementById('projectStartDateInput').value
      : '';
    projectDraft.dueDate = document.getElementById('projectDueDateInput')
      ? document.getElementById('projectDueDateInput').value
      : '';

    try {
      const created = await window.ProjectService.createProject(projectDraft);
      allProjects.unshift(created);
      window.UI.showToast(
        publishImmediately ? 'Project Published' : 'Draft Saved',
        `Project "${created.name}" is now ${created.status}.`,
        'success'
      );
      window.UI.closeModal('createProjectModal');
      updateStats();
      renderCurrentTab();
    } catch (err) {
      window.UI.showToast('Error', 'Unable to create project.', 'error');
    }
  };

  window.publishProject = async function (id) {
    if (!confirm('Publish this project and notify assigned members?')) return;
    try {
      await window.ProjectService.publishProject(id);
      const p = allProjects.find((x) => x.id === id);
      if (p) p.status = 'Published';
      window.UI.showToast('Published', 'Project is now live in the workforce workspace.', 'success');
      updateStats();
      renderCurrentTab();
    } catch (e) {
      window.UI.showToast('Error', 'Unable to publish project.', 'error');
    }
  };

  window.openProjectTimeline = function (id) {
    window.location.href = `/company/employee?projectId=${id}`;
  };

  window.viewProjectDetails = function (id) {
    const p = allProjects.find((x) => x.id === id);
    if (!p) return;
    alert(`Project: ${p.name}\nCategory: ${p.category}\nStatus: ${p.status}\nDescription: ${p.description}`);
  };

  // ==========================================================================
  // HR APPLICATIONS MODULE
  // ==========================================================================

  function getAppStatusBadge(status) {
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

  function getFilteredApplications() {
    let list = [...allApplications];

    if (appFilterStatus && appFilterStatus !== 'all') {
      list = list.filter((a) => {
        const s = String(a.recruitment_status || 'New').toLowerCase();
        return s === appFilterStatus.toLowerCase();
      });
    }

    if (appFilterRole && appFilterRole !== 'all') {
      list = list.filter((a) => a.internship_role === appFilterRole);
    }

    if (appSearchQuery && appSearchQuery.trim()) {
      const q = appSearchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.full_name && a.full_name.toLowerCase().includes(q)) ||
          (a.email && a.email.toLowerCase().includes(q)) ||
          (a.phone && a.phone.toLowerCase().includes(q)) ||
          (a.reference_id && a.reference_id.toLowerCase().includes(q)) ||
          (a.college && a.college.toLowerCase().includes(q)) ||
          (a.degree && a.degree.toLowerCase().includes(q)) ||
          (a.internship_role && a.internship_role.toLowerCase().includes(q))
      );
    }

    return list;
  }

  function renderApplicationsView(container) {
    const filtered = getFilteredApplications();

    container.innerHTML = `
      <!-- 7 Lifecycle Status Metric Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #0072ce; ${appFilterStatus === 'all' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterHrAppsByStatus('all')">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 11px;">Total Received</span>
            <span class="stat-value" style="font-size: 20px;">${appStats.total || allApplications.length}</span>
            <span class="stat-desc" style="font-size: 11px;">All candidates</span>
          </div>
        </div>

        <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #0284c7; ${appFilterStatus === 'New' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterHrAppsByStatus('New')">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 11px;">New</span>
            <span class="stat-value" style="font-size: 20px; color: #0284c7;">${appStats.new || 0}</span>
            <span class="stat-desc" style="font-size: 11px;">Unprocessed</span>
          </div>
        </div>

        <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #d97706; ${appFilterStatus === 'Under Review' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterHrAppsByStatus('Under Review')">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 11px;">Under Review</span>
            <span class="stat-value" style="font-size: 20px; color: #d97706;">${appStats.under_review || 0}</span>
            <span class="stat-desc" style="font-size: 11px;">Evaluation</span>
          </div>
        </div>

        <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #7c3aed; ${appFilterStatus === 'Shortlisted' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterHrAppsByStatus('Shortlisted')">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 11px;">Shortlisted</span>
            <span class="stat-value" style="font-size: 20px; color: #7c3aed;">${appStats.shortlisted || 0}</span>
            <span class="stat-desc" style="font-size: 11px;">Pre-selected</span>
          </div>
        </div>

        <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #0284c7; ${appFilterStatus === 'Interview' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterHrAppsByStatus('Interview')">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 11px;">Interview</span>
            <span class="stat-value" style="font-size: 20px; color: #0284c7;">${appStats.interview || 0}</span>
            <span class="stat-desc" style="font-size: 11px;">Technical round</span>
          </div>
        </div>

        <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #059669; ${appFilterStatus === 'Selected' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterHrAppsByStatus('Selected')">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 11px;">Selected</span>
            <span class="stat-value" style="font-size: 20px; color: #059669;">${appStats.selected || 0}</span>
            <span class="stat-desc" style="font-size: 11px;">Offered position</span>
          </div>
        </div>

        <div class="stat-card" style="padding: 12px 14px; cursor: pointer; border-top: 3px solid #dc2626; ${appFilterStatus === 'Rejected' ? 'background: var(--bg-surface-active);' : ''}" onclick="window.filterHrAppsByStatus('Rejected')">
          <div class="stat-info">
            <span class="stat-label" style="font-size: 11px;">Rejected</span>
            <span class="stat-value" style="font-size: 20px; color: #dc2626;">${appStats.rejected || 0}</span>
            <span class="stat-desc" style="font-size: 11px;">Not moving forward</span>
          </div>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="filter-bar" style="margin-bottom: 16px; background: #FFFFFF; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-main); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; flex: 1;">
          <div class="input-with-icon" style="width: 260px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="hrAppSearchInput" class="form-control" placeholder="Search applicant, email, college, ref..." value="${window.UI.escapeHtml(appSearchQuery)}">
          </div>

          <select id="hrAppStatusFilter" class="form-select" style="width: 170px;">
            <option value="all" ${appFilterStatus === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="New" ${appFilterStatus === 'New' ? 'selected' : ''}>New</option>
            <option value="Under Review" ${appFilterStatus === 'Under Review' ? 'selected' : ''}>Under Review</option>
            <option value="Shortlisted" ${appFilterStatus === 'Shortlisted' ? 'selected' : ''}>Shortlisted</option>
            <option value="Interview" ${appFilterStatus === 'Interview' ? 'selected' : ''}>Interview</option>
            <option value="Selected" ${appFilterStatus === 'Selected' ? 'selected' : ''}>Selected</option>
            <option value="Rejected" ${appFilterStatus === 'Rejected' ? 'selected' : ''}>Rejected</option>
          </select>

          <select id="hrAppRoleFilter" class="form-select" style="width: 200px;">
            <option value="all" ${appFilterRole === 'all' ? 'selected' : ''}>All Roles</option>
            <option value="Software Development" ${appFilterRole === 'Software Development' ? 'selected' : ''}>Software Development</option>
            <option value="Artificial Intelligence / Machine Learning" ${appFilterRole === 'Artificial Intelligence / Machine Learning' ? 'selected' : ''}>AI / ML</option>
            <option value="Data Analytics / Data Science" ${appFilterRole === 'Data Analytics / Data Science' ? 'selected' : ''}>Data Analytics</option>
            <option value="Web Development" ${appFilterRole === 'Web Development' ? 'selected' : ''}>Web Development</option>
            <option value="Mobile App Development" ${appFilterRole === 'Mobile App Development' ? 'selected' : ''}>Mobile App Development</option>
            <option value="UI/UX Design" ${appFilterRole === 'UI/UX Design' ? 'selected' : ''}>UI/UX Design</option>
            <option value="Cybersecurity" ${appFilterRole === 'Cybersecurity' ? 'selected' : ''}>Cybersecurity</option>
            <option value="Marketing / Content" ${appFilterRole === 'Marketing / Content' ? 'selected' : ''}>Marketing / Content</option>
            <option value="Sales / Business Development" ${appFilterRole === 'Sales / Business Development' ? 'selected' : ''}>Sales / Business Dev</option>
            <option value="Operations / Business" ${appFilterRole === 'Operations / Business' ? 'selected' : ''}>Operations / Business</option>
            <option value="Robotics" ${appFilterRole === 'Robotics' ? 'selected' : ''}>Robotics</option>
            <option value="Blockchain" ${appFilterRole === 'Blockchain' ? 'selected' : ''}>Blockchain</option>
            <option value="Other" ${appFilterRole === 'Other' ? 'selected' : ''}>Other</option>
          </select>

          ${
            appSearchQuery || appFilterStatus !== 'all' || appFilterRole !== 'all'
              ? `<button class="btn btn-sm btn-outline" onclick="window.resetHrAppFilters()">Reset</button>`
              : ''
          }
        </div>

        <div style="font-size: 13px; color: var(--text-muted);">
          Showing <strong>${filtered.length}</strong> of <strong>${allApplications.length}</strong> applications
        </div>
      </div>

      <!-- Applications Listing Card -->
      <div class="card" style="margin: 0;">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Reference ID</th>
                <th>Applicant Name</th>
                <th>Email</th>
                <th>Mobile Number</th>
                <th>College / University</th>
                <th>Degree</th>
                <th>Internship Role</th>
                <th>Application Date</th>
                <th>Application Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${
                filtered.length === 0
                  ? `<tr><td colspan="10" style="text-align: center; padding: 36px; color: var(--text-muted);">No internship applications found matching your criteria.</td></tr>`
                  : filtered
                      .map((app) => {
                        const isNew = !app.is_reviewed_by_hr;
                        return `
                          <tr id="hr-app-row-${app.id}" data-row-id="${app.id}" data-ref="${window.UI.escapeHtml(app.reference_id)}" style="${isNew ? 'background: #f0fdf4;' : ''}">
                            <td>
                              <span style="font-family: monospace; font-size: 12px; font-weight: 600; color: var(--puvima-blue);">${window.UI.escapeHtml(app.reference_id)}</span>
                            </td>
                            <td>
                              <div style="display: flex; align-items: center; gap: 6px;">
                                <strong style="color: var(--text-main);">${window.UI.escapeHtml(app.full_name)}</strong>
                                ${isNew ? `<span class="badge badge-rose hr-new-badge" style="font-size: 9px; padding: 1px 6px; font-weight: 700;">NEW</span>` : ''}
                              </div>
                            </td>
                            <td>
                              <a href="mailto:${window.UI.escapeHtml(app.email)}" style="color: var(--puvima-blue); text-decoration: none;">${window.UI.escapeHtml(app.email)}</a>
                            </td>
                            <td>
                              <span style="font-family: monospace; font-size: 12px;">${window.UI.escapeHtml(app.phone || '—')}</span>
                            </td>
                            <td>
                              <div style="max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.UI.escapeHtml(app.college)}">
                                ${window.UI.escapeHtml(app.college || '—')}
                              </div>
                            </td>
                            <td>
                              <div style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.UI.escapeHtml(app.degree)}">
                                ${window.UI.escapeHtml(app.degree || '—')}
                              </div>
                            </td>
                            <td>
                              <span class="badge badge-slate" style="font-size: 11px;">${window.UI.escapeHtml(app.internship_role)}</span>
                            </td>
                            <td>
                              <span style="font-size: 12px; color: var(--text-muted);">${window.UI.formatDate(app.created_at)}</span>
                            </td>
                            <td class="hr-app-status-cell">
                              ${getAppStatusBadge(app.recruitment_status)}
                            </td>
                            <td style="text-align: right; white-space: nowrap;">
                              <button type="button" class="btn btn-sm btn-primary action-btn-view" data-action="view-details" data-id="${app.id}" data-ref="${app.reference_id}" onclick="window.viewHrApplicationDetails('${app.reference_id || app.id}')" title="View Details" style="padding: 4px 10px; font-size: 12px;">
                                View Details
                              </button>
                              <button type="button" class="btn btn-sm btn-outline action-btn-resume" data-action="view-resume" data-id="${app.id}" data-ref="${app.reference_id}" onclick="window.viewHrApplicationResume('${app.reference_id || app.id}')" title="View Resume" style="padding: 4px 8px; font-size: 12px; margin-left: 4px;">
                                Resume
                              </button>
                              <button type="button" class="btn btn-sm btn-secondary action-btn-status" data-action="update-status" data-id="${app.id}" data-ref="${app.reference_id}" onclick="window.openHrStatusModal('${app.reference_id || app.id}')" title="Update Status" style="padding: 4px 8px; font-size: 12px; margin-left: 4px;">
                                Status
                              </button>
                            </td>
                          </tr>
                        `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Delegated click handler on table body
    const tableBody = container.querySelector('.data-table tbody');
    if (tableBody) {
      tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        e.preventDefault();
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-ref') || btn.getAttribute('data-id');
        if (!id) return;
        if (action === 'view-details') window.viewHrApplicationDetails(id);
        else if (action === 'view-resume') window.viewHrApplicationResume(id);
        else if (action === 'update-status') window.openHrStatusModal(id);
      });
    }

    // Bind search and filter events
    const sInput = document.getElementById('hrAppSearchInput');
    const stFilter = document.getElementById('hrAppStatusFilter');
    const rFilter = document.getElementById('hrAppRoleFilter');

    if (sInput) {
      sInput.addEventListener('input', (e) => {
        appSearchQuery = e.target.value;
        renderApplicationsView(container);
      });
    }

    if (stFilter) {
      stFilter.addEventListener('change', (e) => {
        appFilterStatus = e.target.value;
        renderApplicationsView(container);
      });
    }

    if (rFilter) {
      rFilter.addEventListener('change', (e) => {
        appFilterRole = e.target.value;
        renderApplicationsView(container);
      });
    }
  }

  window.filterHrAppsByStatus = function (status) {
    appFilterStatus = status;
    renderCurrentTab();
  };

  window.resetHrAppFilters = function () {
    appSearchQuery = '';
    appFilterStatus = 'all';
    appFilterRole = 'all';
    renderCurrentTab();
  };

  window.viewHrApplicationResume = async function (idOrRef) {
    if (window.UI) window.UI.showLoading('Retrieving candidate resume...');
    try {
      const token = localStorage.getItem('puvima_admin_token') || sessionStorage.getItem('puvima_admin_token') || '';
      const query = new URLSearchParams({
        role: currentUser.role || 'HR',
        userId: currentUser.userId || currentUser.id || 'HR001',
        userName: currentUser.name || 'HR Coordinator'
      });
      if (token) query.set('token', token);

      const resumeUrl = `/api/hr/internship-applications/${encodeURIComponent(idOrRef)}/resume?${query.toString()}`;
      const res = await fetch(resumeUrl, { headers: getPortalHeaders() });

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

  window.viewHrApplicationDetails = async function (idOrRef) {
    if (window.UI) window.UI.showLoading('Loading applicant details...');
    let app = null;

    try {
      const res = await fetch(`/api/hr/internship-applications/${encodeURIComponent(idOrRef)}`, {
        headers: getPortalHeaders()
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch application details (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (!json.success || !json.application) {
        throw new Error(json.message || 'Application details not found.');
      }
      app = json.application;
    } catch (err) {
      if (window.UI) {
        window.UI.hideLoading();
        window.UI.showToast('Error', err.message || 'Application details could not be found.', 'error');
      } else {
        alert('Error: ' + err.message);
      }
      return;
    } finally {
      if (window.UI) window.UI.hideLoading();
    }

    // Mark as reviewed by HR if not already
    if (!app.is_reviewed_by_hr) {
      try {
        await fetch(`/api/hr/internship-applications/${encodeURIComponent(app.id)}/reviewed`, {
          method: 'PATCH',
          headers: getPortalHeaders()
        });
        app.is_reviewed_by_hr = 1;
        app.hr_reviewed_at = new Date().toISOString();
        app.hr_reviewed_by = currentUser.name || 'HR Coordinator';

        // Update in-memory allApplications
        const memIdx = allApplications.findIndex((a) => String(a.id) === String(app.id) || a.reference_id === app.reference_id);
        if (memIdx !== -1) {
          allApplications[memIdx].is_reviewed_by_hr = 1;
          allApplications[memIdx].hr_reviewed_at = app.hr_reviewed_at;
          allApplications[memIdx].hr_reviewed_by = app.hr_reviewed_by;
        }

        // Update row DOM directly
        const row = document.getElementById(`hr-app-row-${app.id}`) || document.querySelector(`tr[data-row-id="${app.id}"]`);
        if (row) {
          row.style.background = '';
          const newBadge = row.querySelector('.hr-new-badge');
          if (newBadge) newBadge.remove();
        }

        if (appStats.unread_by_hr > 0) appStats.unread_by_hr--;
        updateStats();
      } catch (e) {
        console.warn('Could not mark as reviewed:', e);
      }
    }

    const modalTitle = document.getElementById('hrAppModalTitle');
    const modalRef = document.getElementById('hrAppModalRef');
    const modalStatus = document.getElementById('hrAppModalStatus');
    const modalNew = document.getElementById('hrAppModalNewBadge');
    const modalBody = document.getElementById('hrAppModalBody');
    const resumeBtn = document.getElementById('hrAppResumeBtn');
    const quickUpdateBtn = document.getElementById('hrAppQuickUpdateBtn');

    if (modalTitle) modalTitle.textContent = app.full_name;
    if (modalRef) modalRef.textContent = app.reference_id;
    if (modalStatus) modalStatus.innerHTML = getAppStatusBadge(app.recruitment_status);
    if (modalNew) modalNew.style.display = 'none';

    if (resumeBtn) {
      resumeBtn.onclick = (e) => {
        e.preventDefault();
        window.viewHrApplicationResume(app.reference_id || app.id);
      };
    }

    if (quickUpdateBtn) {
      quickUpdateBtn.onclick = () => {
        window.UI.closeModal('hrApplicationModal');
        window.openHrStatusModal(app.reference_id || app.id);
      };
    }

    const skills = Array.isArray(app.skills)
      ? app.skills
      : (typeof app.skills === 'string' ? JSON.parse(app.skills || '[]') : []);

    modalBody.innerHTML = `
      <!-- Review Status Banner -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="font-size: 13px; color: #475569;">
          <strong>Submitted:</strong> ${window.UI.formatDateTime(app.created_at)}
        </div>
        <div style="font-size: 13px; color: #059669; font-weight: 600;">
          &#10003; Reviewed by HR (${app.hr_reviewed_by || currentUser.name || 'HR'}) on ${window.UI.formatDate(app.hr_reviewed_at || new Date())}
        </div>
      </div>

      <!-- Section 01: Personal & Academic Information -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #0072ce; padding-bottom: 6px; margin-bottom: 14px;">
          Section 01 — Personal &amp; Academic Information
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; font-size: 13px;">
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Full Name</span><strong>${window.UI.escapeHtml(app.full_name)}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Email Address</span><a href="mailto:${window.UI.escapeHtml(app.email)}" style="color: #0072ce;">${window.UI.escapeHtml(app.email)}</a></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Mobile Number</span><strong>${window.UI.escapeHtml(app.phone || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">City &amp; State</span><strong>${window.UI.escapeHtml(app.city_state || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">College / University</span><strong>${window.UI.escapeHtml(app.college || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Degree &amp; Specialization</span><strong>${window.UI.escapeHtml(app.degree || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Current Year of Study</span><strong>${window.UI.escapeHtml(app.study_year || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Expected Graduation Year</span><strong>${window.UI.escapeHtml(app.graduation_year || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">CGPA / Percentage Range</span><strong>${window.UI.escapeHtml(app.cgpa_range || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">LinkedIn Profile</span>${app.linkedin_url ? `<a href="${window.UI.escapeHtml(app.linkedin_url)}" target="_blank" style="color: #0072ce;">View Profile &rarr;</a>` : '—'}</div>
        </div>
      </div>

      <!-- Section 02: Internship Role & Skills -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #0072ce; padding-bottom: 6px; margin-bottom: 14px;">
          Section 02 — Internship Role &amp; Skills
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; font-size: 13px; margin-bottom: 14px;">
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Target Department / Role</span><strong style="color: #0072ce; font-size: 14px;">${window.UI.escapeHtml(app.internship_role)}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">GitHub / Portfolio URL</span>${app.github_portfolio_url ? `<a href="${window.UI.escapeHtml(app.github_portfolio_url)}" target="_blank" style="color: #0072ce;">${window.UI.escapeHtml(app.github_portfolio_url)}</a>` : '—'}</div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Resume Document</span><strong>${window.UI.escapeHtml(app.resume_filename || 'resume.pdf')}</strong> (${window.UI.formatFileSize(app.resume_size_bytes || 0)})</div>
        </div>

        <div style="margin-bottom: 12px;">
          <span style="color: var(--text-muted); display: block; font-size: 11px; margin-bottom: 6px;">Selected Skills &amp; Technologies</span>
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
                <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px;">Projects &amp; Relevant Experience</span>
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
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Preferred Duration</span><strong>${window.UI.escapeHtml(app.duration || '—')}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Joining Availability</span><strong>${window.UI.escapeHtml(app.joining_availability || '—')}${app.specific_joining_date ? ` (${app.specific_joining_date})` : ''}</strong></div>
          <div><span style="color: var(--text-muted); display: block; font-size: 11px;">Weekly Hours Available</span><strong>${window.UI.escapeHtml(app.weekly_hours || '—')}</strong></div>
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
          Section 04 — Final Details
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

      ${
        app.admin_notes
          ? `<div style="background: #fefce8; border: 1px solid #fde047; padding: 12px 14px; border-radius: 6px; font-size: 13px;">
              <strong style="color: #854d0e;">Internal Coordinator Notes:</strong>
              <div style="margin-top: 4px; color: #713f12; white-space: pre-wrap;">${window.UI.escapeHtml(app.admin_notes)}</div>
            </div>`
          : ''
      }
    `;

    window.UI.openModal('hrApplicationModal');
  };

  window.openHrStatusModal = function (idOrRef) {
    const app = allApplications.find((a) => String(a.id) === String(idOrRef) || a.reference_id === String(idOrRef));
    if (!app) {
      if (window.UI) window.UI.showToast('Error', 'Application not found in current list.', 'error');
      return;
    }

    const idInput = document.getElementById('hrStatusAppId');
    const nameEl = document.getElementById('hrStatusAppName');
    const refEl = document.getElementById('hrStatusAppRef');
    const selEl = document.getElementById('hrStatusSelect');
    const notesEl = document.getElementById('hrStatusNotes');

    if (idInput) idInput.value = app.id;
    if (nameEl) nameEl.textContent = app.full_name;
    if (refEl) refEl.textContent = app.reference_id;
    if (selEl) selEl.value = app.recruitment_status || 'New';
    if (notesEl) notesEl.value = app.admin_notes || '';

    window.UI.openModal('hrUpdateStatusModal');
  };

  // Status form listener
  const hrStatusForm = document.getElementById('hrUpdateStatusForm');
  if (hrStatusForm) {
    hrStatusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('hrStatusAppId').value;
      const newStatus = document.getElementById('hrStatusSelect').value;
      const notes = document.getElementById('hrStatusNotes').value;
      const saveBtn = document.getElementById('hrSaveStatusBtn');

      if (!id) return;

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      try {
        const res = await fetch(`/api/hr/internship-applications/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          headers: getPortalHeaders(),
          body: JSON.stringify({ status: newStatus, notes, admin_notes: notes })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || `Failed to update status (HTTP ${res.status})`);
        }

        if (window.UI) window.UI.showToast('Status Updated', `Application status updated to "${newStatus}".`, 'success');
        if (window.UI) window.UI.closeModal('hrUpdateStatusModal');

        // 1. Update in-memory applications
        const idx = allApplications.findIndex((a) => String(a.id) === String(id) || a.reference_id === String(id));
        if (idx !== -1) {
          allApplications[idx].recruitment_status = newStatus;
          allApplications[idx].admin_notes = notes;
        }

        // 2. Update table row DOM directly without full reload
        const row = document.getElementById(`hr-app-row-${id}`) || document.querySelector(`tr[data-row-id="${id}"]`);
        if (row) {
          const statusCell = row.querySelector('.hr-app-status-cell');
          if (statusCell) {
            statusCell.innerHTML = getAppStatusBadge(newStatus);
          }
        }

        // 3. Update stats
        await fetchApplicationsData();
        updateStats();
      } catch (err) {
        if (window.UI) window.UI.showToast('Error', err.message || 'Unable to update status.', 'error');
        else alert('Error: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Status';
        }
      }
    });
  }
});
