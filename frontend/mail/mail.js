/**
 * PUVIMA Mail — Official Corporate Email Client
 * Featuring Google Gmail M3 Interface, GoDaddy IMAP/SMTP Gateway,
 * Persistent Corporate Mailbox Store, Media & PDF Attachment Dispatch,
 * and Single-Sign-On Session Management.
 */

(function () {
  'use strict';

  // Application State
  let currentTab = 'primary';
  let currentFolder = 'INBOX';
  let activeEmailData = null;
  let isConnectedLive = false;
  let liveMessages = [];
  let attachedFiles = [];
  let userEmail = localStorage.getItem('puvima_current_email') || 'admin@puvima.com';
  let mailboxCreds = null;

  // Embedded Pure SVG Icons System (100% Reliable, Zero CSP/CDN Dependencies)
  const ICONS = {
    menu: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
    search: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    star: `<svg class="icon-svg" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    starFilled: `<svg class="icon-svg" style="color: #F4B400; fill: #F4B400;" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    trash: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    mailOpen: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z"></path><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"></path></svg>`,
    inbox: `<svg class="icon-svg" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>`,
    send: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    chevronUp: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
    chevronDown: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    spam: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    archive: `<svg class="icon-svg" viewBox="0 0 24 24"><rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="m10 12 2 2 2-2"></path><path d="M12 14V9"></path></svg>`,
    clock: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    fileText: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
    paperclip: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`,
    image: `<svg class="icon-svg" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`,
    close: `<svg class="icon-svg" style="width: 14px; height: 14px;" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
  };

  try {
    const saved = localStorage.getItem('puvima_mailbox_creds');
    if (saved) mailboxCreds = JSON.parse(saved);
  } catch (e) {
    mailboxCreds = null;
  }

  // DOM Elements
  const el = {
    mailLoginScreen: document.getElementById('mailLoginScreen'),
    mailLoginForm: document.getElementById('mailLoginForm'),
    loginAccountSelect: document.getElementById('loginAccountSelect'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    btnToggleLoginPassword: document.getElementById('btnToggleLoginPassword'),
    loginPasswordHint: document.getElementById('loginPasswordHint'),
    loginStatusAlert: document.getElementById('loginStatusAlert'),
    btnSubmitLogin: document.getElementById('btnSubmitLogin'),

    gmailWorkspace: document.getElementById('gmailWorkspace'),
    emailListContainer: document.getElementById('emailListContainer'),
    readingViewPane: document.getElementById('readingViewPane'),
    btnBackToInbox: document.getElementById('btnBackToInbox'),
    readingEmailSubject: document.getElementById('readingEmailSubject'),
    readingSenderAvatar: document.getElementById('readingSenderAvatar'),
    readingSenderName: document.getElementById('readingSenderName'),
    readingSenderEmail: document.getElementById('readingSenderEmail'),
    readingDateLabel: document.getElementById('readingDateLabel'),
    readingBodyContent: document.getElementById('readingBodyContent'),
    btnReadingReply: document.getElementById('btnReadingReply'),
    btnReadingForward: document.getElementById('btnReadingForward'),
    btnReadingArchive: document.getElementById('btnReadingArchive'),
    btnReadingSpam: document.getElementById('btnReadingSpam'),
    btnReadingDelete: document.getElementById('btnReadingDelete'),
    btnReadingRestore: document.getElementById('btnReadingRestore'),
    btnReadingMarkUnread: document.getElementById('btnReadingMarkUnread'),
    btnReadingSnooze: document.getElementById('btnReadingSnooze'),
    btnReadingPrint: document.getElementById('btnReadingPrint'),

    gmailComposeDock: document.getElementById('gmailComposeDock'),
    btnOpenCompose: document.getElementById('btnOpenCompose'),
    btnCloseCompose: document.getElementById('btnCloseCompose'),
    btnMinimizeCompose: document.getElementById('btnMinimizeCompose'),
    btnMaximizeCompose: document.getElementById('btnMaximizeCompose'),
    btnDiscardDockMail: document.getElementById('btnDiscardDockMail'),
    composeForm: document.getElementById('composeForm'),
    dockFromDisplay: document.getElementById('dockFromDisplay'),
    dockToInput: document.getElementById('dockToInput'),
    dockToChips: document.getElementById('dockToChips'),
    dockToRow: document.getElementById('dockToRow'),
    btnToggleCcBcc: document.getElementById('btnToggleCcBcc'),
    ccBccWrapper: document.getElementById('ccBccWrapper'),
    dockCcInput: document.getElementById('dockCcInput'),
    dockCcChips: document.getElementById('dockCcChips'),
    dockCcRow: document.getElementById('dockCcRow'),
    dockBccInput: document.getElementById('dockBccInput'),
    dockBccChips: document.getElementById('dockBccChips'),
    dockBccRow: document.getElementById('dockBccRow'),
    dockSubjectInput: document.getElementById('dockSubjectInput'),
    dockBodyInput: document.getElementById('dockBodyInput'),
    btnSendDockMail: document.getElementById('btnSendDockMail'),
    btnAttachFile: document.getElementById('btnAttachFile'),
    btnAttachPhoto: document.getElementById('btnAttachPhoto'),
    composeFileInput: document.getElementById('composeFileInput'),
    composePhotoInput: document.getElementById('composePhotoInput'),
    dockAttachmentsList: document.getElementById('dockAttachmentsList'),

    btnAccountAvatar: document.getElementById('btnAccountAvatar'),
    avatarDropdownMenu: document.getElementById('avatarDropdownMenu'),
    menuAvatarLarge: document.getElementById('menuAvatarLarge'),
    menuUserName: document.getElementById('menuUserName'),
    menuUserEmail: document.getElementById('menuUserEmail'),
    btnMenuSwitchAccount: document.getElementById('btnMenuSwitchAccount'),
    btnMenuSignOut: document.getElementById('btnMenuSignOut'),

    btnOpenMailboxSettings: document.getElementById('btnOpenMailboxSettings'),
    btnBannerConnectMailbox: document.getElementById('btnBannerConnectMailbox'),
    connectMailboxModal: document.getElementById('connectMailboxModal'),
    btnCancelConnectModal: document.getElementById('btnCancelConnectModal'),
    connectMailboxForm: document.getElementById('connectMailboxForm'),
    connectAccountSelect: document.getElementById('connectAccountSelect'),
    connectEmail: document.getElementById('connectEmail'),
    connectPassword: document.getElementById('connectPassword'),
    connectStatusAlert: document.getElementById('connectStatusAlert'),
    btnSubmitConnectMailbox: document.getElementById('btnSubmitConnectMailbox'),
    passwordHint: document.getElementById('passwordHint'),

    btnRefreshInbox: document.getElementById('btnRefreshInbox'),
    btnToolbarArchive: document.getElementById('btnToolbarArchive'),
    btnToolbarSpam: document.getElementById('btnToolbarSpam'),
    btnToolbarTrash: document.getElementById('btnToolbarTrash'),
    btnToolbarRestore: document.getElementById('btnToolbarRestore'),
    btnToolbarMarkUnread: document.getElementById('btnToolbarMarkUnread'),
    btnToolbarSnooze: document.getElementById('btnToolbarSnooze'),
    gmailSearchInput: document.getElementById('gmailSearchInput'),
    masterSelectCheckbox: document.getElementById('masterSelectCheckbox'),
    pageCountDisplay: document.getElementById('pageCountDisplay'),
    sidebarInboxCount: document.getElementById('sidebarInboxCount'),
    categoryTabsBar: document.getElementById('categoryTabsBar'),
    btnToggleMoreFolders: document.getElementById('btnToggleMoreFolders'),
    iconToggleMore: document.getElementById('iconToggleMore'),
    textToggleMore: document.getElementById('textToggleMore'),
    moreFoldersCollapsible: document.getElementById('moreFoldersCollapsible'),
    gmailToastContainer: document.getElementById('gmailToastContainer')
  };

  // Toast Notifications
  function showToast(text) {
    if (!el.gmailToastContainer) return;
    const toast = document.createElement('div');
    toast.style.background = '#202124';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '14px';
    toast.style.boxShadow = '0 3px 8px rgba(0,0,0,0.2)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';
    toast.textContent = text;
    el.gmailToastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // Update Avatar Profile Initial & Sender Titles
  function updateAvatar() {
    if (userEmail) {
      const isPrincipal = userEmail.toLowerCase().includes('admin@puvima.com');
      const displayName = isPrincipal
        ? 'Principal Consultant'
        : (userEmail.toLowerCase().includes('contact@puvima.com') ? 'PUVIMA' : 'PUVIMA User');

      const initial = isPrincipal ? 'P' : 'C';

      if (el.btnAccountAvatar) {
        el.btnAccountAvatar.textContent = initial;
        el.btnAccountAvatar.title = `${displayName} (${userEmail}) — Click to Manage`;
      }
      if (el.menuAvatarLarge) el.menuAvatarLarge.textContent = initial;
      if (el.menuUserName) el.menuUserName.textContent = displayName;
      if (el.menuUserEmail) el.menuUserEmail.textContent = userEmail;

      if (el.dockFromDisplay) {
        el.dockFromDisplay.textContent = `${displayName} <${userEmail}>`;
      }
      const count = el.sidebarInboxCount ? el.sidebarInboxCount.textContent : '0';
      document.title = `Inbox (${count}) - ${displayName} - PUVIMA Mail`;
    }
  }

  // Session Management & Gate Control
  function checkSession() {
    const isLoggedOut = localStorage.getItem('puvima_mail_logged_out');
    if (isLoggedOut === 'true') {
      showLoginScreen();
      return;
    }

    const savedToken = localStorage.getItem('puvima_mail_token');
    const savedCreds = localStorage.getItem('puvima_mailbox_creds');

    if (savedToken && savedCreds) {
      try {
        mailboxCreds = JSON.parse(savedCreds);
        if (mailboxCreds && mailboxCreds.user && mailboxCreds.pass) {
          userEmail = mailboxCreds.user;
          showWorkspace();
          return;
        }
      } catch (e) {
        mailboxCreds = null;
      }
    }

    // No verified active session: Show login screen, hide workspace
    showLoginScreen();
  }

  function showLoginScreen(alertMsg = null, alertType = 'info') {
    isConnectedLive = false;
    liveMessages = [];
    if (el.emailListContainer) el.emailListContainer.innerHTML = '';
    if (el.readingViewPane) el.readingViewPane.style.display = 'none';
    if (el.gmailWorkspace) el.gmailWorkspace.style.display = 'none';
    if (el.mailLoginScreen) el.mailLoginScreen.style.display = 'flex';
    if (el.loginPassword) {
      el.loginPassword.value = '';
      setTimeout(() => el.loginPassword.focus(), 150);
    }
    if (alertMsg) {
      showLoginAlert(alertMsg, alertType);
    } else {
      hideLoginAlert();
    }
  }

  function showWorkspace() {
    if (el.mailLoginScreen) el.mailLoginScreen.style.display = 'none';
    if (el.gmailWorkspace) el.gmailWorkspace.style.display = 'flex';
    updateAvatar();
    fetchLiveInbox();
  }

  function signOut() {
    localStorage.removeItem('puvima_mail_token');
    localStorage.removeItem('puvima_mailbox_creds');
    localStorage.setItem('puvima_mail_logged_out', 'true');
    mailboxCreds = null;
    isConnectedLive = false;
    liveMessages = [];

    // Clear all cached emails from localStorage
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('puvima_mail_cache_')) {
          keys.push(k);
        }
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) {}

    // Clear UI state completely
    if (el.emailListContainer) el.emailListContainer.innerHTML = '';
    if (el.readingViewPane) el.readingViewPane.style.display = 'none';
    if (el.avatarDropdownMenu) el.avatarDropdownMenu.style.display = 'none';

    showToast('Signed out of PUVIMA Mail.');
    showLoginScreen('You have been signed out. Please sign in to access your mailbox.', 'info');
  }

  // Show in-place loading shimmer/spinner
  function showInboxLoading() {
    if (!el.emailListContainer) return;
    el.emailListContainer.style.display = 'block';
    if (el.readingViewPane) el.readingViewPane.style.display = 'none';
    el.emailListContainer.innerHTML = `
      <div style="padding: 70px 20px; text-align: center; color: #5F6368;">
        <div class="mail-spinner" style="width: 34px; height: 34px; margin: 0 auto 16px; border: 3px solid #E8EAED; border-top-color: #1A73E8; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <p style="font-size: 14.5px; font-weight: 500; color: #202124;">Loading messages...</p>
        <p style="font-size: 12.5px; color: #70757A; margin-top: 4px;">Syncing with PUVIMA Mail Gateway</p>
      </div>
    `;
  }

  // Show in-place inbox error with retry action
  function showInboxError(msg) {
    if (!el.emailListContainer) return;
    el.emailListContainer.style.display = 'block';
    if (el.readingViewPane) el.readingViewPane.style.display = 'none';
    el.emailListContainer.innerHTML = `
      <div style="padding: 60px 20px; text-align: center; color: #5F6368;">
        <div style="width: 48px; height: 48px; margin: 0 auto 14px; background: #FCE8E6; color: #C5221F; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <span style="display: inline-block; transform: scale(1.6);">${ICONS.spam}</span>
        </div>
        <p style="font-size: 16px; font-weight: 600; color: #202124;">Unable to Load Messages</p>
        <p style="font-size: 13.5px; color: #5F6368; max-width: 440px; margin: 6px auto 18px; line-height: 1.5;">${escapeHtml(msg)}</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="btnRetrySync" style="background: #1A73E8; color: #FFFFFF; border: none; padding: 8px 20px; border-radius: 6px; font-size: 13.5px; font-weight: 500; cursor: pointer;">Retry</button>
          <button id="btnOpenSettingsFromError" style="background: #F1F3F4; color: #3C4043; border: 1px solid #DADCE0; padding: 8px 18px; border-radius: 6px; font-size: 13.5px; font-weight: 500; cursor: pointer;">Sign In Again</button>
        </div>
      </div>
    `;
    const btnRetry = document.getElementById('btnRetrySync');
    if (btnRetry) btnRetry.addEventListener('click', () => fetchLiveInbox(true));
    const btnSet = document.getElementById('btnOpenSettingsFromError');
    if (btnSet) btnSet.addEventListener('click', () => showLoginScreen());
  }

  // Handle Full-Page Login Submit
  async function handleLoginSubmit(e) {
    e.preventDefault();

    const email = el.loginEmail.value.trim() || 'admin@puvima.com';
    const password = el.loginPassword.value.trim();

    if (!email || !password) {
      showLoginAlert('Please enter both your email address and password.', 'error');
      return;
    }

    el.btnSubmitLogin.disabled = true;
    el.btnSubmitLogin.innerHTML = '<span>Verifying credentials...</span>';
    showLoginAlert('Connecting securely to PUVIMA Mail Gateway...', 'info');

    try {
      const res = await fetch('/api/mail/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed. Please verify your password.');
      }

      userEmail = email;
      if (data.token) {
        localStorage.setItem('puvima_mail_token', data.token);
      }
      localStorage.setItem('puvima_current_email', email);
      localStorage.removeItem('puvima_mail_logged_out');

      mailboxCreds = {
        user: email,
        pass: password,
        host: 'imap.secureserver.net',
        port: 993,
        secure: true,
        smtpHost: 'smtpout.secureserver.net',
        smtpPort: 465
      };
      localStorage.setItem('puvima_mailbox_creds', JSON.stringify(mailboxCreds));
      showToast(`Connected live to mailbox (${email})`);

      hideLoginAlert();
      showWorkspace();
    } catch (err) {
      showLoginAlert(err.message, 'error');
    } finally {
      el.btnSubmitLogin.disabled = false;
      el.btnSubmitLogin.innerHTML = '<span>Sign In to PUVIMA Mail</span><svg class="icon-svg" style="width: 18px; height: 18px;" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
    }
  }

  function showLoginAlert(msg, type = 'error') {
    if (!el.loginStatusAlert) return;
    el.loginStatusAlert.style.display = 'block';
    if (type === 'error') {
      el.loginStatusAlert.style.background = '#FCE8E6';
      el.loginStatusAlert.style.color = '#C5221F';
      el.loginStatusAlert.innerHTML = `<strong>Error:</strong> ${escapeHtml(msg)}`;
    } else {
      el.loginStatusAlert.style.background = '#E8F0FE';
      el.loginStatusAlert.style.color = '#0B57D0';
      el.loginStatusAlert.innerHTML = escapeHtml(msg);
    }
  }

  function hideLoginAlert() {
    if (!el.loginStatusAlert) return;
    el.loginStatusAlert.style.display = 'none';
    el.loginStatusAlert.innerHTML = '';
  }

  // Update selection toolbar visibility and row highlights
  function updateSelectionToolbar() {
    const allCheckboxes = el.emailListContainer ? el.emailListContainer.querySelectorAll('.item-checkbox') : [];
    const checkedCheckboxes = el.emailListContainer ? el.emailListContainer.querySelectorAll('.item-checkbox:checked') : [];
    const count = checkedCheckboxes.length;

    // Toggle row .selected highlight
    allCheckboxes.forEach(cb => {
      const row = cb.closest('.email-row');
      if (row) row.classList.toggle('selected', cb.checked);
    });

    // Update master select checkbox state
    if (el.masterSelectCheckbox) {
      if (count === 0) {
        el.masterSelectCheckbox.checked = false;
        el.masterSelectCheckbox.indeterminate = false;
      } else if (count === allCheckboxes.length && allCheckboxes.length > 0) {
        el.masterSelectCheckbox.checked = true;
        el.masterSelectCheckbox.indeterminate = false;
      } else {
        el.masterSelectCheckbox.checked = false;
        el.masterSelectCheckbox.indeterminate = true;
      }
    }

    // Toggle selection toolbar buttons visibility
    const isTrash = (currentFolder || '').toLowerCase() === 'trash';
    const hasSelection = count > 0;

    if (el.btnToolbarArchive) el.btnToolbarArchive.style.display = (hasSelection && !isTrash) ? 'inline-flex' : 'none';
    if (el.btnToolbarSpam) el.btnToolbarSpam.style.display = (hasSelection && !isTrash) ? 'inline-flex' : 'none';
    if (el.btnToolbarMarkUnread) el.btnToolbarMarkUnread.style.display = (hasSelection && !isTrash) ? 'inline-flex' : 'none';
    if (el.btnToolbarSnooze) el.btnToolbarSnooze.style.display = (hasSelection && !isTrash) ? 'inline-flex' : 'none';

    if (el.btnToolbarTrash) {
      if (hasSelection) {
        el.btnToolbarTrash.style.display = 'inline-flex';
        el.btnToolbarTrash.title = isTrash ? 'Delete permanently' : 'Move to trash';
      } else {
        el.btnToolbarTrash.style.display = 'none';
      }
    }

    if (el.btnToolbarRestore) {
      el.btnToolbarRestore.style.display = (hasSelection && isTrash) ? 'inline-flex' : 'none';
    }
  }

  // Render Emails List
  function renderEmailList() {
    el.emailListContainer.style.display = 'block';
    el.readingViewPane.style.display = 'none';

    let displayList = liveMessages;

    // Filter by folder if not INBOX
    if (currentFolder === 'Starred') {
      displayList = displayList.filter(item => item.isStarred);
    }

    // Search filter
    const query = el.gmailSearchInput ? el.gmailSearchInput.value.trim().toLowerCase() : '';
    if (query) {
      displayList = displayList.filter(item =>
        (item.sender && item.sender.toLowerCase().includes(query)) ||
        (item.subject && item.subject.toLowerCase().includes(query)) ||
        (item.snippet && item.snippet.toLowerCase().includes(query))
      );
    }

    if (el.pageCountDisplay) {
      el.pageCountDisplay.textContent = displayList.length > 0 ? `1-${displayList.length} of ${displayList.length}` : '0 of 0';
    }
    if (el.sidebarInboxCount && currentFolder === 'INBOX') {
      const unreadCount = displayList.filter(m => m.isUnread).length;
      el.sidebarInboxCount.textContent = unreadCount;
      const isPrincipal = (userEmail || '').toLowerCase().includes('admin@puvima.com');
      const displayName = isPrincipal ? 'Principal Consultant' : 'PUVIMA';
      document.title = `Inbox (${unreadCount}) - ${displayName} - PUVIMA Mail`;
    }

    if (displayList.length === 0) {
      let iconSvg = ICONS.inbox;
      let emptyTitle = 'Your inbox is empty';
      let emptySub = `Emails received on your corporate mailbox (${escapeHtml(userEmail)}) will appear here.`;

      if (currentFolder === 'Starred') {
        iconSvg = ICONS.star;
        emptyTitle = 'No starred messages';
        emptySub = 'Stars let you give messages a special status to make them easier to find.';
      } else if (currentFolder === 'Sent') {
        iconSvg = ICONS.send;
        emptyTitle = 'No sent messages';
        emptySub = 'Messages you send from PUVIMA Mail will appear here.';
      } else if (currentFolder === 'Drafts') {
        iconSvg = ICONS.fileText;
        emptyTitle = 'No drafts saved';
        emptySub = 'Drafts you save will appear here.';
      } else if (currentFolder === 'Trash') {
        iconSvg = ICONS.trash;
        emptyTitle = 'Trash is empty';
        emptySub = 'Deleted messages will appear here.';
      } else if (currentFolder === 'Spam') {
        iconSvg = ICONS.spam;
        emptyTitle = 'Hooray, no spam here!';
        emptySub = 'Messages identified as spam or junk will appear here.';
      } else if (currentFolder === 'Archive') {
        iconSvg = ICONS.archive;
        emptyTitle = 'No archived messages';
        emptySub = 'Archived conversations will appear here.';
      } else if (currentFolder === 'Scheduled') {
        iconSvg = ICONS.clock;
        emptyTitle = 'No scheduled messages';
        emptySub = 'Messages scheduled to send in the future will appear here.';
      }

      el.emailListContainer.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #5F6368;">
          <div style="width: 48px; height: 48px; margin: 0 auto 12px; color: #BDC1C6; display: flex; align-items: center; justify-content: center;">
            <span style="display: inline-block; transform: scale(2.2);">${iconSvg}</span>
          </div>
          <p style="font-size: 16px; font-weight: 500; color: #202124;">${emptyTitle}</p>
          <p style="font-size: 13px; color: #70757A; margin-top: 4px;">${emptySub}</p>
        </div>
      `;
      updateSelectionToolbar();
      return;
    }

    const isTrash = (currentFolder || '').toLowerCase() === 'trash';
    let html = '';
    displayList.forEach(mail => {
      const isUnread = mail.isUnread;
      const isStarred = mail.isStarred;

      html += `
        <div class="email-row ${isUnread ? 'unread' : ''}" data-id="${mail.id}">
          <div class="row-actions-left" onclick="event.stopPropagation();">
            <input type="checkbox" class="custom-checkbox item-checkbox">
            <button class="btn-star-row ${isStarred ? 'starred' : ''}" data-star-id="${mail.id}" title="${isStarred ? 'Starred' : 'Not starred'}">
              ${isStarred ? ICONS.starFilled : ICONS.star}
            </button>
          </div>

          <div class="row-sender">${escapeHtml(mail.sender)}</div>

          <div class="row-content-wrap">
            <span class="row-subject">${escapeHtml(mail.subject)}</span>
            <span class="row-snippet">- ${escapeHtml(mail.snippet)}</span>
          </div>

          <div class="row-date">${mail.date}</div>

          <!-- Hover Quick Actions -->
          <div class="row-hover-actions" onclick="event.stopPropagation();">
            <button class="btn-tool" data-action="delete" data-id="${mail.id}" title="${isTrash ? 'Delete permanently' : 'Delete'}" style="width: 32px; height: 32px;">
              ${ICONS.trash}
            </button>
            ${isTrash ? `
              <button class="btn-tool" data-action="restore" data-id="${mail.id}" title="Restore to Inbox" style="width: 32px; height: 32px;">
                <svg class="icon-svg" style="width: 16px; height: 16px;" viewBox="0 0 24 24"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
              </button>
            ` : `
              <button class="btn-tool" data-action="toggle-read" data-id="${mail.id}" title="${isUnread ? 'Mark as read' : 'Mark as unread'}" style="width: 32px; height: 32px;">
                ${ICONS.mailOpen}
              </button>
            `}
          </div>
        </div>
      `;
    });

    el.emailListContainer.innerHTML = html;

    // Bind row click
    el.emailListContainer.querySelectorAll('.email-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        const mail = displayList.find(m => m.id === id);
        if (mail) openEmail(mail);
      });
    });

    // Bind item checkbox change & prevent click bubbling
    el.emailListContainer.querySelectorAll('.item-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        updateSelectionToolbar();
      });
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    // Bind star click
    el.emailListContainer.querySelectorAll('[data-star-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-star-id');
        const mail = displayList.find(m => m.id === id);
        if (mail) {
          mail.isStarred = !mail.isStarred;
          btn.classList.toggle('starred', mail.isStarred);
          btn.innerHTML = mail.isStarred ? ICONS.starFilled : ICONS.star;

          try {
            const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
            const headers = { 'Content-Type': 'application/json' };
            if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
            if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

            await fetch(`/api/mail/messages/${id}/star`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ starred: mail.isStarred, folder: currentFolder })
            });
          } catch (e) {}
        }
      });
    });

    // Bind delete click
    el.emailListContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const isTrashFolder = (currentFolder || '').toLowerCase() === 'trash';
        const idx = liveMessages.findIndex(m => m.id === id);
        if (idx !== -1) {
          liveMessages.splice(idx, 1);
          renderEmailList();
          showToast(isTrashFolder ? 'Conversation deleted forever' : 'Conversation moved to Trash');

          try {
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Trash`);
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_INBOX`);
          } catch (e) {}

          try {
            const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
            const headers = { 'Content-Type': 'application/json' };
            if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
            if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

            await fetch(`/api/mail/messages/${id}/trash`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ folder: currentFolder })
            });
          } catch (e) {}
        }
      });
    });

    // Bind restore click (in Trash)
    el.emailListContainer.querySelectorAll('[data-action="restore"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const idx = liveMessages.findIndex(m => m.id === id);
        if (idx !== -1) {
          liveMessages.splice(idx, 1);
          renderEmailList();
          showToast('Conversation restored to Inbox');

          try {
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Trash`);
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_INBOX`);
          } catch (e) {}

          try {
            const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
            const headers = { 'Content-Type': 'application/json' };
            if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
            if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

            await fetch(`/api/mail/messages/${id}/restore`, {
              method: 'POST',
              headers
            });
          } catch (e) {}
        }
      });
    });

    // Bind mark read / unread toggle
    el.emailListContainer.querySelectorAll('[data-action="toggle-read"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const mail = displayList.find(m => m.id === id);
        if (mail) {
          mail.isUnread = !mail.isUnread;
          renderEmailList();

          try {
            const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
            const headers = { 'Content-Type': 'application/json' };
            if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
            if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

            await fetch(`/api/mail/messages/${id}/read`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ read: !mail.isUnread, folder: currentFolder })
            });
          } catch (e) {}
        }
      });
    });

    // Update toolbar actions and row selection state
    updateSelectionToolbar();
  }

  // Open & Read Real Email
  async function openEmail(mail) {
    activeEmailData = mail;
    mail.isUnread = false;

    el.emailListContainer.style.display = 'none';
    el.readingViewPane.style.display = 'flex';

    let senderDisplay = mail.sender;
    const lowerEmail = (mail.email || '').toLowerCase();
    if (lowerEmail.includes('admin@puvima.com')) {
      senderDisplay = 'Principal Consultant';
    } else if (lowerEmail.includes('contact@puvima.com')) {
      senderDisplay = 'PUVIMA';
    }

    el.readingEmailSubject.textContent = mail.subject;
    el.readingSenderName.textContent = senderDisplay;
    el.readingSenderEmail.textContent = `<${mail.email || mail.sender}>`;
    el.readingSenderAvatar.textContent = (senderDisplay[0] || 'P').toUpperCase();
    el.readingDateLabel.textContent = mail.date;

    const isTrash = (currentFolder || '').toLowerCase() === 'trash';
    if (el.btnReadingArchive) el.btnReadingArchive.style.display = isTrash ? 'none' : 'inline-flex';
    if (el.btnReadingSpam) el.btnReadingSpam.style.display = isTrash ? 'none' : 'inline-flex';
    if (el.btnReadingSnooze) el.btnReadingSnooze.style.display = isTrash ? 'none' : 'inline-flex';
    if (el.btnReadingDelete) {
      el.btnReadingDelete.title = isTrash ? 'Delete permanently' : 'Delete';
    }
    if (el.btnReadingRestore) {
      el.btnReadingRestore.style.display = isTrash ? 'inline-flex' : 'none';
    }

    if (mail.bodyHtml) {
      el.readingBodyContent.innerHTML = mail.bodyHtml;
      return;
    }

    // Fetch full message body
    el.readingBodyContent.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #5F6368;">
        <div class="mail-spinner" style="width: 28px; height: 28px; margin: 0 auto 8px; border: 3px solid #E8EAED; border-top-color: #1A73E8; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <p style="font-size: 14px;">Loading message content...</p>
      </div>
    `;

    try {
      const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
      const headers = {};
      if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
      if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

      const res = await fetch(`/api/mail/messages/${mail.id}?folder=${encodeURIComponent(currentFolder)}`, { headers });
      const data = await res.json();

      if (data.success && data.message) {
        mail.bodyHtml = data.message.bodyHtml || data.message.html || `<div style="white-space: pre-wrap; font-family: Roboto, sans-serif; font-size: 14px; line-height: 1.6;">${escapeHtml(data.message.bodyText || data.message.text || mail.snippet)}</div>`;
        el.readingBodyContent.innerHTML = mail.bodyHtml;

        // Render attachments if present
        if (data.message.attachments && data.message.attachments.length > 0) {
          const attHtml = `
            <div style="margin-top: 28px; border-top: 1px solid #DADCE0; padding-top: 16px;">
              <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                ${ICONS.paperclip}
                <span>Attachments (${data.message.attachments.length})</span>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${data.message.attachments.map(att => `
                  <a href="${att.downloadUrl}${activeToken ? '?token=' + activeToken : ''}" target="_blank" download="${escapeHtml(att.filename)}" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #DADCE0; border-radius: 6px; padding: 8px 14px; background: #FAFAFA; color: #1A73E8; font-size: 13px;">
                    ${ICONS.fileText}
                    <span style="font-weight: 500;">${escapeHtml(att.filename)}</span>
                    <span style="color: #70757A; font-size: 11px;">(${Math.round(att.size / 1024)} KB)</span>
                  </a>
                `).join('')}
              </div>
            </div>
          `;
          el.readingBodyContent.insertAdjacentHTML('beforeend', attHtml);
        }
      } else {
        el.readingBodyContent.innerHTML = `<p style="font-size: 14px; line-height: 1.6;">${escapeHtml(mail.snippet)}</p>`;
      }
    } catch (err) {
      el.readingBodyContent.innerHTML = `<p style="font-size: 14px; line-height: 1.6;">${escapeHtml(mail.snippet)}</p>`;
    }
  }

  // Back to inbox
  function backToInbox() {
    el.readingViewPane.style.display = 'none';
    el.emailListContainer.style.display = 'block';
    activeEmailData = null;
    renderEmailList();
  }

  // Fetch Live Messages via PUVIMA API Gateway
  async function fetchLiveInbox(forceRefresh = false) {
    const cacheKey = `puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`;

    // Always show loading spinner while syncing / reloading
    showInboxLoading();

    if (el.btnRefreshInbox) {
      el.btnRefreshInbox.classList.add('spinning');
    }

    try {
      const activeToken = localStorage.getItem('puvima_mail_token');
      if (!activeToken || !mailboxCreds) {
        showLoginScreen('Please sign in to access your mailbox.', 'info');
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + activeToken,
        'x-mail-token': activeToken
      };
      if (mailboxCreds) {
        headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));
      }

      const refreshParam = forceRefresh ? '&refresh=true' : '';
      const res = await fetch(`/api/mail/messages?folder=${encodeURIComponent(currentFolder)}&limit=50${refreshParam}`, { headers });

      if (res.status === 401) {
        localStorage.removeItem('puvima_mail_token');
        localStorage.removeItem('puvima_mailbox_creds');
        mailboxCreds = null;
        liveMessages = [];
        showLoginScreen('Your session has expired or credentials were rejected. Please sign in again.', 'error');
        return;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to retrieve messages.');
      }

      isConnectedLive = true;

      if (data.messages && data.messages.length > 0) {
        liveMessages = data.messages.map(m => {
          const fromAddr = (m.from && m.from.address ? m.from.address : '').toLowerCase();
          let senderName = (m.from && m.from.name ? m.from.name : m.from?.address) || 'Unknown';

          if (currentFolder === 'Sent' && m.to && m.to.length > 0) {
            const toRecipient = m.to[0].name || m.to[0].address || 'Recipient';
            senderName = `To: ${toRecipient}`;
          } else if (userEmail && fromAddr === userEmail.toLowerCase()) {
            senderName = 'me';
          } else if (fromAddr.includes('admin@puvima.com')) {
            senderName = 'Principal Consultant';
          } else if (fromAddr.includes('contact@puvima.com')) {
            senderName = 'PUVIMA';
          }

          return {
            id: String(m.uid),
            sender: senderName,
            email: m.from ? m.from.address : '',
            subject: m.subject || '(No Subject)',
            snippet: m.snippet || m.subject || '',
            date: m.date ? new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
            isUnread: !m.isRead,
            isStarred: Boolean(m.isStarred),
            tab: 'primary',
            bodyHtml: m.bodyHtml,
            bodyText: m.bodyText
          };
        });

        try {
          localStorage.setItem(cacheKey, JSON.stringify(liveMessages));
        } catch (e) {}
      } else {
        liveMessages = [];
        try {
          localStorage.setItem(cacheKey, JSON.stringify([]));
        } catch (e) {}
      }
      renderEmailList();
      if (forceRefresh) {
        showToast('Mailbox is up to date.');
      }
    } catch (err) {
      console.warn('[Mail] Fetch inbox error:', err.message);
      showInboxError(err.message || 'Unable to sync messages with mail server.');
    } finally {
      if (el.btnRefreshInbox) {
        el.btnRefreshInbox.classList.remove('spinning');
      }
    }
  }

  // Attachment Management (PDF, Media, Photos, Documents)
  function renderAttachmentsList() {
    if (attachedFiles.length === 0) {
      el.dockAttachmentsList.style.display = 'none';
      el.dockAttachmentsList.innerHTML = '';
      return;
    }

    el.dockAttachmentsList.style.display = 'flex';
    let html = '';
    attachedFiles.forEach((file, idx) => {
      const isImg = file.type.startsWith('image/');
      const icon = isImg ? ICONS.image : ICONS.fileText;
      const sizeKb = Math.round(file.size / 1024);

      html += `
        <div class="dock-att-chip">
          ${icon}
          <span class="dock-att-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span style="font-size: 11px; color: #70757A;">(${sizeKb} KB)</span>
          <button type="button" class="btn-remove-att" data-idx="${idx}" title="Remove attachment">
            ${ICONS.close}
          </button>
        </div>
      `;
    });

    el.dockAttachmentsList.innerHTML = html;

    el.dockAttachmentsList.querySelectorAll('.btn-remove-att').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        attachedFiles.splice(idx, 1);
        renderAttachmentsList();
      });
    });
  }

  function handleFilesAdded(files) {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 25 * 1024 * 1024) {
        showToast(`File "${file.name}" exceeds 25 MB limit.`);
        continue;
      }
      attachedFiles.push(file);
    }
    renderAttachmentsList();
  }

  // Multi-Recipient Tag / Chip Helpers
  function addRecipientChip(chipsContainerEl, inputEl, emailText) {
    if (!chipsContainerEl) return;
    const clean = String(emailText || '').trim().replace(/^[,;\s]+|[,;\s]+$/g, '');
    if (!clean) return;

    // Avoid duplicates within the same field
    const existing = Array.from(chipsContainerEl.querySelectorAll('.recipient-chip'))
      .map(c => (c.dataset.email || '').toLowerCase());
    if (existing.includes(clean.toLowerCase())) return;

    const chip = document.createElement('span');
    chip.className = 'recipient-chip';
    chip.dataset.email = clean;
    chip.innerHTML = `
      <span class="chip-text">${escapeHtml(clean)}</span>
      <span class="chip-remove" title="Remove">&times;</span>
    `;

    chip.querySelector('.chip-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      chip.remove();
      if (inputEl) inputEl.focus();
    });

    chipsContainerEl.appendChild(chip);
  }

  function clearRecipientChips(chipsContainerEl) {
    if (chipsContainerEl) chipsContainerEl.innerHTML = '';
  }

  function getFieldRecipients(inputEl, chipsContainerEl) {
    const list = [];
    if (chipsContainerEl) {
      chipsContainerEl.querySelectorAll('.recipient-chip').forEach(c => {
        const mail = (c.dataset.email || '').trim();
        if (mail && !list.includes(mail)) list.push(mail);
      });
    }
    if (inputEl && inputEl.value.trim()) {
      const parts = inputEl.value.split(/[,;\n\r\s]+/).map(p => p.trim()).filter(Boolean);
      parts.forEach(p => {
        if (!list.includes(p)) list.push(p);
      });
    }
    return list;
  }

  function setupRecipientField(inputEl, chipsContainerEl, rowEl) {
    if (!inputEl || !chipsContainerEl) return;

    function processDelimiters() {
      const val = inputEl.value;
      if (val.includes(',') || val.includes(';') || val.includes('\n')) {
        const parts = val.split(/[,;\n]+/);
        for (let i = 0; i < parts.length - 1; i++) {
          addRecipientChip(chipsContainerEl, inputEl, parts[i]);
        }
        inputEl.value = parts[parts.length - 1].trimStart();
      }
    }

    inputEl.addEventListener('input', processDelimiters);

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
        e.preventDefault();
        const val = inputEl.value.trim();
        if (val) {
          addRecipientChip(chipsContainerEl, inputEl, val);
          inputEl.value = '';
        }
      } else if (e.key === 'Backspace' && inputEl.value === '') {
        const chips = chipsContainerEl.querySelectorAll('.recipient-chip');
        if (chips.length > 0) {
          chips[chips.length - 1].remove();
        }
      }
    });

    inputEl.addEventListener('blur', () => {
      const val = inputEl.value.trim();
      if (val && (val.includes('@') || val.length > 2)) {
        addRecipientChip(chipsContainerEl, inputEl, val);
        inputEl.value = '';
      }
    });

    inputEl.addEventListener('paste', (e) => {
      setTimeout(() => {
        const val = inputEl.value;
        if (val.includes(',') || val.includes(';') || val.includes('\n') || val.includes(' ')) {
          const parts = val.split(/[,;\s\n]+/).map(p => p.trim()).filter(Boolean);
          parts.forEach(p => addRecipientChip(chipsContainerEl, inputEl, p));
          inputEl.value = '';
        }
      }, 10);
    });

    if (rowEl) {
      rowEl.addEventListener('click', (e) => {
        if (!e.target.closest('.chip-remove')) {
          inputEl.focus();
        }
      });
    }
  }

  // Handle Send Email (Multi-Recipient)
  async function handleSendDock(e) {
    e.preventDefault();

    const toList = getFieldRecipients(el.dockToInput, el.dockToChips);
    const ccList = getFieldRecipients(el.dockCcInput, el.dockCcChips);
    const bccList = getFieldRecipients(el.dockBccInput, el.dockBccChips);
    const subject = el.dockSubjectInput.value.trim();
    const body = el.dockBodyInput.value.trim();

    if (toList.length === 0) {
      showToast('Please specify at least one recipient.');
      el.dockToInput.focus();
      return;
    }

    el.btnSendDockMail.disabled = true;
    el.btnSendDockMail.innerHTML = '<span>Sending...</span>';

    try {
      const formData = new FormData();
      formData.append('to', toList.join(', '));
      if (ccList.length > 0) formData.append('cc', ccList.join(', '));
      if (bccList.length > 0) formData.append('bcc', bccList.join(', '));
      formData.append('subject', subject || '(No Subject)');
      formData.append('text', body);
      formData.append('html', `<div style="font-family: Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.5;">${escapeHtml(body).replace(/\n/g, '<br>')}</div>`);

      attachedFiles.forEach(f => formData.append('attachments', f, f.name));

      const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
      const headers = {};
      if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
      if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Send failed');
      }

      showToast(`Message sent to ${toList.length} recipient${toList.length > 1 ? 's' : ''}!`);
      el.composeForm.reset();
      clearRecipientChips(el.dockToChips);
      clearRecipientChips(el.dockCcChips);
      clearRecipientChips(el.dockBccChips);
      attachedFiles = [];
      renderAttachmentsList();
      el.gmailComposeDock.classList.remove('active');

      if (currentFolder === 'Sent') {
        fetchLiveInbox();
      }
    } catch (err) {
      showToast('Error sending message: ' + err.message);
    } finally {
      el.btnSendDockMail.disabled = false;
      el.btnSendDockMail.innerHTML = '<span>Send</span>' + ICONS.send;
    }
  }

  // Modal Dialog Handlers
  function openConnectModal() {
    if (el.connectMailboxModal) {
      el.connectMailboxModal.style.display = 'flex';
      if (el.connectEmail) el.connectEmail.value = userEmail || 'admin@puvima.com';
      if (el.connectPassword) {
        el.connectPassword.value = '';
        setTimeout(() => el.connectPassword.focus(), 150);
      }
    }
  }

  function closeConnectModal() {
    if (el.connectMailboxModal) {
      el.connectMailboxModal.style.display = 'none';
      if (el.connectStatusAlert) el.connectStatusAlert.style.display = 'none';
    }
  }

  function showConnectAlert(msg, type = 'error') {
    if (!el.connectStatusAlert) return;
    el.connectStatusAlert.style.display = 'block';
    if (type === 'error') {
      el.connectStatusAlert.style.background = '#FCE8E6';
      el.connectStatusAlert.style.color = '#C5221F';
      el.connectStatusAlert.innerHTML = `<strong>Error:</strong> ${escapeHtml(msg)}`;
    } else {
      el.connectStatusAlert.style.background = '#E8F0FE';
      el.connectStatusAlert.style.color = '#0B57D0';
      el.connectStatusAlert.innerHTML = escapeHtml(msg);
    }
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

  // Initialize Application
  function init() {
    // Check session first
    checkSession();

    // Login Form Events
    if (el.mailLoginForm) {
      el.mailLoginForm.addEventListener('submit', handleLoginSubmit);
    }

    if (el.loginAccountSelect) {
      el.loginAccountSelect.addEventListener('change', () => {
        el.loginEmail.value = el.loginAccountSelect.value;
        const isPrincipal = el.loginEmail.value.includes('admin@puvima.com');
        el.loginPasswordHint.textContent = isPrincipal
          ? 'Enter your email password for Principal Consultant (admin@puvima.com).'
          : 'Enter your email password for PUVIMA (contact@puvima.com).';
        el.loginPassword.focus();
      });
    }

    if (el.btnToggleLoginPassword) {
      el.btnToggleLoginPassword.addEventListener('click', () => {
        const isPass = el.loginPassword.type === 'password';
        el.loginPassword.type = isPass ? 'text' : 'password';
        el.btnToggleLoginPassword.textContent = isPass ? 'Hide' : 'Show';
      });
    }

    // Settings Modal Triggers
    if (el.btnOpenMailboxSettings) {
      el.btnOpenMailboxSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        openConnectModal();
      });
    }

    if (el.btnBannerConnectMailbox) {
      el.btnBannerConnectMailbox.addEventListener('click', (e) => {
        e.stopPropagation();
        openConnectModal();
      });
    }

    if (el.btnCancelConnectModal) {
      el.btnCancelConnectModal.addEventListener('click', closeConnectModal);
    }

    if (el.connectMailboxModal) {
      el.connectMailboxModal.addEventListener('click', (e) => {
        if (e.target === el.connectMailboxModal) closeConnectModal();
      });
    }

    if (el.connectAccountSelect) {
      el.connectAccountSelect.addEventListener('change', () => {
        if (el.connectEmail) el.connectEmail.value = el.connectAccountSelect.value;
        if (el.connectPassword) el.connectPassword.focus();
      });
    }

    // Connect Mailbox Modal Form Submit
    if (el.connectMailboxForm) {
      el.connectMailboxForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = el.connectEmail.value.trim() || userEmail;
        const password = el.connectPassword.value.trim();

        if (!email || !password) {
          showConnectAlert('Please enter both your email address and password.', 'error');
          return;
        }

        el.btnSubmitConnectMailbox.disabled = true;
        el.btnSubmitConnectMailbox.textContent = 'Connecting...';
        showConnectAlert('Connecting securely to PUVIMA Mail Gateway...', 'info');

        try {
          const res = await fetch('/api/mail/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();

          if (!res.ok || !data.success) {
            throw new Error(data.message || 'Connection failed.');
          }

          userEmail = email;
          if (data.token) {
            localStorage.setItem('puvima_mail_token', data.token);
          }
          localStorage.setItem('puvima_current_email', email);

          if (data.mode === 'godaddy') {
            mailboxCreds = {
              user: email,
              pass: password,
              host: 'imap.secureserver.net',
              port: 993,
              smtpHost: 'smtpout.secureserver.net',
              smtpPort: 465
            };
            localStorage.setItem('puvima_mailbox_creds', JSON.stringify(mailboxCreds));
            showToast(`Connected live to mailbox (${email})`);
          } else {
            localStorage.removeItem('puvima_mailbox_creds');
            mailboxCreds = null;
            showToast(`Connected to PUVIMA Corporate Mailbox (${email})`);
          }

          closeConnectModal();
          updateAvatar();
          fetchLiveInbox();
        } catch (err) {
          showConnectAlert(err.message, 'error');
        } finally {
          el.btnSubmitConnectMailbox.disabled = false;
          el.btnSubmitConnectMailbox.textContent = 'Connect & Sign In';
        }
      });
    }

    // Avatar Dropdown Menu
    if (el.btnAccountAvatar) {
      el.btnAccountAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (el.avatarDropdownMenu) {
          const isVis = el.avatarDropdownMenu.style.display === 'block';
          el.avatarDropdownMenu.style.display = isVis ? 'none' : 'block';
        }
      });
    }

    document.addEventListener('click', () => {
      if (el.avatarDropdownMenu) el.avatarDropdownMenu.style.display = 'none';
    });

    if (el.btnMenuSignOut) {
      el.btnMenuSignOut.addEventListener('click', (e) => {
        e.stopPropagation();
        signOut();
      });
    }

    if (el.btnMenuSwitchAccount) {
      el.btnMenuSwitchAccount.addEventListener('click', (e) => {
        e.stopPropagation();
        signOut();
      });
    }

    // Hamburger Sidebar Toggle
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const gmailSidebar = document.querySelector('.gmail-sidebar');
    if (btnToggleSidebar && gmailSidebar) {
      btnToggleSidebar.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          const isHidden = gmailSidebar.style.display === 'none' || getComputedStyle(gmailSidebar).display === 'none';
          gmailSidebar.style.display = isHidden ? 'flex' : 'none';
        } else {
          gmailSidebar.classList.toggle('sidebar-mini');
        }
      });
    }

    // Compose dock triggers
    if (el.btnOpenCompose) {
      el.btnOpenCompose.addEventListener('click', () => {
        el.gmailComposeDock.classList.add('active');
        if (el.dockToInput) el.dockToInput.focus();
      });
    }

    if (el.btnCloseCompose) {
      el.btnCloseCompose.addEventListener('click', () => el.gmailComposeDock.classList.remove('active'));
    }

    if (el.btnDiscardDockMail) {
      el.btnDiscardDockMail.addEventListener('click', () => {
        el.composeForm.reset();
        clearRecipientChips(el.dockToChips);
        clearRecipientChips(el.dockCcChips);
        clearRecipientChips(el.dockBccChips);
        attachedFiles = [];
        renderAttachmentsList();
        el.gmailComposeDock.classList.remove('active');
        showToast('Draft discarded.');
      });
    }

    // Minimize & Maximize Compose
    if (el.btnMinimizeCompose) {
      el.btnMinimizeCompose.addEventListener('click', () => {
        const isMinimized = el.gmailComposeDock.style.height === '40px';
        el.gmailComposeDock.style.height = isMinimized ? '520px' : '40px';
      });
    }

    if (el.btnMaximizeCompose) {
      el.btnMaximizeCompose.addEventListener('click', () => {
        const isFull = el.gmailComposeDock.style.width === '100vw';
        el.gmailComposeDock.style.width = isFull ? '500px' : '100vw';
        el.gmailComposeDock.style.height = isFull ? '520px' : '100vh';
        el.gmailComposeDock.style.right = isFull ? '64px' : '0';
      });
    }

    // Toggle CC/BCC
    if (el.btnToggleCcBcc) {
      el.btnToggleCcBcc.addEventListener('click', () => {
        const isVis = el.ccBccWrapper.style.display === 'flex';
        el.ccBccWrapper.style.display = isVis ? 'none' : 'flex';
      });
    }

    // Attachment Triggers
    if (el.btnAttachFile) {
      el.btnAttachFile.addEventListener('click', () => el.composeFileInput.click());
    }

    if (el.btnAttachPhoto) {
      el.btnAttachPhoto.addEventListener('click', () => el.composePhotoInput.click());
    }

    if (el.composeFileInput) {
      el.composeFileInput.addEventListener('change', (e) => {
        handleFilesAdded(e.target.files);
        el.composeFileInput.value = '';
      });
    }

    if (el.composePhotoInput) {
      el.composePhotoInput.addEventListener('change', (e) => {
        handleFilesAdded(e.target.files);
        el.composePhotoInput.value = '';
      });
    }

    // Send Form
    if (el.composeForm) {
      el.composeForm.addEventListener('submit', handleSendDock);
    }

    // Reading pane triggers
    if (el.btnBackToInbox) {
      el.btnBackToInbox.addEventListener('click', backToInbox);
    }

    if (el.btnReadingReply) {
      el.btnReadingReply.addEventListener('click', () => {
        if (!activeEmailData) return;
        el.gmailComposeDock.classList.add('active');
        clearRecipientChips(el.dockToChips);
        const replyEmail = activeEmailData.email || activeEmailData.sender;
        if (replyEmail) {
          addRecipientChip(el.dockToChips, el.dockToInput, replyEmail);
        }
        el.dockSubjectInput.value = `Re: ${activeEmailData.subject}`;
        el.dockBodyInput.focus();
      });
    }

    if (el.btnReadingForward) {
      el.btnReadingForward.addEventListener('click', () => {
        if (!activeEmailData) return;
        el.gmailComposeDock.classList.add('active');
        clearRecipientChips(el.dockToChips);
        el.dockSubjectInput.value = `Fwd: ${activeEmailData.subject}`;
        el.dockBodyInput.value = `\n\n---------- Forwarded message ---------\nFrom: ${activeEmailData.sender}\nSubject: ${activeEmailData.subject}\n`;
        el.dockToInput.focus();
      });
    }

    // Reading View: Archive
    if (el.btnReadingArchive) {
      el.btnReadingArchive.addEventListener('click', async () => {
        if (!activeEmailData) return;
        const id = activeEmailData.id;
        const idx = liveMessages.findIndex(m => m.id === id);
        if (idx !== -1) liveMessages.splice(idx, 1);
        showToast('Conversation archived');
        backToInbox();

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Archive`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch(`/api/mail/messages/${id}/move`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ targetFolder: 'Archive', folder: currentFolder })
          });
        } catch (e) {}
      });
    }

    // Reading View: Report Spam
    if (el.btnReadingSpam) {
      el.btnReadingSpam.addEventListener('click', async () => {
        if (!activeEmailData) return;
        const id = activeEmailData.id;
        const idx = liveMessages.findIndex(m => m.id === id);
        if (idx !== -1) liveMessages.splice(idx, 1);
        showToast('Conversation marked as spam');
        backToInbox();

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Spam`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch(`/api/mail/messages/${id}/move`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ targetFolder: 'Spam', folder: currentFolder })
          });
        } catch (e) {}
      });
    }

    // Reading View: Mark as unread
    if (el.btnReadingMarkUnread) {
      el.btnReadingMarkUnread.addEventListener('click', async () => {
        if (!activeEmailData) return;
        const id = activeEmailData.id;
        const mail = liveMessages.find(m => m.id === id);
        if (mail) mail.isUnread = true;
        showToast('Conversation marked as unread');
        backToInbox();

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch(`/api/mail/messages/${id}/read`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ read: false, folder: currentFolder })
          });
        } catch (e) {}
      });
    }

    // Reading View: Snooze
    if (el.btnReadingSnooze) {
      el.btnReadingSnooze.addEventListener('click', async () => {
        if (!activeEmailData) return;
        const id = activeEmailData.id;
        const idx = liveMessages.findIndex(m => m.id === id);
        if (idx !== -1) liveMessages.splice(idx, 1);
        showToast('Conversation snoozed until tomorrow 8:00 AM');
        backToInbox();

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Scheduled`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch(`/api/mail/messages/${id}/move`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ targetFolder: 'Scheduled', folder: currentFolder })
          });
        } catch (e) {}
      });
    }

    // Reading View: Print
    if (el.btnReadingPrint) {
      el.btnReadingPrint.addEventListener('click', () => {
        window.print();
      });
    }

    if (el.btnReadingDelete) {
      el.btnReadingDelete.addEventListener('click', async () => {
        if (activeEmailData) {
          const id = activeEmailData.id;
          const isTrash = (currentFolder || '').toLowerCase() === 'trash';
          const idx = liveMessages.findIndex(m => m.id === id);
          if (idx !== -1) liveMessages.splice(idx, 1);
          showToast(isTrash ? 'Conversation deleted forever' : 'Conversation moved to Trash');
          backToInbox();

          try {
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Trash`);
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_INBOX`);
          } catch (e) {}

          try {
            const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
            const headers = { 'Content-Type': 'application/json' };
            if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
            if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

            await fetch(`/api/mail/messages/${id}/trash`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ folder: currentFolder })
            });
          } catch (e) {}
        }
      });
    }

    if (el.btnReadingRestore) {
      el.btnReadingRestore.addEventListener('click', async () => {
        if (activeEmailData) {
          const id = activeEmailData.id;
          const idx = liveMessages.findIndex(m => m.id === id);
          if (idx !== -1) liveMessages.splice(idx, 1);
          showToast('Conversation restored to Inbox');
          backToInbox();

          try {
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Trash`);
            localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_INBOX`);
          } catch (e) {}

          try {
            const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
            const headers = { 'Content-Type': 'application/json' };
            if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
            if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

            await fetch(`/api/mail/messages/${id}/restore`, {
              method: 'POST',
              headers
            });
          } catch (e) {}
        }
      });
    }

    // Sidebar Folder Clicks
    document.querySelectorAll('.folder-row[data-folder]').forEach(row => {
      row.addEventListener('click', () => {
        document.querySelectorAll('.folder-row[data-folder]').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        currentFolder = row.getAttribute('data-folder') || 'INBOX';

        if (el.masterSelectCheckbox) {
          el.masterSelectCheckbox.checked = false;
          el.masterSelectCheckbox.indeterminate = false;
        }
        if (el.btnToolbarArchive) el.btnToolbarArchive.style.display = 'none';
        if (el.btnToolbarSpam) el.btnToolbarSpam.style.display = 'none';
        if (el.btnToolbarTrash) el.btnToolbarTrash.style.display = 'none';
        if (el.btnToolbarRestore) el.btnToolbarRestore.style.display = 'none';
        if (el.btnToolbarMarkUnread) el.btnToolbarMarkUnread.style.display = 'none';
        if (el.btnToolbarSnooze) el.btnToolbarSnooze.style.display = 'none';

        if (el.readingViewPane) el.readingViewPane.style.display = 'none';
        if (el.emailListContainer) el.emailListContainer.style.display = 'block';

        liveMessages = [];
        showInboxLoading();
        fetchLiveInbox();
      });
    });

    // Less / More Folder Toggle
    if (el.btnToggleMoreFolders) {
      el.btnToggleMoreFolders.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isExpanded = el.btnToggleMoreFolders.getAttribute('data-expanded') === 'true';
        if (isExpanded) {
          el.btnToggleMoreFolders.setAttribute('data-expanded', 'false');
          if (el.moreFoldersCollapsible) el.moreFoldersCollapsible.classList.add('collapsed');
          if (el.textToggleMore) el.textToggleMore.textContent = 'More';
          if (el.iconToggleMore) el.iconToggleMore.innerHTML = ICONS.chevronDown;
        } else {
          el.btnToggleMoreFolders.setAttribute('data-expanded', 'true');
          if (el.moreFoldersCollapsible) el.moreFoldersCollapsible.classList.remove('collapsed');
          if (el.textToggleMore) el.textToggleMore.textContent = 'Less';
          if (el.iconToggleMore) el.iconToggleMore.innerHTML = ICONS.chevronUp;
        }
      });
    }

    // Brand Logo Home Click -> Reset to Inbox
    const btnBrandLogoHome = document.getElementById('btnBrandLogoHome');
    if (btnBrandLogoHome) {
      btnBrandLogoHome.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.folder-row[data-folder]').forEach(r => {
          r.classList.toggle('active', (r.getAttribute('data-folder') || '').toUpperCase() === 'INBOX');
        });
        currentFolder = 'INBOX';
        if (el.masterSelectCheckbox) {
          el.masterSelectCheckbox.checked = false;
          el.masterSelectCheckbox.indeterminate = false;
        }
        if (el.btnToolbarArchive) el.btnToolbarArchive.style.display = 'none';
        if (el.btnToolbarSpam) el.btnToolbarSpam.style.display = 'none';
        if (el.btnToolbarTrash) el.btnToolbarTrash.style.display = 'none';
        if (el.btnToolbarRestore) el.btnToolbarRestore.style.display = 'none';
        if (el.btnToolbarMarkUnread) el.btnToolbarMarkUnread.style.display = 'none';
        if (el.btnToolbarSnooze) el.btnToolbarSnooze.style.display = 'none';

        if (el.readingViewPane) el.readingViewPane.style.display = 'none';
        if (el.emailListContainer) el.emailListContainer.style.display = 'block';
        fetchLiveInbox();
      });
    }

    // Refresh button
    if (el.btnRefreshInbox) {
      el.btnRefreshInbox.addEventListener('click', () => {
        showToast('Refreshing mail...');
        fetchLiveInbox(true);
      });
    }

    // Search bar
    if (el.gmailSearchInput) {
      el.gmailSearchInput.addEventListener('input', renderEmailList);
    }

    // Master select all
    if (el.masterSelectCheckbox) {
      el.masterSelectCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.item-checkbox').forEach(cb => {
          cb.checked = checked;
        });
        updateSelectionToolbar();
      });
    }

    // Toolbar Move to Trash / Delete selected
    if (el.btnToolbarTrash) {
      el.btnToolbarTrash.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.item-checkbox:checked'));
        if (checkedBoxes.length === 0) return;

        const uids = checkedBoxes.map(cb => {
          const row = cb.closest('.email-row');
          return row ? row.getAttribute('data-id') : null;
        }).filter(Boolean);

        if (uids.length === 0) return;

        const isTrash = (currentFolder || '').toLowerCase() === 'trash';
        const count = uids.length;

        // Optimistic UI update: Remove selected from liveMessages
        const uidSet = new Set(uids.map(u => String(u)));
        liveMessages = liveMessages.filter(m => !uidSet.has(String(m.id)));
        renderEmailList();

        showToast(isTrash 
          ? `${count} conversation${count > 1 ? 's' : ''} deleted forever`
          : `${count} conversation${count > 1 ? 's' : ''} moved to Trash`
        );

        // Clear cached folder data to force fresh sync
        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Trash`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_INBOX`);
        } catch (e) {}

        // Dispatch to backend API
        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch('/api/mail/messages/batch-trash', {
            method: 'POST',
            headers,
            body: JSON.stringify({ uids, folder: currentFolder })
          });
        } catch (err) {
          console.warn('[Mail] batch trash dispatch error:', err.message);
        }
      });
    }

    // Toolbar Restore selected (when in Trash)
    if (el.btnToolbarRestore) {
      el.btnToolbarRestore.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.item-checkbox:checked'));
        if (checkedBoxes.length === 0) return;

        const uids = checkedBoxes.map(cb => {
          const row = cb.closest('.email-row');
          return row ? row.getAttribute('data-id') : null;
        }).filter(Boolean);

        if (uids.length === 0) return;
        const count = uids.length;

        // Optimistic UI update: remove from Trash
        const uidSet = new Set(uids.map(u => String(u)));
        liveMessages = liveMessages.filter(m => !uidSet.has(String(m.id)));
        renderEmailList();

        showToast(`${count} conversation${count > 1 ? 's' : ''} restored to Inbox`);

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Trash`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_INBOX`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch('/api/mail/messages/batch-restore', {
            method: 'POST',
            headers,
            body: JSON.stringify({ uids })
          });
        } catch (err) {
          console.warn('[Mail] batch restore error:', err.message);
        }
      });
    }

    // Toolbar Archive selected
    if (el.btnToolbarArchive) {
      el.btnToolbarArchive.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.item-checkbox:checked'));
        if (checkedBoxes.length === 0) return;

        const uids = checkedBoxes.map(cb => {
          const row = cb.closest('.email-row');
          return row ? row.getAttribute('data-id') : null;
        }).filter(Boolean);

        if (uids.length === 0) return;
        const count = uids.length;

        const uidSet = new Set(uids.map(u => String(u)));
        liveMessages = liveMessages.filter(m => !uidSet.has(String(m.id)));
        renderEmailList();

        showToast(`${count} conversation${count > 1 ? 's' : ''} archived`);

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Archive`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch('/api/mail/messages/batch-move', {
            method: 'POST',
            headers,
            body: JSON.stringify({ uids, targetFolder: 'Archive', folder: currentFolder })
          });
        } catch (err) {
          console.warn('[Mail] batch archive error:', err.message);
        }
      });
    }

    // Toolbar Spam selected
    if (el.btnToolbarSpam) {
      el.btnToolbarSpam.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.item-checkbox:checked'));
        if (checkedBoxes.length === 0) return;

        const uids = checkedBoxes.map(cb => {
          const row = cb.closest('.email-row');
          return row ? row.getAttribute('data-id') : null;
        }).filter(Boolean);

        if (uids.length === 0) return;
        const count = uids.length;

        const uidSet = new Set(uids.map(u => String(u)));
        liveMessages = liveMessages.filter(m => !uidSet.has(String(m.id)));
        renderEmailList();

        showToast(`${count} conversation${count > 1 ? 's' : ''} marked as spam`);

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Spam`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch('/api/mail/messages/batch-move', {
            method: 'POST',
            headers,
            body: JSON.stringify({ uids, targetFolder: 'Spam', folder: currentFolder })
          });
        } catch (err) {
          console.warn('[Mail] batch spam error:', err.message);
        }
      });
    }

    // Toolbar Mark as unread selected
    if (el.btnToolbarMarkUnread) {
      el.btnToolbarMarkUnread.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.item-checkbox:checked'));
        if (checkedBoxes.length === 0) return;

        const uids = checkedBoxes.map(cb => {
          const row = cb.closest('.email-row');
          return row ? row.getAttribute('data-id') : null;
        }).filter(Boolean);

        if (uids.length === 0) return;
        const count = uids.length;

        const uidSet = new Set(uids.map(u => String(u)));
        liveMessages.forEach(m => {
          if (uidSet.has(String(m.id))) m.isUnread = true;
        });
        renderEmailList();

        showToast(`${count} conversation${count > 1 ? 's' : ''} marked as unread`);

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch('/api/mail/messages/batch-read', {
            method: 'POST',
            headers,
            body: JSON.stringify({ uids, read: false, folder: currentFolder })
          });
        } catch (err) {
          console.warn('[Mail] batch mark unread error:', err.message);
        }
      });
    }

    // Toolbar Snooze selected
    if (el.btnToolbarSnooze) {
      el.btnToolbarSnooze.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.item-checkbox:checked'));
        if (checkedBoxes.length === 0) return;

        const uids = checkedBoxes.map(cb => {
          const row = cb.closest('.email-row');
          return row ? row.getAttribute('data-id') : null;
        }).filter(Boolean);

        if (uids.length === 0) return;
        const count = uids.length;

        const uidSet = new Set(uids.map(u => String(u)));
        liveMessages = liveMessages.filter(m => !uidSet.has(String(m.id)));
        renderEmailList();

        showToast(`${count} conversation${count > 1 ? 's' : ''} snoozed until tomorrow 8:00 AM`);

        try {
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_${currentFolder}`);
          localStorage.removeItem(`puvima_mail_cache_${(userEmail || 'default')}_Scheduled`);
        } catch (e) {}

        try {
          const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
          const headers = { 'Content-Type': 'application/json' };
          if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
          if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

          await fetch('/api/mail/messages/batch-move', {
            method: 'POST',
            headers,
            body: JSON.stringify({ uids, targetFolder: 'Scheduled', folder: currentFolder })
          });
        } catch (err) {
          console.warn('[Mail] batch snooze error:', err.message);
        }
      });
    }

    // Setup Multi-Recipient Fields (To, Cc, Bcc)
    setupRecipientField(el.dockToInput, el.dockToChips, el.dockToRow);
    setupRecipientField(el.dockCcInput, el.dockCcChips, el.dockCcRow);
    setupRecipientField(el.dockBccInput, el.dockBccChips, el.dockBccRow);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
