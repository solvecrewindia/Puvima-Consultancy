/**
 * PUVIMA Consultancy — Common Portal Layout Controller
 * Handles sidebar, user session headers, and notifications
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;

  // Render User Info in Header & Sidebar if elements exist
  if (currentUser) {
    document.querySelectorAll('.current-user-name').forEach((el) => {
      el.textContent = currentUser.name || currentUser.userId || 'User';
    });

    document.querySelectorAll('.current-user-role').forEach((el) => {
      el.textContent = currentUser.role || 'Member';
    });

    document.querySelectorAll('.current-user-avatar').forEach((el) => {
      el.textContent = window.UI ? window.UI.getInitials(currentUser.name) : 'U';
    });

    document.querySelectorAll('.current-user-code').forEach((el) => {
      el.textContent = currentUser.user_code || currentUser.userId || '—';
    });
  }

  // Mobile navigation drawer toggle
  const mobileToggle = document.getElementById('mobileNavToggle');
  const sidebar = document.querySelector('.portal-sidebar');
  let backdrop = document.getElementById('sidebarBackdrop');

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebarBackdrop';
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('show');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    });
  }

  // Active Navigation link highlighting
  const currentPath = window.location.pathname.toLowerCase();
  document.querySelectorAll('.nav-item').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && currentPath.endsWith(href.toLowerCase())) {
      link.classList.add('active');
    }
  });

  // Logout Buttons
  document.querySelectorAll('[data-logout-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Are you sure you want to sign out from the PUVIMA Executive Portal?')) {
        window.Auth.logout();
      }
    });
  });

  // Notification Bell Handler & Unread Counter
  const notifBtn = document.getElementById('notificationBellBtn');
  const notifBadge = document.getElementById('notificationBadgeDot');

  async function updateNotifications() {
    if (currentUser && window.NotificationService) {
      const count = await window.NotificationService.getUnreadCount(currentUser.id);
      if (notifBadge) {
        notifBadge.style.display = count > 0 ? 'block' : 'none';
      }
    }
  }

  updateNotifications();

  if (notifBtn) {
    notifBtn.addEventListener('click', async () => {
      if (!currentUser || !window.NotificationService) return;
      const notifs = await window.NotificationService.getNotifications(currentUser.id);

      const listContainer = document.getElementById('notificationsList');
      if (listContainer) {
        if (notifs.length === 0) {
          listContainer.innerHTML = `
            <div class="empty-state" style="padding: 24px;">
              <div class="empty-state-title">No Notifications</div>
              <div class="empty-state-desc">You are all caught up!</div>
            </div>
          `;
        } else {
          listContainer.innerHTML = notifs
            .map(
              (n) => `
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); background: ${
              n.is_read ? 'transparent' : 'var(--bg-surface-active)'
            }">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                <strong style="font-size: 13px; color: var(--text-main);">${window.UI.escapeHtml(
                  n.title
                )}</strong>
                <span style="font-size: 11px; color: var(--text-dim);">${window.UI.formatDate(
                  n.created_at
                )}</span>
              </div>
              <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">${window.UI.escapeHtml(
                n.message
              )}</p>
            </div>
          `
            )
            .join('');

          // Mark all as read
          await window.NotificationService.markAllAsRead(currentUser.id);
          if (notifBadge) notifBadge.style.display = 'none';
        }
      }

      if (window.UI) {
        window.UI.openModal('notificationsModal');
      }
    });
  }
});
