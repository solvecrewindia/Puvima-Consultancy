/**
 * Puvima IT Service and Research Consultancy — HR Letter of Recommendation (LOR) Verification Controller
 * Displays all intern LOR requests, professor endorsement status, remarks,
 * and allows HR to approve, reject, and generate official LOR PDFs.
 */

(function () {
  'use strict';

  let allLorRequests = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let activeModalLor = null;

  window.initHrLorModule = async function (container) {
    if (!container) return;

    container.innerHTML = `
      <div class="embedded-onboarding-wizard">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
          <div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: #001D35; margin: 0 0 4px;">
              Letter of Recommendation (LOR) Verification
            </h2>
            <p style="font-size: 0.88rem; color: #64748B; margin: 0;">
              Review academic mentor endorsements, verify intern deliverables, and issue official PUVIMA LORs.
            </p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btnRefreshHrLor">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            Refresh Records
          </button>
        </div>

        <!-- Metric Stat Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="card" style="padding: 18px; border-left: 4px solid #001D35;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Total LOR Requests</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #001D35; margin-top: 4px;" id="statTotalLor">0</div>
          </div>
          <div class="card" style="padding: 18px; border-left: 4px solid #D97706;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #D97706; font-weight: 700;">Awaiting Professor</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #D97706; margin-top: 4px;" id="statPendingProf">0</div>
          </div>
          <div class="card" style="padding: 18px; border-left: 4px solid #0284C7;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #0284C7; font-weight: 700;">Endorsed by Professor</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #0284C7; margin-top: 4px;" id="statEndorsedProf">0</div>
          </div>
          <div class="card" style="padding: 18px; border-left: 4px solid #16A34A;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #16A34A; font-weight: 700;">HR Approved &amp; Issued</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #16A34A; margin-top: 4px;" id="statIssuedLor">0</div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="card" style="padding: 16px 20px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            
            <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="lorFilterPills">
              <button type="button" class="btn btn-sm btn-primary filter-pill active" data-filter="all">All Requests</button>
              <button type="button" class="btn btn-sm btn-secondary filter-pill" data-filter="Confirmed by Professor">Endorsed by Professor</button>
              <button type="button" class="btn btn-sm btn-secondary filter-pill" data-filter="Email Sent to Professor">Awaiting Mentor</button>
              <button type="button" class="btn btn-sm btn-secondary filter-pill" data-filter="HR Approved">Approved / Issued</button>
            </div>

            <div style="min-width: 240px;">
              <input type="text" id="inputLorSearch" class="form-control form-control-sm" placeholder="Search by intern, professor, or ID...">
            </div>

          </div>
        </div>

        <!-- Table Card -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead style="background: #F8FAFC; border-bottom: 2px solid #E2E8F0;">
                <tr>
                  <th style="padding: 12px 16px; text-align: left;">Request ID</th>
                  <th style="padding: 12px 16px; text-align: left;">Intern Details</th>
                  <th style="padding: 12px 16px; text-align: left;">Nominated Professor</th>
                  <th style="padding: 12px 16px; text-align: left;">Mentor Status</th>
                  <th style="padding: 12px 16px; text-align: left;">Overall Stage</th>
                  <th style="padding: 12px 16px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="tbodyHrLor">
                <tr><td colspan="6" style="padding: 30px; text-align: center; color: #94A3B8;">Loading LOR applications...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Detail Modal -->
      <div class="modal-backdrop" id="modalHrLorDetail" style="display: none;">
        <div class="modal-card" style="max-width: 720px; width: 90%;">
          <div class="modal-header">
            <h3 class="modal-title" id="m_lorTitle">LOR Application Details</h3>
            <button class="modal-close" id="btnCloseLorModal">&times;</button>
          </div>
          <div class="modal-body" id="m_lorBody" style="padding: 24px; max-height: 75vh; overflow-y: auto;">
            <!-- Populated dynamically -->
          </div>
          <div class="modal-footer" id="m_lorFooter">
            <!-- Action buttons -->
          </div>
        </div>
      </div>
    `;

    await loadData();

    // Event bindings
    document.getElementById('btnRefreshHrLor').addEventListener('click', loadData);

    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(b => {
          b.classList.remove('btn-primary', 'active');
          b.classList.add('btn-secondary');
        });
        btn.classList.add('btn-primary', 'active');
        btn.classList.remove('btn-secondary');
        currentFilter = btn.getAttribute('data-filter');
        renderTable();
      });
    });

    document.getElementById('inputLorSearch').addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTable();
    });

    document.getElementById('btnCloseLorModal').addEventListener('click', () => {
      document.getElementById('modalHrLorDetail').style.display = 'none';
    });
  };

  async function loadData() {
    try {
      const [reqRes, statsRes] = await Promise.all([
        fetch('/api/hr/lor/requests?limit=100'),
        fetch('/api/hr/lor/stats')
      ]);

      const reqData = await reqRes.json();
      const statsData = await statsRes.json();

      if (reqData.success) {
        allLorRequests = reqData.requests || [];
      }

      if (statsData.success && statsData.stats) {
        const s = statsData.stats;
        document.getElementById('statTotalLor').textContent = s.total || 0;
        document.getElementById('statPendingProf').textContent = s.pending_professor || 0;
        document.getElementById('statEndorsedProf').textContent = s.confirmed_by_professor || 0;
        document.getElementById('statIssuedLor').textContent = s.hr_approved || 0;

        // Update HR Badge
        const badge = document.getElementById('hrLorBadge');
        if (badge) {
          if (s.confirmed_by_professor > 0) {
            badge.textContent = `${s.confirmed_by_professor} Endorsed`;
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }
      }

      renderTable();
    } catch (e) {
      console.error('[HrLorController] Error loading data:', e);
    }
  }

  function renderTable() {
    const tbody = document.getElementById('tbodyHrLor');
    if (!tbody) return;

    let list = [...allLorRequests];

    if (currentFilter !== 'all') {
      list = list.filter(r => r.status && r.status.toLowerCase() === currentFilter.toLowerCase());
    }

    if (searchQuery) {
      list = list.filter(r =>
        (r.lor_request_id && r.lor_request_id.toLowerCase().includes(searchQuery)) ||
        (r.intern_name && r.intern_name.toLowerCase().includes(searchQuery)) ||
        (r.intern_email && r.intern_email.toLowerCase().includes(searchQuery)) ||
        (r.professor_name && r.professor_name.toLowerCase().includes(searchQuery)) ||
        (r.professor_institution && r.professor_institution.toLowerCase().includes(searchQuery))
      );
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 40px; text-align: center; color: #94A3B8;">
            No LOR requests match the selected criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(r => {
      const isEndorsed = Boolean(r.professor_confirmed_at);
      const isApproved = r.status === 'HR Approved' || r.status === 'LOR Issued';

      return `
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 12px 16px; font-family: monospace; font-weight: 700; color: #001D35;">
            ${r.lor_request_id}
          </td>
          <td style="padding: 12px 16px;">
            <div style="font-weight: 700; color: #0F172A;">${window.UI.escapeHtml(r.intern_name)}</div>
            <div style="font-size: 0.75rem; color: #64748B;">${window.UI.escapeHtml(r.domain_specialization)} • ${window.UI.escapeHtml(r.college_university)}</div>
          </td>
          <td style="padding: 12px 16px;">
            <div style="font-weight: 600; color: #001D35;">${window.UI.escapeHtml(r.professor_name)}</div>
            <div style="font-size: 0.75rem; color: #64748B;">${window.UI.escapeHtml(r.professor_institution)}</div>
          </td>
          <td style="padding: 12px 16px;">
            ${isEndorsed ? `
              <span class="upload-status-badge status-badge-verified">
                ✓ Confirmed (${r.professor_rating || 'Endorsed'})
              </span>
            ` : `
              <span class="upload-status-badge status-badge-pending">
                Awaiting Mentor
              </span>
            `}
          </td>
          <td style="padding: 12px 16px;">
            <span class="upload-status-badge ${isApproved ? 'status-badge-verified' : (isEndorsed ? 'status-badge-uploaded' : 'status-badge-pending')}">
              ${r.status}
            </span>
          </td>
          <td style="padding: 12px 16px; text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn-secondary btn-sm btn-lor-inspect" data-lor-id="${r.id}" style="padding: 4px 10px; font-size: 11px;">
              Inspect
            </button>
            ${isApproved ? `
              <a href="/api/lor/${r.id}/pdf" target="_blank" class="btn btn-success btn-sm" style="padding: 4px 10px; font-size: 11px; margin-left: 6px;">
                PDF
              </a>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-lor-inspect').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-lor-id');
        openLorDetailModal(id);
      });
    });
  }

  function openLorDetailModal(lorId) {
    const lor = allLorRequests.find(r => r.id === lorId);
    if (!lor) return;

    activeModalLor = lor;
    const modal = document.getElementById('modalHrLorDetail');
    const titleEl = document.getElementById('m_lorTitle');
    const bodyEl = document.getElementById('m_lorBody');
    const footerEl = document.getElementById('m_lorFooter');

    titleEl.textContent = `LOR Inspection — ${lor.lor_request_id}`;

    const isEndorsed = Boolean(lor.professor_confirmed_at);
    const isApproved = lor.status === 'HR Approved' || lor.status === 'LOR Issued';

    bodyEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Status Header -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748B;">Application ID</div>
            <div style="font-family: monospace; font-size: 1.1rem; font-weight: 700; color: #001D35;">${lor.lor_request_id}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748B;">Current Status</div>
            <span class="upload-status-badge ${isApproved ? 'status-badge-verified' : (isEndorsed ? 'status-badge-uploaded' : 'status-badge-pending')}">
              ${lor.status}
            </span>
          </div>
        </div>

        <!-- Two Column Section -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          
          <!-- Candidate Credentials -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px;">
            <h4 style="font-size: 0.9rem; font-weight: 700; color: #001D35; margin-bottom: 12px; border-bottom: 1px solid #F1F5F9; padding-bottom: 6px;">
              Intern Credentials
            </h4>
            <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 8px;">
              <div><strong>Name:</strong> ${window.UI.escapeHtml(lor.intern_name)}</div>
              <div><strong>Email:</strong> ${window.UI.escapeHtml(lor.intern_email)}</div>
              <div><strong>Domain:</strong> ${window.UI.escapeHtml(lor.domain_specialization)}</div>
              <div><strong>College:</strong> ${window.UI.escapeHtml(lor.college_university)}</div>
              <div><strong>Tenure:</strong> ${lor.internship_start_date} &rarr; ${lor.internship_end_date}</div>
              <div><strong>Purpose:</strong> ${window.UI.escapeHtml(lor.purpose_of_lor)}</div>
            </div>
          </div>

          <!-- Academic Mentor Endorsement Details -->
          <div style="background: ${isEndorsed ? '#F0FDF4' : '#EFF6FF'}; border: 1px solid ${isEndorsed ? '#BBF7D0' : '#BFDBFE'}; border-radius: 8px; padding: 16px;">
            <h4 style="font-size: 0.9rem; font-weight: 700; color: #001D35; margin-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.06); padding-bottom: 6px;">
              Faculty Mentor Verification
            </h4>
            <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 8px;">
              <div><strong>Mentor:</strong> ${window.UI.escapeHtml(lor.professor_name)}</div>
              <div><strong>Designation:</strong> ${window.UI.escapeHtml(lor.professor_designation)}</div>
              <div><strong>Institution:</strong> ${window.UI.escapeHtml(lor.professor_institution)}</div>
              <div><strong>Email:</strong> <code>${window.UI.escapeHtml(lor.professor_email)}</code></div>
              <div><strong>Contact Phone:</strong> ${window.UI.escapeHtml(lor.professor_phone)}</div>
              <div style="border-top: 1px dashed rgba(0,0,0,0.1); padding-top: 8px; margin-top: 4px;">
                <strong>Endorsement:</strong>
                ${isEndorsed ? `
                  <span style="color: #16A34A; font-weight: 700;">✓ Confirmed on ${new Date(lor.professor_confirmed_at).toLocaleDateString()}</span>
                  <div style="margin-top: 4px;">Strength: <strong>${lor.professor_rating || 'Strongly Recommended'}</strong></div>
                  ${lor.professor_endorsement_remarks ? `<div style="margin-top: 4px; font-style: italic; color: #334155;">"${lor.professor_endorsement_remarks}"</div>` : ''}
                ` : `
                  <span style="color: #D97706; font-weight: 600;">Pending Professor Response</span>
                `}
              </div>
            </div>
          </div>

        </div>

        <!-- Project Deliverables -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px;">
          <h4 style="font-size: 0.85rem; font-weight: 700; color: #001D35; margin-bottom: 6px;">
            Project: ${window.UI.escapeHtml(lor.project_title)}
          </h4>
          <p style="font-size: 0.82rem; color: #475569; margin: 0; line-height: 1.5;">
            ${window.UI.escapeHtml(lor.project_deliverables)}
          </p>
        </div>

        <!-- Direct Verification Link Info -->
        <div style="font-size: 0.78rem; color: #64748B; background: #FFFFFF; border: 1px dashed #CBD5E1; padding: 10px 14px; border-radius: 6px;">
          <strong>Mentor Verification URL:</strong>
          <span style="font-family: monospace; word-break: break-all; margin-left: 6px;">/company/lorconfirm?token=${lor.verification_token}</span>
        </div>

      </div>
    `;

    footerEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; flex-wrap: wrap; gap: 12px;">
        <button type="button" class="btn btn-secondary" onclick="document.getElementById('modalHrLorDetail').style.display='none'">
          Dismiss
        </button>
        <div style="display: flex; gap: 10px;">
          ${!isEndorsed ? `
            <button type="button" class="btn btn-secondary btn-sm" id="btnModalResendEmail">
              Resend Email to Mentor
            </button>
          ` : ''}
          ${!isApproved ? `
            <button type="button" class="btn btn-success" id="btnModalApproveLor" style="background: #16A34A; border-color: #16A34A;">
              ✓ Approve &amp; Issue Official LOR
            </button>
          ` : `
            <a href="/api/lor/${lor.id}/pdf" target="_blank" class="btn btn-primary" style="background: #001D35; border-color: #001D35;">
              Download Official LOR (PDF)
            </a>
          `}
        </div>
      </div>
    `;

    // Resend Email
    const resendBtn = document.getElementById('btnModalResendEmail');
    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        try {
          const res = await fetch(`/api/lor/${lor.id}/resend-email`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            alert('Verification email has been resent to ' + lor.professor_email);
          } else {
            alert('Error: ' + data.message);
          }
        } catch (e) {
          alert('Error: ' + e.message);
        }
      });
    }

    // Approve LOR
    const approveBtn = document.getElementById('btnModalApproveLor');
    if (approveBtn) {
      approveBtn.addEventListener('click', async () => {
        const remarks = prompt('Optional: Enter HR verification clearance note:', 'Academic mentor endorsement verified and cleared by HR.');
        if (remarks === null) return;

        approveBtn.disabled = true;
        approveBtn.innerHTML = 'Approving &amp; Generating LOR...';

        try {
          const res = await fetch(`/api/hr/lor/${lor.id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hrRemarks: remarks })
          });

          const data = await res.json();
          if (!data.success) throw new Error(data.message || 'Approval failed.');

          alert('Letter of Recommendation officially Approved and Issued!');
          modal.style.display = 'none';
          await loadData();
        } catch (err) {
          alert('Error approving LOR: ' + err.message);
          approveBtn.disabled = false;
          approveBtn.innerHTML = '✓ Approve &amp; Issue Official LOR';
        }
      });
    }

    modal.style.display = 'flex';
  }

})();
