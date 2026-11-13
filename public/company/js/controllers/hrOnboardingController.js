/**
 * Puvima IT Service and Research Consultancy — HR Onboarding & Verification Controller
 * Full verification lifecycle: Review -> Document Inspection -> Approve / Correct / Reject
 */

(function () {
  'use strict';

  let allApplications = [];
  let currentFilter = {
    status: 'ALL',
    position: 'ALL',
    search: '',
    sort: 'newest'
  };
  let activeAppDetail = null;

  // Initialize when tab or page loads
  window.initHrOnboardingModule = async function (containerEl) {
    if (!containerEl) containerEl = document.getElementById('hrTabContent');
    if (!containerEl) return;

    renderModuleLayout(containerEl);
    bindModuleEvents(containerEl);
    await refreshOnboardingData();
  };

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const adminToken = localStorage.getItem('puvima_admin_token') || sessionStorage.getItem('puvima_admin_token');
    if (adminToken) {
      headers['x-admin-token'] = adminToken;
    }
    const portalUser = localStorage.getItem('puvima_portal_auth_user');
    if (portalUser) {
      headers['x-portal-user'] = encodeURIComponent(portalUser);
    }
    return headers;
  }

  // --- LAYOUT RENDERING ---
  function renderModuleLayout(container) {
    container.innerHTML = `
      <div class="onb-hr-wrapper">
        
        <!-- Header & Action Ribbon -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-family: var(--font-display, 'Manrope'); font-size: 1.35rem; font-weight: 800; color: #001D35;">
              Onboarding &amp; HR Verification Management
            </h2>
            <p style="font-size: 0.85rem; color: #64748B;">
              Review applicant submissions, inspect uploaded credentials, issue corrections, or approve official onboarding.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <a href="/onboarding" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              Applicant Portal Preview
            </a>
            <button type="button" class="btn btn-primary btn-sm" id="btnRefreshOnbList">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              Refresh
            </button>
          </div>
        </div>

        <!-- Metrics Banner -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px;">
          <div class="stat-card" style="border-left: 4px solid #001D35; padding: 16px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Total Applications</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #001D35;" id="metricTotal">0</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #0B57D0; padding: 16px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">New / Submitted</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #0B57D0;" id="metricNew">0</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #D97706; padding: 16px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Under Review</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #D97706;" id="metricPending">0</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #DC2626; padding: 16px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Correction Req.</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #DC2626;" id="metricCorrection">0</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #16A34A; padding: 16px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Approved</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #16A34A;" id="metricApproved">0</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #991B1B; padding: 16px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #64748B; font-weight: 700;">Rejected</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #991B1B;" id="metricRejected">0</div>
          </div>
        </div>

        <!-- Filters & Search Toolbar -->
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;">
          <div style="display: flex; gap: 12px; flex: 1; min-width: 280px; max-width: 450px;">
            <input type="text" id="hrOnbSearchInput" class="form-control" placeholder="Search by name, email, or PV-ONB ID..." style="font-size: 0.85rem; padding: 8px 12px;">
          </div>
          
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <div>
              <select id="hrOnbFilterPosition" class="form-control" style="font-size: 0.82rem; padding: 8px 10px;">
                <option value="ALL">All Positions</option>
                <option value="Intern">Intern</option>
                <option value="Project Trainee">Project Trainee</option>
                <option value="Research Associate">Research Associate</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <select id="hrOnbFilterStatus" class="form-control" style="font-size: 0.82rem; padding: 8px 10px;">
                <option value="ALL">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under HR Review</option>
                <option value="documents_under_verification">Docs Under Verification</option>
                <option value="correction_required">Correction Required</option>
                <option value="resubmitted">Resubmitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <select id="hrOnbSort" class="form-control" style="font-size: 0.82rem; padding: 8px 10px;">
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Applications Data Table -->
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
            <thead>
              <tr style="background: #F8FAFC; border-bottom: 2px solid #E2E8F0; color: #475569;">
                <th style="padding: 12px 16px;">Application ID</th>
                <th style="padding: 12px 16px;">Applicant Name</th>
                <th style="padding: 12px 16px;">Position</th>
                <th style="padding: 12px 16px;">Submitted Date</th>
                <th style="padding: 12px 16px;">Documents</th>
                <th style="padding: 12px 16px;">Verification Status</th>
                <th style="padding: 12px 16px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="hrOnbTableBody">
              <tr>
                <td colspan="7" style="padding: 30px; text-align: center; color: #94A3B8;">Loading onboarding applications...</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- Application Inspection Modal -->
      <div id="hrAppModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 10000; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: #FFFFFF; width: 100%; max-width: 1200px; height: 90vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
          
          <!-- Modal Header -->
          <div style="padding: 18px 24px; border-bottom: 1px solid #E2E8F0; background: #001D35; color: #FFFFFF; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <h3 style="font-family: var(--font-display, 'Manrope'); font-size: 1.15rem; font-weight: 700; margin: 0;" id="modalAppIdTitle">
                Review Application: PV-ONB-...
              </h3>
              <span id="modalAppStatusBadge" style="font-size: 0.75rem; padding: 3px 10px; border-radius: 9999px; font-weight: 700; text-transform: uppercase;"></span>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <button type="button" class="btn btn-secondary btn-sm" id="btnModalDownloadPdf" style="color: #001D35;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download Form (PDF)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="btnModalAuditHistory" style="color: #001D35;">
                Audit Log
              </button>
              <button type="button" id="btnCloseHrModal" style="background: none; border: none; color: #FFFFFF; font-size: 1.5rem; cursor: pointer; line-height: 1; padding: 0 6px;">&times;</button>
            </div>
          </div>

          <!-- Modal Body: Two-Column Inspection Layout -->
          <div style="flex: 1; display: grid; grid-template-columns: 1.1fr 1fr; overflow: hidden;">
            
            <!-- LEFT COLUMN: Applicant Details & Credentials -->
            <div style="padding: 24px; overflow-y: auto; border-right: 1px solid #E2E8F0; background: #F8FAFC;">
              
              <!-- Position Info Box -->
              <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: #001D35; margin-bottom: 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 6px;">
                  1. Applied Position
                </h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.82rem;">
                  <div><strong>Position:</strong> <span id="mPosTitle">-</span></div>
                  <div><strong>Domain:</strong> <span id="mPosDomain">-</span></div>
                  <div><strong>Joining Date:</strong> <span id="mPosJoin">-</span></div>
                  <div><strong>Duration:</strong> <span id="mPosDur">-</span></div>
                </div>
              </div>

              <!-- Personal Information -->
              <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: #001D35; margin-bottom: 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 6px;">
                  2. Personal Identification
                </h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.82rem;">
                  <div><strong>Full Name:</strong> <span id="mPiName">-</span></div>
                  <div><strong>Date of Birth:</strong> <span id="mPiDob">-</span></div>
                  <div><strong>Gender:</strong> <span id="mPiGender">-</span></div>
                  <div><strong>Nationality:</strong> <span id="mPiNationality">-</span></div>
                  <div><strong>Govt ID / Aadhaar:</strong> <span id="mPiAadhaar" style="font-family: monospace; font-weight: 600;">-</span></div>
                  <div><strong>Blood Group:</strong> <span id="mPiBlood">-</span></div>
                </div>
              </div>

              <!-- Contact & Addresses -->
              <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: #001D35; margin-bottom: 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 6px;">
                  3. Contact &amp; Addresses
                </h4>
                <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 8px;">
                  <div><strong>Mobile:</strong> <span id="mCntPhone">-</span> | <strong>Email:</strong> <span id="mCntEmail">-</span></div>
                  <div><strong>Permanent Address:</strong> <div id="mCntPerm" style="color: #475569; margin-top: 2px;">-</div></div>
                  <div><strong>Current Address:</strong> <div id="mCntCurr" style="color: #475569; margin-top: 2px;">-</div></div>
                </div>
              </div>

              <!-- Academic Qualifications -->
              <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: #001D35; margin-bottom: 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 6px;">
                  4. Academic Details
                </h4>
                <div id="mAcademicList" style="font-size: 0.82rem;"></div>
              </div>

              <!-- Skills & Projects -->
              <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: #001D35; margin-bottom: 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 6px;">
                  5. Skills &amp; Projects
                </h4>
                <div style="font-size: 0.82rem; margin-bottom: 8px;"><strong>Technical Skills:</strong> <span id="mSkills">-</span></div>
                <div style="font-size: 0.82rem; margin-bottom: 10px;"><strong>Tools / Platforms:</strong> <span id="mTools">-</span></div>
                <div id="mProjectsList" style="font-size: 0.82rem;"></div>
              </div>

              <!-- Emergency Contact -->
              <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: #001D35; margin-bottom: 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 6px;">
                  6. Emergency Contact
                </h4>
                <div style="font-size: 0.82rem; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div><strong>Name:</strong> <span id="mEmgName">-</span></div>
                  <div><strong>Relationship:</strong> <span id="mEmgRel">-</span></div>
                  <div><strong>Mobile:</strong> <span id="mEmgPhone">-</span></div>
                  <div><strong>Alternate:</strong> <span id="mEmgAlt">-</span></div>
                </div>
              </div>

              <!-- Bank Details (Restricted HR Access) -->
              <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px;">
                <h4 style="font-size: 0.9rem; font-weight: 700; color: #92400E; margin-bottom: 10px; border-bottom: 1px solid #FDE68A; padding-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  7. Bank Account Details (Confidential)
                </h4>
                <div style="font-size: 0.82rem; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div><strong>Account Holder:</strong> <span id="mBnkHolder">-</span></div>
                  <div><strong>Bank Name:</strong> <span id="mBnkName">-</span></div>
                  <div><strong>Account Number:</strong> <span id="mBnkAcc" style="font-family: monospace; font-weight: 700;">-</span></div>
                  <div><strong>IFSC Code:</strong> <span id="mBnkIfsc" style="font-family: monospace; font-weight: 700;">-</span></div>
                </div>
              </div>

            </div>

            <!-- RIGHT COLUMN: Uploaded Documents Verification -->
            <div style="padding: 24px; overflow-y: auto; background: #FFFFFF; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4 style="font-family: var(--font-display, 'Manrope'); font-size: 1rem; font-weight: 700; color: #001D35; margin: 0;">
                  Uploaded Documents &amp; Credentials Inspection
                </h4>
                <span style="font-size: 0.78rem; color: #64748B;">Verify each credential individually</span>
              </div>

              <div id="mDocsContainer" style="display: flex; flex-direction: column; gap: 14px; flex: 1;">
                <!-- Rendered dynamically -->
              </div>
            </div>

          </div>

          <!-- Modal Footer: Primary Action Buttons -->
          <div style="padding: 16px 24px; border-top: 1px solid #E2E8F0; background: #F8FAFC; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="font-size: 0.82rem; color: #64748B;" id="modalDocSummaryNotice">
              Ensure all mandatory documents are marked <strong>Verified</strong> before granting final approval.
            </div>
            
            <div style="display: flex; gap: 10px;">
              <button type="button" class="btn btn-secondary" id="btnActionReject" style="color: #991B1B; border-color: #FECACA;">
                Reject Application
              </button>
              <button type="button" class="btn btn-secondary" id="btnActionCorrection" style="color: #D97706; border-color: #FDE68A;">
                Request Corrections
              </button>
              <button type="button" class="btn btn-success" id="btnActionApprove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                APPROVE APPLICATION
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- Correction Request Modal -->
      <div id="hrCorrectionModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 10001; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: #FFFFFF; width: 100%; max-width: 550px; border-radius: 10px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #001D35; margin-bottom: 12px;">Request Application Corrections</h3>
          <p style="font-size: 0.85rem; color: #64748B; margin-bottom: 16px;">
            Select which sections or documents require update, and provide clear guidance for the applicant.
          </p>

          <div style="margin-bottom: 16px;">
            <label style="font-size: 0.82rem; font-weight: 700; color: #334155; margin-bottom: 6px; display: block;">Select Sections Needing Attention:</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.82rem;">
              <label><input type="checkbox" class="corr-field-chk" value="Position Details"> Position Details</label>
              <label><input type="checkbox" class="corr-field-chk" value="Personal Information"> Personal Info</label>
              <label><input type="checkbox" class="corr-field-chk" value="Contact / Addresses"> Contact / Addresses</label>
              <label><input type="checkbox" class="corr-field-chk" value="Academic Qualifications"> Academic Info</label>
              <label><input type="checkbox" class="corr-field-chk" value="Skills & Projects"> Skills &amp; Projects</label>
              <label><input type="checkbox" class="corr-field-chk" value="Emergency Contact"> Emergency Contact</label>
              <label><input type="checkbox" class="corr-field-chk" value="Bank Details"> Bank Details</label>
              <label><input type="checkbox" class="corr-field-chk" value="Uploaded Documents"> Uploaded Documents</label>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <label for="corrRemarksText" style="font-size: 0.82rem; font-weight: 700; color: #334155; margin-bottom: 6px; display: block;">HR Correction Remarks <span style="color: #DC2626;">*</span></label>
            <textarea id="corrRemarksText" class="form-control" rows="3" placeholder="Explain exactly what needs correction (e.g. Please re-upload clearer marksheet and verify Aadhaar number)..." required></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn btn-secondary" id="btnCancelCorrection">Cancel</button>
            <button type="button" class="btn btn-primary" id="btnSubmitCorrection">Submit Correction Request</button>
          </div>
        </div>
      </div>

      <!-- Audit History Modal -->
      <div id="hrAuditModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); z-index: 10002; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: #FFFFFF; width: 100%; max-width: 650px; max-height: 80vh; border-radius: 10px; padding: 24px; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #001D35; margin: 0;">Verification Audit Timeline</h3>
            <button type="button" id="btnCloseAuditModal" style="background: none; border: none; font-size: 1.4rem; cursor: pointer;">&times;</button>
          </div>
          <div id="auditLogContent" style="flex: 1; overflow-y: auto; padding-right: 6px;"></div>
        </div>
      </div>
    `;
  }

  // --- EVENT BINDINGS ---
  function bindModuleEvents(container) {
    const btnRefresh = document.getElementById('btnRefreshOnbList');
    if (btnRefresh) btnRefresh.addEventListener('click', refreshOnboardingData);

    const searchInput = document.getElementById('hrOnbSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentFilter.search = e.target.value.trim().toLowerCase();
        renderApplicationsTable();
      });
    }

    const posSelect = document.getElementById('hrOnbFilterPosition');
    if (posSelect) {
      posSelect.addEventListener('change', (e) => {
        currentFilter.position = e.target.value;
        renderApplicationsTable();
      });
    }

    const statusSelect = document.getElementById('hrOnbFilterStatus');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        currentFilter.status = e.target.value;
        renderApplicationsTable();
      });
    }

    const sortSelect = document.getElementById('hrOnbSort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentFilter.sort = e.target.value;
        renderApplicationsTable();
      });
    }

    // Modal Close
    const btnCloseHrModal = document.getElementById('btnCloseHrModal');
    if (btnCloseHrModal) {
      btnCloseHrModal.addEventListener('click', () => {
        document.getElementById('hrAppModal').style.display = 'none';
        activeAppDetail = null;
      });
    }

    // PDF Download from Modal
    const btnModalDownloadPdf = document.getElementById('btnModalDownloadPdf');
    if (btnModalDownloadPdf) {
      btnModalDownloadPdf.addEventListener('click', () => {
        if (activeAppDetail) window.open(`/api/onboarding/${activeAppDetail.id}/pdf`, '_blank');
      });
    }

    // Audit History Button
    const btnModalAuditHistory = document.getElementById('btnModalAuditHistory');
    if (btnModalAuditHistory) {
      btnModalAuditHistory.addEventListener('click', () => {
        if (activeAppDetail) openAuditModal(activeAppDetail.id);
      });
    }

    const btnCloseAuditModal = document.getElementById('btnCloseAuditModal');
    if (btnCloseAuditModal) {
      btnCloseAuditModal.addEventListener('click', () => {
        document.getElementById('hrAuditModal').style.display = 'none';
      });
    }

    // Modal Actions
    const btnActionApprove = document.getElementById('btnActionApprove');
    if (btnActionApprove) btnActionApprove.addEventListener('click', handleApproveClick);

    const btnActionReject = document.getElementById('btnActionReject');
    if (btnActionReject) btnActionReject.addEventListener('click', handleRejectClick);

    const btnActionCorrection = document.getElementById('btnActionCorrection');
    if (btnActionCorrection) {
      btnActionCorrection.addEventListener('click', () => {
        document.getElementById('hrCorrectionModal').style.display = 'flex';
      });
    }

    const btnCancelCorrection = document.getElementById('btnCancelCorrection');
    if (btnCancelCorrection) {
      btnCancelCorrection.addEventListener('click', () => {
        document.getElementById('hrCorrectionModal').style.display = 'none';
      });
    }

    const btnSubmitCorrection = document.getElementById('btnSubmitCorrection');
    if (btnSubmitCorrection) btnSubmitCorrection.addEventListener('click', handleCorrectionSubmit);
  }

  // --- DATA FETCHING & RENDERING ---
  async function refreshOnboardingData() {
    try {
      // 1. Fetch Stats
      const statsRes = await fetch('/api/hr/onboarding/stats', { headers: getAuthHeaders() });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success && statsData.stats) {
          updateMetricsUI(statsData.stats);
        }
      }

      // 2. Fetch Applications
      const appsRes = await fetch('/api/hr/onboarding/applications', { headers: getAuthHeaders() });
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        if (appsData.success) {
          allApplications = appsData.applications || [];
          renderApplicationsTable();
        }
      }
    } catch (err) {
      console.warn('Error refreshing HR onboarding data:', err.message);
    }
  }

  function updateMetricsUI(stats) {
    document.getElementById('metricTotal').textContent = stats.total || 0;
    document.getElementById('metricNew').textContent = stats.submitted || 0;
    document.getElementById('metricPending').textContent = (stats.under_review || 0) + (stats.documents_under_verification || 0);
    document.getElementById('metricCorrection').textContent = stats.correction_required || 0;
    document.getElementById('metricApproved').textContent = stats.approved || 0;
    document.getElementById('metricRejected').textContent = stats.rejected || 0;
  }

  function renderApplicationsTable() {
    const tbody = document.getElementById('hrOnbTableBody');
    if (!tbody) return;

    // Filter
    let filtered = allApplications.filter(app => {
      // Search
      if (currentFilter.search) {
        const q = currentFilter.search;
        const matchesName = (app.name || '').toLowerCase().includes(q);
        const matchesEmail = (app.email || '').toLowerCase().includes(q);
        const matchesId = (app.id || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesId) return false;
      }
      // Position
      if (currentFilter.position !== 'ALL') {
        if ((app.position || '').toLowerCase() !== currentFilter.position.toLowerCase()) return false;
      }
      // Status
      if (currentFilter.status !== 'ALL') {
        if (app.status !== currentFilter.status) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      const da = new Date(a.submitted_at || a.created_at || 0).getTime();
      const db = new Date(b.submitted_at || b.created_at || 0).getTime();
      return currentFilter.sort === 'oldest' ? da - db : db - da;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 30px; text-align: center; color: #94A3B8;">
            No applications found matching the current search &amp; filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(app => {
      const docCount = (app.documents && app.documents.length) || 0;
      const verifiedCount = (app.documents && app.documents.filter(d => d.verification_status === 'verified').length) || 0;

      let statusBadgeStyle = 'background: #E2E8F0; color: #475569;';
      if (app.status === 'submitted') statusBadgeStyle = 'background: #E0F2FE; color: #0284C7;';
      if (app.status === 'under_review' || app.status === 'documents_under_verification') statusBadgeStyle = 'background: #FEF3C7; color: #D97706;';
      if (app.status === 'correction_required') statusBadgeStyle = 'background: #FEE2E2; color: #DC2626;';
      if (app.status === 'approved') statusBadgeStyle = 'background: #DCFCE7; color: #16A34A;';
      if (app.status === 'rejected') statusBadgeStyle = 'background: #FEE2E2; color: #991B1B;';

      return `
        <tr style="border-bottom: 1px solid #F1F5F9; transition: background 0.15s ease;" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='#FFFFFF'">
          <td style="padding: 12px 16px; font-family: monospace; font-weight: 700; color: #001D35;">
            ${app.id}
          </td>
          <td style="padding: 12px 16px;">
            <div style="font-weight: 600; color: #0F172A;">${escapeHtml(app.name || 'Incomplete')}</div>
            <div style="font-size: 0.75rem; color: #64748B;">${escapeHtml(app.email || '')}</div>
          </td>
          <td style="padding: 12px 16px; font-weight: 500;">
            ${escapeHtml(app.position || '-')}
            <div style="font-size: 0.72rem; color: #64748B;">${escapeHtml(app.domain || '')}</div>
          </td>
          <td style="padding: 12px 16px; color: #475569; font-size: 0.8rem;">
            ${app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : 'Draft'}
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 0.75rem; font-weight: 600; background: #F1F5F9; padding: 3px 8px; border-radius: 4px;">
              ${verifiedCount} / ${docCount} Verified
            </span>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; ${statusBadgeStyle}">
              ${(app.status || 'Draft').replace(/_/g, ' ')}
            </span>
          </td>
          <td style="padding: 12px 16px; text-align: right;">
            <button type="button" class="btn btn-primary btn-sm btn-inspect-app" data-app-id="${app.id}">
              Inspect &amp; Verify
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach inspect click handlers
    tbody.querySelectorAll('.btn-inspect-app').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-app-id');
        openApplicationInspection(id);
      });
    });
  }

  // --- INSPECTION MODAL ---
  async function openApplicationInspection(appId) {
    try {
      const res = await fetch(`/api/hr/onboarding/applications/${encodeURIComponent(appId)}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load application.');

      activeAppDetail = data.application;
      renderInspectionModalDetails(activeAppDetail);
      document.getElementById('hrAppModal').style.display = 'flex';
    } catch (err) {
      alert('Error opening application: ' + err.message);
    }
  }

  function renderInspectionModalDetails(app) {
    document.getElementById('modalAppIdTitle').textContent = `Review Application: ${app.id}`;
    
    // Status Badge
    const badge = document.getElementById('modalAppStatusBadge');
    badge.textContent = (app.status || 'Draft').replace(/_/g, ' ');
    if (app.status === 'approved') {
      badge.style.background = '#DCFCE7';
      badge.style.color = '#16A34A';
    } else if (app.status === 'correction_required') {
      badge.style.background = '#FEE2E2';
      badge.style.color = '#DC2626';
    } else {
      badge.style.background = '#E0F2FE';
      badge.style.color = '#0284C7';
    }

    // Position
    document.getElementById('mPosTitle').textContent = app.position || '-';
    document.getElementById('mPosDomain').textContent = app.domain || '-';
    document.getElementById('mPosJoin').textContent = app.joining_date || '-';
    document.getElementById('mPosDur').textContent = app.duration || '-';

    // Personal
    document.getElementById('mPiName').textContent = app.name || '-';
    document.getElementById('mPiDob').textContent = app.dob || '-';
    document.getElementById('mPiGender').textContent = app.gender || '-';
    document.getElementById('mPiNationality').textContent = app.nationality || 'Indian';
    document.getElementById('mPiAadhaar').textContent = app.aadhaar_masked || app.aadhaar || '-';
    document.getElementById('mPiBlood').textContent = app.blood_group || '-';

    // Contact
    document.getElementById('mCntPhone').textContent = app.phone || '-';
    document.getElementById('mCntEmail').textContent = app.email || '-';
    document.getElementById('mCntPerm').textContent = app.permanent_address || '-';
    document.getElementById('mCntCurr').textContent = app.current_address || '-';

    // Academic
    const acCont = document.getElementById('mAcademicList');
    const acList = app.academic_details || [];
    if (acList.length === 0) {
      acCont.innerHTML = '<span style="color: #94A3B8;">No academic records submitted</span>';
    } else {
      acCont.innerHTML = acList.map(a => `
        <div style="border-bottom: 1px dashed #E2E8F0; padding: 4px 0;">
          <strong>[${a.qualification}] ${escapeHtml(a.degree_name)}</strong> — ${escapeHtml(a.institution)} 
          <span style="color: #64748B;">(${a.year_of_passing})</span> — <strong>Score: ${a.cgpa_percentage}</strong>
        </div>
      `).join('');
    }

    // Skills & Projects
    document.getElementById('mSkills').textContent = app.technical_skills || '-';
    document.getElementById('mTools').textContent = app.tools_platforms || '-';
    const pjCont = document.getElementById('mProjectsList');
    const pjList = app.projects_experience || [];
    if (pjList.length === 0) {
      pjCont.innerHTML = '<span style="color: #94A3B8;">No projects recorded</span>';
    } else {
      pjCont.innerHTML = pjList.map(p => `
        <div style="margin-bottom: 6px;">
          <strong>• ${escapeHtml(p.title)}</strong> (${escapeHtml(p.organization || 'Project')}) 
          <div style="color: #64748B;">${escapeHtml(p.description || '')}</div>
        </div>
      `).join('');
    }

    // Emergency
    const emg = (app.emergency_contacts && app.emergency_contacts[0]) || {};
    document.getElementById('mEmgName').textContent = emg.name || '-';
    document.getElementById('mEmgRel').textContent = emg.relationship || '-';
    document.getElementById('mEmgPhone').textContent = emg.mobile || '-';
    document.getElementById('mEmgAlt').textContent = emg.alternate_phone || '-';

    // Bank Details (Unmasked for authorized HR)
    const bnk = app.bank_details || {};
    document.getElementById('mBnkHolder').textContent = bnk.account_holder_name || '-';
    document.getElementById('mBnkName').textContent = bnk.bank_name || '-';
    document.getElementById('mBnkAcc').textContent = bnk.account_number || bnk.account_number_masked || '-';
    document.getElementById('mBnkIfsc').textContent = bnk.ifsc_code || '-';

    // Documents Inspection List
    renderInspectionDocuments(app);
  }

  function renderInspectionDocuments(app) {
    const cont = document.getElementById('mDocsContainer');
    cont.innerHTML = '';

    const docs = app.documents || [];
    if (docs.length === 0) {
      cont.innerHTML = `
        <div style="padding: 30px; text-align: center; color: #94A3B8; background: #F8FAFC; border-radius: 8px;">
          No documents uploaded yet by the applicant.
        </div>
      `;
      return;
    }

    docs.forEach(doc => {
      const card = document.createElement('div');
      card.style.cssText = 'border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px; background: #FFFFFF; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.04);';

      let statusBadge = '<span style="background: #E2E8F0; color: #475569; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; font-weight: 700;">Pending</span>';
      if (doc.verification_status === 'verified') {
        statusBadge = '<span style="background: #DCFCE7; color: #16A34A; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; font-weight: 700;">VERIFIED</span>';
      } else if (doc.verification_status === 'correction_required') {
        statusBadge = '<span style="background: #FEE2E2; color: #DC2626; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; font-weight: 700;">CORRECTION REQ.</span>';
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: #001D35;">${escapeHtml(doc.category.toUpperCase().replace(/_/g, ' '))}</div>
            <div style="font-size: 0.78rem; color: #64748B;">${escapeHtml(doc.original_name)} • ${new Date(doc.uploaded_at).toLocaleString()}</div>
          </div>
          ${statusBadge}
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
          <input type="text" class="form-control doc-remarks-input" placeholder="HR remarks for this document..." value="${escapeHtml(doc.remarks || '')}" style="font-size: 0.8rem; padding: 6px 10px; flex: 1;">
          <button type="button" class="btn btn-secondary btn-sm btn-doc-view" data-doc-id="${doc.id}">Preview</button>
          <button type="button" class="btn btn-success btn-sm btn-doc-verify" data-doc-id="${doc.id}">Verify</button>
          <button type="button" class="btn btn-secondary btn-sm btn-doc-correction" data-doc-id="${doc.id}" style="color: #DC2626;">Reject/Fix</button>
        </div>
      `;

      // Preview Click
      card.querySelector('.btn-doc-view').addEventListener('click', () => {
        window.open(`/api/onboarding/${app.id}/document/${doc.id}`, '_blank');
      });

      // Verify Click
      card.querySelector('.btn-doc-verify').addEventListener('click', async () => {
        const remarks = card.querySelector('.doc-remarks-input').value.trim();
        await updateDocumentStatus(app.id, doc.id, 'verified', remarks || 'Verified and approved by HR.');
      });

      // Correction Click
      card.querySelector('.btn-doc-correction').addEventListener('click', async () => {
        const remarks = card.querySelector('.doc-remarks-input').value.trim();
        if (!remarks) {
          alert('Please enter a specific remark for this document indicating what needs correction.');
          return;
        }
        await updateDocumentStatus(app.id, doc.id, 'correction_required', remarks);
      });

      cont.appendChild(card);
    });
  }

  async function updateDocumentStatus(appId, docId, status, remarks) {
    try {
      const res = await fetch(`/api/hr/onboarding/applications/${appId}/verify-document`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ docId, status, remarks })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to update document status.');

      // Refresh modal
      openApplicationInspection(appId);
      refreshOnboardingData();
    } catch (err) {
      alert('Error updating document: ' + err.message);
    }
  }

  // --- APPROVAL WORKFLOW ---
  async function handleApproveClick() {
    if (!activeAppDetail) return;

    // Check mandatory documents verification
    const docs = activeAppDetail.documents || [];
    const mandatory = ['resume', 'govt_id', 'academic_marks', 'photo'];
    const unverified = mandatory.filter(m => {
      const d = docs.find(x => x.category === m);
      return !d || d.verification_status !== 'verified';
    });

    if (unverified.length > 0) {
      const confirmOverride = confirm(
        `Warning: The following mandatory documents are not yet marked as 'Verified':\n• ${unverified.join('\n• ')}\n\nDo you want to proceed with administrative approval anyway?`
      );
      if (!confirmOverride) return;
    } else {
      if (!confirm(`Are you sure you want to approve onboarding application ${activeAppDetail.id} for ${activeAppDetail.name}?`)) {
        return;
      }
    }

    try {
      const res = await fetch(`/api/hr/onboarding/applications/${activeAppDetail.id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes: 'Onboarding approved by HR Lead after verification.' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Approval failed.');

      alert(`Application ${activeAppDetail.id} approved successfully!`);
      document.getElementById('hrAppModal').style.display = 'none';
      activeAppDetail = null;
      await refreshOnboardingData();
    } catch (err) {
      alert('Approval Error: ' + err.message);
    }
  }

  // --- REJECTION WORKFLOW ---
  async function handleRejectClick() {
    if (!activeAppDetail) return;

    const reason = prompt(`Please provide the official rejection reason for ${activeAppDetail.id}:`);
    if (!reason || !reason.trim()) {
      alert('Rejection reason is required.');
      return;
    }

    try {
      const res = await fetch(`/api/hr/onboarding/applications/${activeAppDetail.id}/reject`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: reason.trim() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Rejection failed.');

      alert(`Application ${activeAppDetail.id} has been marked as REJECTED.`);
      document.getElementById('hrAppModal').style.display = 'none';
      activeAppDetail = null;
      await refreshOnboardingData();
    } catch (err) {
      alert('Rejection Error: ' + err.message);
    }
  }

  // --- CORRECTIONS WORKFLOW ---
  async function handleCorrectionSubmit() {
    if (!activeAppDetail) return;

    const remarks = document.getElementById('corrRemarksText').value.trim();
    if (!remarks) {
      alert('Please enter correction remarks for the applicant.');
      return;
    }

    const selectedFields = [];
    document.querySelectorAll('.corr-field-chk:checked').forEach(c => selectedFields.push(c.value));

    try {
      const res = await fetch(`/api/hr/onboarding/applications/${activeAppDetail.id}/request-correction`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ remarks, fields: selectedFields })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Request failed.');

      alert(`Correction request sent to applicant.`);
      document.getElementById('hrCorrectionModal').style.display = 'none';
      document.getElementById('hrAppModal').style.display = 'none';
      activeAppDetail = null;
      await refreshOnboardingData();
    } catch (err) {
      alert('Correction Error: ' + err.message);
    }
  }

  // --- AUDIT HISTORY ---
  async function openAuditModal(appId) {
    const modal = document.getElementById('hrAuditModal');
    const content = document.getElementById('auditLogContent');
    content.innerHTML = '<div style="padding: 20px; text-align: center; color: #94A3B8;">Loading audit trail...</div>';
    modal.style.display = 'flex';

    try {
      const res = await fetch(`/api/hr/onboarding/applications/${appId}/history`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load audit history.');

      const hist = data.history || [];
      if (hist.length === 0) {
        content.innerHTML = '<div style="padding: 20px; text-align: center; color: #94A3B8;">No audit history recorded yet.</div>';
        return;
      }

      content.innerHTML = `
        <div style="position: relative; padding-left: 24px; border-left: 2px solid #E2E8F0; margin-left: 10px;">
          ${hist.map(item => `
            <div style="position: relative; margin-bottom: 20px;">
              <div style="position: absolute; left: -31px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #0B57D0;"></div>
              <div style="font-weight: 700; font-size: 0.88rem; color: #001D35;">${escapeHtml(item.action.toUpperCase().replace(/_/g, ' '))}</div>
              <div style="font-size: 0.75rem; color: #64748B;">By: ${escapeHtml(item.actor_name || item.actor_id || 'System')} • ${new Date(item.created_at).toLocaleString()}</div>
              ${item.notes ? `<div style="font-size: 0.82rem; color: #334155; margin-top: 4px; background: #F8FAFC; padding: 6px 10px; border-radius: 4px;">${escapeHtml(item.notes)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div style="color: #DC2626; padding: 20px;">Error: ${err.message}</div>`;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();

