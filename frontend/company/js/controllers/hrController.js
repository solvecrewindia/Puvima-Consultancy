/**
 * PUVIMA Consultancy — HR Operations & Workforce Management Controller
 * Handles project creation wizard, employee assignments, and reviews
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = window.Auth.requireAuth(['HR', 'Admin', 'SuperAdmin']);
  if (!currentUser) return;

  let allUsers = [];
  let allProjects = [];
  let currentTab = 'projects';

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
  document.querySelectorAll('[data-hr-tab]').forEach((tabBtn) => {
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
  }

  function renderCurrentTab() {
    const container = document.getElementById('hrTabContent');
    if (!container) return;

    if (currentTab === 'projects') {
      renderProjectsGrid(container);
    } else if (currentTab === 'people') {
      renderPeopleTable(container);
    } else if (currentTab === 'interns') {
      renderInternsTable(container);
    } else if (currentTab === 'reviews') {
      renderReviewsList(container);
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
});
