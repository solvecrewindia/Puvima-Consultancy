/**
 * PUVIMA Consultancy — HR Careers & Resume Verification Controller
 * Allows HR to view candidate applications, inspect profiles, download resumes stored in Supabase,
 * and update recruitment statuses.
 */

(function () {
  'use strict';

  let allApplications = [];
  let currentFilter = 'all';
  let currentSearch = '';
  let activeApp = null;

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const adminToken = localStorage.getItem('puvima_admin_token') || sessionStorage.getItem('puvima_admin_token');
    if (adminToken) headers['x-admin-token'] = adminToken;

    const userRaw = localStorage.getItem('puvima_company_user') || sessionStorage.getItem('puvima_company_user');
    if (userRaw) headers['x-company-user'] = encodeURIComponent(userRaw);

    return headers;
  }

  window.initHrCareersModule = async function (containerEl) {
    if (!containerEl) containerEl = document.getElementById('hrTabContent');
    if (!containerEl) return;

    renderLayout(containerEl);
    bindEvents(containerEl);
    await loadApplications();
  };

  function renderLayout(container) {
    container.innerHTML = `
      <div class="embedded-onboarding-wizard">
        
        <!-- Header Banner -->
        <div class="card" style="background: linear-gradient(135deg, #001D35 0%, #003E7E 100%); color: #FFFFFF; padding: 24px 28px; border-radius: 12px; margin-bottom: 24px;">
          <div style="font-size: 0.75rem; letter-spacing: 0.5px; opacity: 0.85; text-transform: uppercase;">Talent Acquisition &amp; Verification</div>
          <h2 style="font-size: 1.35rem; font-weight: 800; color: #FFFFFF; margin: 4px 0 6px;">
            Candidate Applications &amp; Resumes
          </h2>
          <p style="font-size: 0.88rem; color: #94A3B8; margin: 0; line-height: 1.5;">
            Inspect candidate submissions from Careers and Fellowship channels. All submitted resumes are verified and stored securely in <strong>Supabase</strong>.
          </p>
        </div>

        <!-- Metrics Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 16px 20px; border-left: 4px solid #0072CE;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Total Applications</div>
            <div id="statTotalApps" style="font-size: 1.6rem; font-weight: 800; color: #001D35; margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid #F59E0B;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Under Review</div>
            <div id="statUnderReview" style="font-size: 1.6rem; font-weight: 800; color: #B45309; margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid #0284C7;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Shortlisted</div>
            <div id="statShortlisted" style="font-size: 1.6rem; font-weight: 800; color: #0284C7; margin-top: 4px;">0</div>
          </div>
          <div class="card" style="padding: 16px 20px; border-left: 4px solid #10B981;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Selected / Hired</div>
            <div id="statSelected" style="font-size: 1.6rem; font-weight: 800; color: #059669; margin-top: 4px;">0</div>
          </div>
        </div>

        <!-- Filter & Search Controls -->
        <div class="card" style="padding: 16px 20px; margin-bottom: 20px;">
          <div style="display: flex; gap: 14px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 12px; flex: 1; min-width: 260px;">
              <input type="text" id="careersSearchInput" class="form-input" placeholder="Search by candidate name, email, skills..." style="font-size: 0.88rem; padding: 8px 14px; width: 100%;">
            </div>
            <div style="display: flex; gap: 12px; align-items: center;">
              <select id="careersStatusFilter" class="form-select" style="font-size: 0.88rem; padding: 8px 12px;">
                <option value="all">All Statuses</option>
                <option value="received">Received (New)</option>
                <option value="under_review">Under Review</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="interview">Interview</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
              </select>
              <button id="btnRefreshCareers" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Applications Data Table -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">
              <thead>
                <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">
                  <th style="padding: 12px 16px;">Ref ID</th>
                  <th style="padding: 12px 16px;">Candidate</th>
                  <th style="padding: 12px 16px;">Position</th>
                  <th style="padding: 12px 16px;">Contact</th>
                  <th style="padding: 12px 16px;">Applied Date</th>
                  <th style="padding: 12px 16px;">Status</th>
                  <th style="padding: 12px 16px; text-align: right;">Resume &amp; Action</th>
                </tr>
              </thead>
              <tbody id="careersTableBody">
                <tr><td colspan="7" style="padding: 30px; text-align: center; color: #94A3B8;">Loading candidate applications...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Candidate Inspection & Status Modal -->
      <div id="candidateModal" class="modal-backdrop" style="display: none; align-items: center; justify-content: center; z-index: 9999;">
        <div class="modal-card" style="max-width: 680px; width: 95%; max-height: 90vh; overflow-y: auto; background: #FFFFFF; border-radius: 12px;">
          <div class="modal-header" style="background: #001D35; color: #FFFFFF; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
            <h3 class="modal-title" id="candModalTitle" style="color: #FFFFFF; margin: 0; font-size: 1.15rem;">Candidate Application</h3>
            <button type="button" id="btnCloseCandModal" style="background: none; border: none; color: #FFFFFF; font-size: 1.5rem; cursor: pointer;">&times;</button>
          </div>
          <div class="modal-body" style="padding: 24px;" id="candModalBody">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>
    `;
  }

  function bindEvents(container) {
    const searchInput = container.querySelector('#careersSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim().toLowerCase();
        renderTable();
      });
    }

    const statusFilter = container.querySelector('#careersStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        renderTable();
      });
    }

    const refreshBtn = container.querySelector('#btnRefreshCareers');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadApplications());
    }

    const closeBtn = container.querySelector('#btnCloseCandModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const modal = document.getElementById('candidateModal');
        if (modal) modal.style.display = 'none';
      });
    }
  }

  async function loadApplications() {
    try {
      const res = await fetch('/api/hr/careers/applications', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        allApplications = data.applications || [];
      } else {
        // Fallback check on admin applications route
        const adminRes = await fetch('/api/admin/applications', { headers: getAuthHeaders() });
        if (adminRes.ok) {
          const adminData = await adminRes.json();
          allApplications = adminData.applications || [];
        }
      }
    } catch (e) {
      console.warn('[HrCareers] Error loading applications:', e.message);
    }
    updateStats();
    renderTable();
  }

  function updateStats() {
    const total = allApplications.length;
    const underReview = allApplications.filter(a => a.recruitment_status === 'under_review').length;
    const shortlisted = allApplications.filter(a => a.recruitment_status === 'shortlisted').length;
    const selected = allApplications.filter(a => a.recruitment_status === 'selected').length;

    const elTotal = document.getElementById('statTotalApps');
    const elReview = document.getElementById('statUnderReview');
    const elShort = document.getElementById('statShortlisted');
    const elSel = document.getElementById('statSelected');

    if (elTotal) elTotal.textContent = total;
    if (elReview) elReview.textContent = underReview;
    if (elShort) elShort.textContent = shortlisted;
    if (elSel) elSel.textContent = selected;

    const badge = document.getElementById('hrRecruitmentBadge');
    if (badge) {
      if (total > 0) {
        badge.textContent = total;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function renderTable() {
    const tbody = document.getElementById('careersTableBody');
    if (!tbody) return;

    let filtered = allApplications;

    if (currentFilter !== 'all') {
      filtered = filtered.filter(a => (a.recruitment_status || 'received') === currentFilter);
    }

    if (currentSearch) {
      filtered = filtered.filter(a =>
        (a.applicant_name && a.applicant_name.toLowerCase().includes(currentSearch)) ||
        (a.applicant_email && a.applicant_email.toLowerCase().includes(currentSearch)) ||
        (a.reference_id && a.reference_id.toLowerCase().includes(currentSearch)) ||
        (a.job_title && a.job_title.toLowerCase().includes(currentSearch)) ||
        (a.skills && a.skills.toLowerCase().includes(currentSearch))
      );
    }

    if (!filtered || filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding: 30px; text-align: center; color: #94A3B8;">No candidate applications found matching criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(a => {
      const statusColor = getStatusBadgeStyle(a.recruitment_status);
      const appliedDate = a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
      const resumeUrl = a.resume_url || `/api/hr/careers/applications/${encodeURIComponent(a.id || a.reference_id)}/resume`;

      return `
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 14px 16px; font-family: monospace; font-size: 0.8rem; font-weight: 700; color: #0072CE;">
            ${a.reference_id || a.id}
          </td>
          <td style="padding: 14px 16px;">
            <div style="font-weight: 700; color: #001D35;">${a.applicant_name || 'Anonymous'}</div>
            <div style="font-size: 0.78rem; color: #64748B;">${a.education || ''}</div>
          </td>
          <td style="padding: 14px 16px; font-weight: 600; color: #334155;">
            ${a.job_title || a.position_title || 'General Application'}
          </td>
          <td style="padding: 14px 16px;">
            <div style="color: #0F172A;">${a.applicant_email || ''}</div>
            <div style="font-size: 0.78rem; color: #64748B;">${a.applicant_phone || ''}</div>
          </td>
          <td style="padding: 14px 16px; color: #64748B; font-size: 0.82rem;">
            ${appliedDate}
          </td>
          <td style="padding: 14px 16px;">
            <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; ${statusColor}">
              ${formatStatus(a.recruitment_status)}
            </span>
          </td>
          <td style="padding: 14px 16px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 8px; align-items: center;">
              <a href="${resumeUrl}" target="_blank" class="btn btn-sm" style="background: #0072CE; color: #FFFFFF; font-size: 11px; padding: 6px 12px; border-radius: 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;" title="View Resume in Supabase / New Tab">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span>View Resume</span>
              </a>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.openCandidateModal('${a.reference_id || a.id}')" style="font-size: 11px; padding: 6px 10px;">
                Review
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.openCandidateModal = function (appId) {
    const app = allApplications.find(a => String(a.id) === String(appId) || a.reference_id === appId);
    if (!app) return;
    activeApp = app;

    const modal = document.getElementById('candidateModal');
    const body = document.getElementById('candModalBody');
    const title = document.getElementById('candModalTitle');
    if (!modal || !body) return;

    title.textContent = `Candidate Review: ${app.applicant_name} (${app.reference_id})`;

    const resumeUrl = app.resume_url || `/api/hr/careers/applications/${encodeURIComponent(app.id || app.reference_id)}/resume`;

    body.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
        <div style="background: #F8FAFC; padding: 12px 14px; border-radius: 8px;">
          <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Position Applied</div>
          <div style="font-weight: 700; color: #001D35; font-size: 0.95rem;">${app.job_title || 'General'}</div>
        </div>
        <div style="background: #F8FAFC; padding: 12px 14px; border-radius: 8px;">
          <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Experience Band</div>
          <div style="font-weight: 700; color: #001D35; font-size: 0.95rem;">${app.experience_years || 'Not specified'}</div>
        </div>
        <div style="background: #F8FAFC; padding: 12px 14px; border-radius: 8px;">
          <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Email Address</div>
          <div style="color: #0072CE; font-weight: 600;"><a href="mailto:${app.applicant_email}">${app.applicant_email}</a></div>
        </div>
        <div style="background: #F8FAFC; padding: 12px 14px; border-radius: 8px;">
          <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Contact Phone</div>
          <div style="color: #001D35; font-weight: 600;">${app.applicant_phone || '-'}</div>
        </div>
      </div>

      <!-- Resume Access Card -->
      <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 0.88rem; font-weight: 700; color: #1E40AF;">
            ${app.resume_filename || 'Candidate_Resume.pdf'}
          </div>
          <div style="font-size: 0.78rem; color: #3B82F6;">
            Stored in Supabase Cloud Storage &bull; Secure HR Access
          </div>
        </div>
        <a href="${resumeUrl}" target="_blank" class="btn btn-primary btn-sm" style="background: #0072CE; color: #FFFFFF; font-size: 12px; padding: 8px 16px; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Open Full Resume</span>
        </a>
      </div>

      <!-- Skills & Education -->
      <div style="margin-bottom: 16px;">
        <div style="font-size: 0.78rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px;">Technical Competencies &amp; Skills</div>
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; font-size: 0.88rem; color: #334155; line-height: 1.5;">
          ${app.skills || 'No skills listed.'}
        </div>
      </div>

      <!-- Cover Letter -->
      ${app.cover_letter ? `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.78rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px;">Candidate Statement / Cover Letter</div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 14px; font-size: 0.85rem; color: #475569; line-height: 1.6; max-height: 160px; overflow-y: auto;">
            ${app.cover_letter}
          </div>
        </div>
      ` : ''}

      <!-- Status Update Controls -->
      <div style="border-top: 1px solid #E2E8F0; padding-top: 18px; margin-top: 20px;">
        <h4 style="font-size: 0.95rem; font-weight: 700; color: #001D35; margin: 0 0 12px;">Update Recruitment Status</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Status Decision</label>
            <select id="candNewStatus" class="form-select" style="width: 100%; font-size: 0.88rem; padding: 8px 10px;">
              <option value="received" ${app.recruitment_status === 'received' ? 'selected' : ''}>Received (New)</option>
              <option value="under_review" ${app.recruitment_status === 'under_review' ? 'selected' : ''}>Under Review</option>
              <option value="shortlisted" ${app.recruitment_status === 'shortlisted' ? 'selected' : ''}>Shortlisted</option>
              <option value="interview" ${app.recruitment_status === 'interview' ? 'selected' : ''}>Interview Scheduled</option>
              <option value="selected" ${app.recruitment_status === 'selected' ? 'selected' : ''}>Selected / Offer Sent</option>
              <option value="rejected" ${app.recruitment_status === 'rejected' ? 'selected' : ''}>Rejected</option>
            </select>
          </div>
          <div>
            <label style="font-size: 0.75rem; font-weight: 700; color: #64748B; text-transform: uppercase;">HR Evaluation Notes</label>
            <input type="text" id="candAdminNotes" class="form-input" style="width: 100%; font-size: 0.88rem; padding: 8px 10px;" placeholder="Add internal HR remarks..." value="${app.admin_notes || ''}">
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('candidateModal').style.display='none'">Close</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.saveCandidateStatus('${app.reference_id || app.id}')" style="background: #001D35; color: #FFFFFF;">
            Save Status &amp; Notes
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  };

  window.saveCandidateStatus = async function (appId) {
    const statusSelect = document.getElementById('candNewStatus');
    const notesInput = document.getElementById('candAdminNotes');
    if (!statusSelect) return;

    const newStatus = statusSelect.value;
    const notes = notesInput ? notesInput.value.trim() : '';

    try {
      const res = await fetch(`/api/hr/careers/applications/${encodeURIComponent(appId)}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus, admin_notes: notes })
      });

      if (res.ok) {
        alert('Candidate recruitment status updated successfully!');
        const modal = document.getElementById('candidateModal');
        if (modal) modal.style.display = 'none';
        await loadApplications();
      } else {
        const err = await res.json();
        alert('Error updating status: ' + (err.message || 'Server error'));
      }
    } catch (e) {
      alert('Error updating candidate status: ' + e.message);
    }
  };

  function formatStatus(status) {
    const map = {
      received: 'Received',
      under_review: 'Under Review',
      shortlisted: 'Shortlisted',
      interview: 'Interview',
      selected: 'Selected',
      rejected: 'Rejected'
    };
    return map[status] || status || 'Received';
  }

  function getStatusBadgeStyle(status) {
    switch (status) {
      case 'shortlisted':
        return 'background: #E0F2FE; color: #0284C7;';
      case 'interview':
        return 'background: #EDE9FE; color: #6D28D9;';
      case 'selected':
        return 'background: #DCFCE7; color: #16A34A;';
      case 'rejected':
        return 'background: #FEE2E2; color: #DC2626;';
      case 'under_review':
        return 'background: #FEF3C7; color: #B45309;';
      default:
        return 'background: #F1F5F9; color: #475569;';
    }
  }

})();
