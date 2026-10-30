/**
 * PUVIMA Consultancy — Project Timeline & Discussion Service
 * Threaded entries, attachments, and staff-only notes
 */

const TimelineService = (function () {
  const STORE_KEY = 'puvima_portal_timelines';

  function getLocalEntries() {
    try {
      const data = localStorage.getItem(STORE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalEntries(entries) {
    localStorage.setItem(STORE_KEY, JSON.stringify(entries));
  }

  async function getTimelineEntries(projectId, timelineType = 'Main') {
    const list = getLocalEntries();
    return list.filter(
      (e) =>
        e.project_id === projectId &&
        String(e.timeline_type).toLowerCase() === String(timelineType).toLowerCase()
    );
  }

  async function addEntry(data) {
    const entries = getLocalEntries();
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;

    const newEntry = {
      id: 'entry-' + Date.now(),
      project_id: data.projectId,
      timeline_type: data.timelineType || 'Main',
      user_id: currentUser ? currentUser.id : 'usr-emp-1',
      content: data.content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      replies: [],
    };

    entries.unshift(newEntry);
    saveLocalEntries(entries);
    return newEntry;
  }

  async function addReply(entryId, content) {
    const entries = getLocalEntries();
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    const entry = entries.find((e) => e.id === entryId);

    if (!entry) throw new Error('Timeline entry not found.');

    if (!Array.isArray(entry.replies)) {
      entry.replies = [];
    }

    const reply = {
      id: 'rep-' + Date.now(),
      user_id: currentUser ? currentUser.id : 'usr-emp-1',
      content: content.trim(),
      created_at: new Date().toISOString(),
    };

    entry.replies.push(reply);
    saveLocalEntries(entries);
    return reply;
  }

  async function deleteEntry(entryId) {
    let entries = getLocalEntries();
    entries = entries.filter((e) => e.id !== entryId);
    saveLocalEntries(entries);
    return true;
  }

  return {
    getTimelineEntries,
    addEntry,
    addReply,
    deleteEntry,
  };
})();

if (typeof window !== 'undefined') {
  window.TimelineService = TimelineService;
}
