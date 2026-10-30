/**
 * PUVIMA Consultancy — Member Workspace & Timeline Controller
 * Powers Employee & Intern Project Dashboard and Timeline Interactions
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = window.Auth.requireAuth(['Employee', 'Intern', 'HR', 'Admin', 'SuperAdmin']);
  if (!currentUser) return;

  const urlParams = new URLSearchParams(window.location.search);
  const requestedProjectId = urlParams.get('projectId');

  let activeProject = null;
  let allUsers = [];
  let userProjects = [];
  let currentTimelineType = 'Main';
  let timelineEntries = [];
  let currentTab = 'current';

  // Tab switching (Current Project vs Past Projects)
  document.querySelectorAll('[data-member-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('[data-member-tab]').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      currentTab = tabBtn.getAttribute('data-member-tab');
      renderCurrentTab();
    });
  });

  await loadData();

  async function loadData() {
    if (window.UI) window.UI.showLoading('Loading Member Workspace...');
    try {
      allUsers = await window.UserService.getUsers();
      const allProjects = await window.ProjectService.getProjects();

      // Find projects where user is lead or member
      userProjects = allProjects.filter(
        (p) =>
          p.lead_id === currentUser.id ||
          (p.members && p.members.includes(currentUser.id)) ||
          currentUser.role === 'Admin' ||
          currentUser.role === 'SuperAdmin' ||
          currentUser.role === 'HR'
      );

      if (requestedProjectId) {
        activeProject = allProjects.find((p) => p.id === requestedProjectId);
      }

      if (!activeProject && userProjects.length > 0) {
        // Pick first active or in-progress project
        activeProject =
          userProjects.find((p) => p.status === 'In Progress' || p.status === 'Published') ||
          userProjects[0];
      }

      renderCurrentTab();
    } catch (e) {
      if (window.UI) window.UI.showToast('Error', 'Unable to load member project data.', 'error');
    } finally {
      if (window.UI) window.UI.hideLoading();
    }
  }

  function renderCurrentTab() {
    const container = document.getElementById('memberTabContent');
    if (!container) return;

    if (currentTab === 'past') {
      renderPastProjects(container);
    } else {
      renderCurrentProject(container);
    }
  }

  function renderCurrentProject(container) {
    if (!activeProject) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <div class="empty-state-title">No Active Project</div>
          <div class="empty-state-desc">Project allocation pending from HR.</div>
        </div>
      `;
      return;
    }

    const lead = allUsers.find((u) => u.id === activeProject.lead_id);
    const members = allUsers.filter((u) => (activeProject.members || []).includes(u.id));

    const isStaff = currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin' || currentUser.role === 'HR';

    container.innerHTML = `
      <!-- Project Summary Card -->
      <div class="card">
        <div class="card-header">
          <div>
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px;">
              <span class="badge badge-slate">${window.UI.escapeHtml(activeProject.category)}</span>
              ${window.UI.getStatusBadge(activeProject.status)}
            </div>
            <h2 class="card-title" style="font-size: 20px;">${window.UI.escapeHtml(activeProject.name)}</h2>
          </div>
          <div>
            ${
              activeProject.status !== 'Completed' && isStaff
                ? `<button class="btn btn-sm btn-outline" onclick="window.markProjectCompleted('${activeProject.id}')">Mark as Completed</button>`
                : ''
            }
          </div>
        </div>
        <div class="card-body">
          <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px;">
            ${window.UI.escapeHtml(activeProject.description)}
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; border-top: 1px solid var(--border-subtle); padding-top: 16px;">
            <div>
              <span style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Team Lead</span>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 4px;">
                ${lead ? window.UI.escapeHtml(lead.name) : 'Unassigned'}
              </div>
            </div>
            <div>
              <span style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Team Size</span>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 4px;">
                ${members.length} Members
              </div>
            </div>
            <div>
              <span style="font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase;">Timeline Window</span>
              <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-top: 4px;">
                ${window.UI.formatDate(activeProject.start_date)} &rarr; ${window.UI.formatDate(activeProject.due_date)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline & Collaboration Stream -->
      <div class="timeline-view-wrapper">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div class="timeline-type-nav">
            <button class="timeline-nav-btn ${currentTimelineType === 'Main' ? 'active' : ''}" onclick="window.switchTimeline('Main')">
              Project Stream
            </button>
            ${
              isStaff
                ? `<button class="timeline-nav-btn ${currentTimelineType === 'Staff' ? 'active' : ''}" onclick="window.switchTimeline('Staff')">
                    Staff Notes
                  </button>`
                : ''
            }
          </div>

          <div class="timeline-visibility-banner ${currentTimelineType === 'Staff' ? 'staff' : 'team'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>${
              currentTimelineType === 'Staff'
                ? 'Internal notes (Management only).'
                : 'Project timeline (Team visible).'
            }</span>
          </div>
        </div>

        <!-- Composer -->
        <div class="timeline-composer">
          <div class="composer-header">
            <span>New Update</span>
          </div>
          <textarea id="timelineContentInput" class="composer-textarea" placeholder="Write an update, blocker, or milestone..."></textarea>
          
          <div class="composer-toolbar">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="file" id="timelineFileInput" style="display: none;" onchange="window.handleAttachmentSelected(this)">
              <button class="btn btn-sm btn-secondary" onclick="document.getElementById('timelineFileInput').click()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Attach File
              </button>
              <span id="attachedFileName" style="font-size: 12px; color: var(--text-dim);"></span>
            </div>

            <button class="btn btn-primary btn-sm" onclick="window.submitTimelineUpdate()">Post</button>
          </div>
        </div>

        <!-- Feed List -->
        <div class="timeline-feed" id="timelineFeedContainer">
          <!-- Timeline entries rendered via loadTimelineEntries() -->
        </div>
      </div>
    `;

    loadTimelineEntries();
  }

  function renderPastProjects(container) {
    const past = userProjects.filter((p) => p.status === 'Completed' || p.status === 'Archived');

    if (past.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div class="empty-state-title">No Completed Projects</div>
          <div class="empty-state-desc">Archived project records will appear here.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
        ${past
          .map(
            (p) => `
          <div class="card" style="margin: 0;">
            <div class="card-body">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span class="badge badge-slate">${p.category}</span>
                <span class="badge badge-violet">Completed</span>
              </div>
              <h3 style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">${window.UI.escapeHtml(p.name)}</h3>
              <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">${window.UI.escapeHtml(p.description)}</p>
              <div style="font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                Completed on ${window.UI.formatDate(p.completed_at || p.updated_at)}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  async function loadTimelineEntries() {
    const feed = document.getElementById('timelineFeedContainer');
    if (!feed || !activeProject) return;

    timelineEntries = await window.TimelineService.getTimelineEntries(activeProject.id, currentTimelineType);

    if (timelineEntries.length === 0) {
      feed.innerHTML = `
        <div class="timeline-entry" style="text-align: center; color: var(--text-dim); padding: 32px;">
          No timeline entries recorded in this stream yet. Be the first to share an update!
        </div>
      `;
      return;
    }

    feed.innerHTML = timelineEntries
      .map((entry) => {
        const author = allUsers.find((u) => u.id === entry.user_id) || { name: 'Staff Member', role: 'Team' };
        const attachmentsHtml = (entry.attachments || [])
          .map(
            (att) => `
            <a href="#" class="attachment-badge" onclick="alert('Viewing: ${att.file_name}'); return false;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span>${window.UI.escapeHtml(att.file_name)}</span>
              <span style="color: var(--text-dim);">(${window.UI.formatFileSize(att.file_size)})</span>
            </a>
          `
          )
          .join('');

        const repliesHtml = (entry.replies || [])
          .map((rep) => {
            const repAuthor = allUsers.find((u) => u.id === rep.user_id) || { name: 'Member' };
            return `
              <div class="reply-item">
                <div class="reply-header">
                  <span class="reply-author">${window.UI.escapeHtml(repAuthor.name)}</span>
                  <span class="reply-time">${window.UI.formatDate(rep.created_at)}</span>
                </div>
                <div class="reply-content">${window.UI.escapeHtml(rep.content)}</div>
              </div>
            `;
          })
          .join('');

        return `
          <div class="timeline-entry">
            <div class="entry-node-icon">${window.UI.getInitials(author.name)}</div>
            <div class="entry-header">
              <div class="entry-author">
                <span class="entry-author-name">${window.UI.escapeHtml(author.name)}</span>
                ${window.UI.getRoleBadge(author.role)}
              </div>
              <span class="entry-time">${window.UI.formatDateTime(entry.created_at)}</span>
            </div>

            <div class="entry-content">${window.UI.escapeHtml(entry.content)}</div>

            ${attachmentsHtml ? `<div class="entry-attachments">${attachmentsHtml}</div>` : ''}

            <!-- Replies & Inline Reply Box -->
            <div class="entry-actions">
              <span style="font-size: 12px; color: var(--text-dim);">${(entry.replies || []).length} Replies</span>
            </div>

            ${repliesHtml ? `<div class="replies-list">${repliesHtml}</div>` : ''}

            <div class="reply-composer-inline">
              <input type="text" id="replyInput_${entry.id}" class="reply-input-inline" placeholder="Write a response...">
              <button class="btn btn-sm btn-primary" onclick="window.submitReply('${entry.id}')">Reply</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // Global Actions
  window.switchTimeline = function (type) {
    currentTimelineType = type;
    renderCurrentTab();
  };

  let stagedAttachment = null;
  window.handleAttachmentSelected = function (input) {
    if (input.files && input.files[0]) {
      const file = input.files[0];
      stagedAttachment = {
        id: 'att-' + Date.now(),
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
      };
      document.getElementById('attachedFileName').textContent = file.name;
    }
  };

  window.submitTimelineUpdate = async function () {
    const textEl = document.getElementById('timelineContentInput');
    const content = textEl ? textEl.value.trim() : '';

    if (!content) {
      alert('Please enter an update description.');
      return;
    }

    try {
      const attachments = stagedAttachment ? [stagedAttachment] : [];
      await window.TimelineService.addEntry({
        projectId: activeProject.id,
        timelineType: currentTimelineType,
        content: content,
        attachments: attachments,
      });

      if (textEl) textEl.value = '';
      stagedAttachment = null;
      const fileLabel = document.getElementById('attachedFileName');
      if (fileLabel) fileLabel.textContent = '';

      window.UI.showToast('Update Posted', 'Your progress update has been logged on the timeline.', 'success');
      loadTimelineEntries();
    } catch (e) {
      window.UI.showToast('Error', 'Unable to post timeline update.', 'error');
    }
  };

  window.submitReply = async function (entryId) {
    const input = document.getElementById(`replyInput_${entryId}`);
    const content = input ? input.value.trim() : '';

    if (!content) return;

    try {
      await window.TimelineService.addReply(entryId, content);
      if (input) input.value = '';
      loadTimelineEntries();
    } catch (e) {
      window.UI.showToast('Error', 'Unable to post reply.', 'error');
    }
  };

  window.markProjectCompleted = async function (id) {
    if (!confirm('Mark this project as completed? This will archive the project active stream.')) return;
    try {
      await window.ProjectService.completeProject(id);
      activeProject.status = 'Completed';
      window.UI.showToast('Project Completed', 'Project has been archived successfully.', 'success');
      renderCurrentTab();
    } catch (e) {
      window.UI.showToast('Error', 'Unable to complete project.', 'error');
    }
  };
});
