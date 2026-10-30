/**
 * PUVIMA Consultancy — Notification Center Service
 * Real-time updates, alerts, and unread counts
 */

const NotificationService = (function () {
  const STORE_KEY = 'puvima_portal_notifications';

  function getLocalNotifications() {
    try {
      const data = localStorage.getItem(STORE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalNotifications(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }

  async function getNotifications(userId) {
    const list = getLocalNotifications();
    return list.filter((n) => !userId || n.user_id === userId);
  }

  async function getUnreadCount(userId) {
    const list = await getNotifications(userId);
    return list.filter((n) => !n.is_read).length;
  }

  async function markAsRead(id) {
    const list = getLocalNotifications();
    const item = list.find((n) => n.id === id);
    if (item) {
      item.is_read = true;
      item.read_at = new Date().toISOString();
      saveLocalNotifications(list);
    }
    return true;
  }

  async function markAllAsRead(userId) {
    const list = getLocalNotifications();
    list.forEach((n) => {
      if (!userId || n.user_id === userId) {
        n.is_read = true;
        n.read_at = new Date().toISOString();
      }
    });
    saveLocalNotifications(list);
    return true;
  }

  return {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
  };
})();

if (typeof window !== 'undefined') {
  window.NotificationService = NotificationService;
}
