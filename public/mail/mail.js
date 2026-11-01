/**
 * PUVIMA Mail — Official GoDaddy Corporate Email Client
 * Featuring Google Gmail M3 Interface, GoDaddy IMAP/SMTP Gateway,
 * Full Media & PDF Attachment Dispatch, and Single-Sign-On Session Gate.
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

  // Embedded Pure SVG Icons System (100% Reliable, Instant Paint, Zero CSP/CDN Dependencies, No Emojis)
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
  } catch (e) {}

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
    btnReadingDelete: document.getElementById('btnReadingDelete'),
    btnReadingMarkUnread: document.getElementById('btnReadingMarkUnread'),

    gmailComposeDock: document.getElementById('gmailComposeDock'),
    btnOpenCompose: document.getElementById('btnOpenCompose'),
    btnCloseCompose: document.getElementById('btnCloseCompose'),
    btnMinimizeCompose: document.getElementById('btnMinimizeCompose'),
    btnMaximizeCompose: document.getElementById('btnMaximizeCompose'),
    btnDiscardDockMail: document.getElementById('btnDiscardDockMail'),
    composeForm: document.getElementById('composeForm'),
    dockFromDisplay: document.getElementById('dockFromDisplay'),
    dockToInput: document.getElementById('dockToInput'),
    btnToggleCcBcc: document.getElementById('btnToggleCcBcc'),
    ccBccWrapper: document.getElementById('ccBccWrapper'),
    dockCcInput: document.getElementById('dockCcInput'),
    dockBccInput: document.getElementById('dockBccInput'),
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
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // Update Avatar Profile Initial & Sender Titles
  function updateAvatar() {
    if (userEmail) {
      const isPrincipal = userEmail.toLowerCase().includes('admin@puvima.com');
      const displayName = isPrincipal
        ? 'Principal Consultant'
        : (userEmail.toLowerCase().includes('contact@puvima.com') ? 'PUVIMA' : 'PUVIMA');

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
      document.title = `Inbox (${sidebarInboxCount ? sidebarInboxCount.textContent : '0'}) - ${displayName} - PUVIMA Mail`;
    }
  }

  // Session Management & Gate Control
  function checkSession() {
    const savedToken = localStorage.getItem('puvima_mail_token');
    const savedCreds = localStorage.getItem('puvima_mailbox_creds');

    if (savedToken && savedCreds) {
      try {
        mailboxCreds = JSON.parse(savedCreds);
        userEmail = mailboxCreds.user || localStorage.getItem('puvima_current_email') || 'admin@puvima.com';
        showWorkspace();
        return;
      } catch (e) {}
    }

    // No session: Show login screen, hide workspace
    showLoginScreen();
  }

  function showLoginScreen() {
    isConnectedLive = false;
    liveMessages = [];
    if (el.gmailWorkspace) el.gmailWorkspace.style.display = 'none';
    if (el.mailLoginScreen) el.mailLoginScreen.style.display = 'flex';
    if (el.loginPassword) {
      el.loginPassword.value = '';
      setTimeout(() => el.loginPassword.focus(), 150);
    }
  }

  function showWorkspace() {
    isConnectedLive = true;
    if (el.mailLoginScreen) el.mailLoginScreen.style.display = 'none';
    if (el.gmailWorkspace) el.gmailWorkspace.style.display = 'flex';
    updateAvatar();
    fetchLiveInbox();
  }

  function signOut() {
    localStorage.removeItem('puvima_mail_token');
    localStorage.removeItem('puvima_mailbox_creds');
    mailboxCreds = null;
    if (el.avatarDropdownMenu) el.avatarDropdownMenu.style.display = 'none';
    showToast('Signed out of PUVIMA Mail.');
    showLoginScreen();
  }

  // Handle Full-Page Login Submit
  async function handleLoginSubmit(e) {
    e.preventDefault();

    const email = el.loginEmail.value.trim() || 'admin@puvima.com';
    const password = el.loginPassword.value.trim();

    if (!email || !password) {
      showLoginAlert('Please enter both your email address and GoDaddy password.', 'error');
      return;
    }

    el.btnSubmitLogin.disabled = true;
    el.btnSubmitLogin.innerHTML = '<span>Verifying with GoDaddy...</span>';
    showLoginAlert('Connecting securely to imap.secureserver.net (Port 993 SSL)...', 'info');

    const credsPayload = {
      email,
      password,
      imapHost: 'imap.secureserver.net',
      imapPort: '993',
      imapSecure: true,
      smtpHost: 'smtpout.secureserver.net',
      smtpPort: '465',
      smtpSecure: true
    };

    try {
      const res = await fetch('/api/mail/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credsPayload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed.');
      }

      // Success
      userEmail = email;
      mailboxCreds = {
        user: email,
        pass: password,
        host: 'imap.secureserver.net',
        port: 993,
        smtpHost: 'smtpout.secureserver.net',
        smtpPort: 465
      };

      if (data.token) {
        localStorage.setItem('puvima_mail_token', data.token);
      }
      localStorage.setItem('puvima_current_email', email);
      localStorage.setItem('puvima_mailbox_creds', JSON.stringify(mailboxCreds));

      showToast(`Welcome! Connected to ${email}`);
      showWorkspace();
    } catch (err) {
      showLoginAlert(err.message, 'error');
    } finally {
      el.btnSubmitLogin.disabled = false;
      el.btnSubmitLogin.innerHTML = '<span>Sign In to GoDaddy Mail</span><i data-lucide="arrow-right" style="width: 18px; height: 18px;"></i>';
      if (window.lucide) window.lucide.createIcons();
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

  // Render Emails List (Real Messages from GoDaddy)
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
      el.sidebarInboxCount.textContent = displayList.length;
    }

    if (displayList.length === 0) {
      let iconSvg = ICONS.inbox;
      let emptyTitle = 'Your inbox is empty';
      let emptySub = `Emails received on your GoDaddy business mailbox (${escapeHtml(userEmail)}) will appear here.`;

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
      return;
    }

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
            <button class="btn-tool" data-action="delete" data-id="${mail.id}" title="Delete" style="width: 32px; height: 32px;">
              ${ICONS.trash}
            </button>
            <button class="btn-tool" data-action="toggle-read" data-id="${mail.id}" title="Mark as read" style="width: 32px; height: 32px;">
              ${ICONS.mailOpen}
            </button>
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

    // Bind star click
    el.emailListContainer.querySelectorAll('[data-star-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-star-id');
        const mail = displayList.find(m => m.id === id);
        if (mail) {
          mail.isStarred = !mail.isStarred;
          btn.classList.toggle('starred', mail.isStarred);
          btn.innerHTML = mail.isStarred ? ICONS.starFilled : ICONS.star;
        }
      });
    });

    // Bind delete click
    el.emailListContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const idx = liveMessages.findIndex(m => m.id === id);
        if (idx !== -1) {
          liveMessages.splice(idx, 1);
          renderEmailList();
          showToast('Conversation moved to Trash');
        }
      });
    });
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

    if (mail.bodyHtml) {
      el.readingBodyContent.innerHTML = mail.bodyHtml;
      return;
    }

    // Fetch full message body and attachments from GoDaddy server
    el.readingBodyContent.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #5F6368;">
        <i data-lucide="loader" style="width: 28px; height: 28px; animation: spin 1s linear infinite; margin-bottom: 8px;"></i>
        <p style="font-size: 14px;">Loading message content from GoDaddy mailbox...</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();

    try {
      const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
      const headers = {};
      if (activeToken) headers['Authorization'] = 'Bearer ' + activeToken;
      if (mailboxCreds) headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));

      const res = await fetch(`/api/mail/messages/${mail.id}?folder=${encodeURIComponent(currentFolder)}`, { headers });
      const data = await res.json();

      if (data.success && data.message) {
        mail.bodyHtml = data.message.html || `<div style="white-space: pre-wrap; font-family: Roboto, sans-serif; font-size: 14px; line-height: 1.6;">${escapeHtml(data.message.text || mail.snippet)}</div>`;
        el.readingBodyContent.innerHTML = mail.bodyHtml;

        // Render attachments if present
        if (data.message.attachments && data.message.attachments.length > 0) {
          const attHtml = `
            <div style="margin-top: 28px; border-top: 1px solid #DADCE0; padding-top: 16px;">
              <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="paperclip" style="width: 15px; height: 15px;"></i>
                <span>Attachments (${data.message.attachments.length})</span>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${data.message.attachments.map(att => `
                  <a href="${att.downloadUrl}${activeToken ? '?token=' + activeToken : ''}" target="_blank" download="${escapeHtml(att.filename)}" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #DADCE0; border-radius: 6px; padding: 8px 14px; background: #FAFAFA; color: #1A73E8; font-size: 13px;">
                    <i data-lucide="file" style="width: 14px; height: 14px;"></i>
                    <span style="font-weight: 500;">${escapeHtml(att.filename)}</span>
                    <span style="color: #70757A; font-size: 11px;">(${Math.round(att.size / 1024)} KB)</span>
                  </a>
                `).join('')}
              </div>
            </div>
          `;
          el.readingBodyContent.insertAdjacentHTML('beforeend', attHtml);
          if (window.lucide) window.lucide.createIcons();
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

  // Fetch Live Messages via GoDaddy IMAP API
  async function fetchLiveInbox() {
    try {
      const activeToken = localStorage.getItem('puvima_mail_token') || localStorage.getItem('puvima_admin_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      if (activeToken) {
        headers['Authorization'] = 'Bearer ' + activeToken;
      }
      if (mailboxCreds) {
        headers['x-mailbox-auth'] = btoa(JSON.stringify(mailboxCreds));
      }

      const res = await fetch(`/api/mail/messages?folder=${encodeURIComponent(currentFolder)}&limit=50`, { headers });
      const data = await res.json();

      if (data.success) {
        isConnectedLive = true;
        if (data.messages && data.messages.length > 0) {
          liveMessages = data.messages.map(m => {
            const fromAddr = (m.from && m.from.address ? m.from.address : '').toLowerCase();
            let senderName = (m.from && m.from.name ? m.from.name : m.from?.address) || 'Unknown';

            // Format sender display name
            if (currentFolder === 'Sent' && m.to && m.to.length > 0) {
              const toRecipient = m.to[0].name || m.to[0].address || 'Recipient';
              senderName = `To: ${toRecipient}`;
            } else if (userEmail && fromAddr === userEmail.toLowerCase()) {
              senderName = 'me';
            } else if (fromAddr.includes('admin@puvima.com') || senderName.toLowerCase() === 'admin') {
              senderName = 'Principal Consultant';
            } else if (fromAddr.includes('contact@puvima.com')) {
              senderName = 'PUVIMA';
            }

            return {
              id: String(m.uid),
              sender: senderName,
              email: m.from ? m.from.address : '',
              subject: m.subject || '(No Subject)',
              snippet: m.subject || '',
              date: new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
              isUnread: !m.isRead,
              isStarred: m.isStarred,
              tab: 'primary'
            };
          });
        } else {
          liveMessages = [];
        }
        renderEmailList();
      }
    } catch (e) {
      console.warn('Live IMAP sync error:', e);
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
    el.dockAttachmentsList.innerHTML = attachedFiles.map((f, i) => {
      const isPdf = f.name.toLowerCase().endsWith('.pdf');
      const isImg = f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
      const iconSvg = isPdf ? ICONS.fileText : (isImg ? ICONS.image : ICONS.paperclip);
      const iconColor = isPdf ? '#D93025' : (isImg ? '#1E8E3E' : '#1A73E8');
      const sizeStr = f.size > 1024 * 1024
        ? (f.size / (1024 * 1024)).toFixed(1) + ' MB'
        : Math.max(1, Math.round(f.size / 1024)) + ' KB';

      return `
        <div class="attachment-chip">
          <span style="color: ${iconColor}; display: inline-flex; align-items: center; transform: scale(0.9);">${iconSvg}</span>
          <span class="attachment-chip-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <span class="attachment-chip-size">(${sizeStr})</span>
          <button type="button" class="attachment-chip-remove" data-remove-idx="${i}" title="Remove file">${ICONS.close}</button>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    el.dockAttachmentsList.querySelectorAll('.attachment-chip-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-remove-idx'), 10);
        attachedFiles.splice(idx, 1);
        renderAttachmentsList();
      });
    });
  }

  function handleFilesAdded(files) {
    if (!files || files.length === 0) return;
    for (const file of files) {
      if (!attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
        attachedFiles.push(file);
      }
    }
    renderAttachmentsList();
  }

  // Handle Send from Floating Compose Dock
  async function handleSendDock(e) {
    e.preventDefault();

    const to = el.dockToInput.value.trim();
    const cc = el.dockCcInput ? el.dockCcInput.value.trim() : '';
    const bcc = el.dockBccInput ? el.dockBccInput.value.trim() : '';
    const subject = el.dockSubjectInput.value.trim();
    const body = el.dockBodyInput.value.trim();

    if (!to) {
      showToast('Please specify at least one recipient.');
      return;
    }

    el.btnSendDockMail.disabled = true;
    el.btnSendDockMail.innerHTML = '<span>Sending...</span>';

    try {
      const formData = new FormData();
      formData.append('to', to);
      if (cc) formData.append('cc', cc);
      if (bcc) formData.append('bcc', bcc);
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

      showToast('Message sent successfully!');
      el.composeForm.reset();
      attachedFiles = [];
      renderAttachmentsList();
      el.gmailComposeDock.classList.remove('active');
    } catch (err) {
      showToast('Error sending message: ' + err.message);
    } finally {
      el.btnSendDockMail.disabled = false;
      el.btnSendDockMail.innerHTML = '<span>Send</span><i data-lucide="send" style="width: 14px; height: 14px; margin-left: 2px;"></i>';
      if (window.lucide) window.lucide.createIcons();
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
    // Check session first: gates workspace or shows login screen
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
          ? 'Enter your GoDaddy email password for Principal Consultant (admin@puvima.com).'
          : 'Enter your GoDaddy email password for PUVIMA (contact@puvima.com).';
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

    // Attachment Triggers (PDF, Media, Documents, Photos)
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
        el.dockToInput.value = activeEmailData.email || activeEmailData.sender;
        el.dockSubjectInput.value = `Re: ${activeEmailData.subject}`;
        el.dockBodyInput.focus();
      });
    }

    if (el.btnReadingForward) {
      el.btnReadingForward.addEventListener('click', () => {
        if (!activeEmailData) return;
        el.gmailComposeDock.classList.add('active');
        el.dockSubjectInput.value = `Fwd: ${activeEmailData.subject}`;
        el.dockBodyInput.value = `\n\n---------- Forwarded message ---------\nFrom: ${activeEmailData.sender}\nSubject: ${activeEmailData.subject}\n`;
        el.dockToInput.focus();
      });
    }

    if (el.btnReadingDelete) {
      el.btnReadingDelete.addEventListener('click', () => {
        if (activeEmailData) {
          const idx = liveMessages.findIndex(m => m.id === activeEmailData.id);
          if (idx !== -1) liveMessages.splice(idx, 1);
          showToast('Conversation moved to Trash');
          backToInbox();
        }
      });
    }

    // Sidebar Folder Clicks: Only buttons with data-folder attribute
    document.querySelectorAll('.folder-row[data-folder]').forEach(row => {
      row.addEventListener('click', () => {
        document.querySelectorAll('.folder-row[data-folder]').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        currentFolder = row.getAttribute('data-folder') || 'INBOX';

        // Exit reading view if open
        if (el.readingViewPane) el.readingViewPane.style.display = 'none';
        if (el.emailListContainer) el.emailListContainer.style.display = 'block';

        if (isConnectedLive) {
          fetchLiveInbox();
        }
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
        if (window.lucide) window.lucide.createIcons();
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
        if (el.readingViewPane) el.readingViewPane.style.display = 'none';
        if (el.emailListContainer) el.emailListContainer.style.display = 'block';
        if (isConnectedLive) fetchLiveInbox();
      });
    }

    // Refresh button
    if (el.btnRefreshInbox) {
      el.btnRefreshInbox.addEventListener('click', () => {
        showToast('Checking for new mail...');
        if (isConnectedLive) fetchLiveInbox();
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
        document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = checked);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
