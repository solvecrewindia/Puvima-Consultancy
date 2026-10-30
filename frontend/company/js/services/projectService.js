/**
 * PUVIMA Consultancy — Project Management Service
 * Handles project creation, team assignments, reviews, and lifecycles
 */

const ProjectService = (function () {
  const STORE_KEY = 'puvima_portal_projects';

  function getLocalProjects() {
    try {
      const data = localStorage.getItem(STORE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalProjects(projects) {
    localStorage.setItem(STORE_KEY, JSON.stringify(projects));
  }

  async function getProjects(options = {}) {
    const { status, category, search, userId } = options;

    if (window.portalClient && window.portalClient.supabase) {
      try {
        let q = window.portalClient.supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (status) {
          if (Array.isArray(status)) {
            q = q.in('status', status);
          } else {
            q = q.eq('status', status);
          }
        }

        if (category) {
          q = q.eq('category', category);
        }

        if (search && search.trim()) {
          q = q.ilike('name', `%${search.trim()}%`);
        }

        const { data, error } = await q;
        if (!error && data && data.length > 0) {
          return data;
        }
      } catch (e) {
        console.warn('[ProjectService] Supabase error, using local data:', e);
      }
    }

    // Local Store Filtering
    let list = getLocalProjects();

    if (status) {
      if (Array.isArray(status)) {
        const low = status.map((s) => String(s).toLowerCase());
        list = list.filter((p) => low.includes(String(p.status).toLowerCase()));
      } else {
        list = list.filter((p) => String(p.status).toLowerCase() === String(status).toLowerCase());
      }
    }

    if (category) {
      list = list.filter((p) => String(p.category).toLowerCase() === String(category).toLowerCase());
    }

    if (userId) {
      list = list.filter(
        (p) =>
          p.lead_id === userId ||
          (p.members && p.members.includes(userId)) ||
          p.created_by === userId
      );
    }

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(s)) ||
          (p.description && p.description.toLowerCase().includes(s))
      );
    }

    return list;
  }

  async function getProjectById(id) {
    const projects = await getProjects();
    return projects.find((p) => p.id === id) || null;
  }

  async function createProject(data) {
    const projects = getLocalProjects();
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;

    const newProject = {
      id: 'proj-' + Date.now(),
      name: data.name.trim(),
      category: data.category || 'Main Project',
      description: data.description || '',
      status: data.publishImmediately ? 'Published' : 'Draft',
      lead_id: data.leadId || null,
      created_by: currentUser ? currentUser.id : 'usr-hr-1',
      published_by: data.publishImmediately ? (currentUser ? currentUser.id : 'usr-hr-1') : null,
      published_at: data.publishImmediately ? new Date().toISOString() : null,
      start_date: data.startDate || new Date().toISOString().split('T')[0],
      due_date: data.dueDate || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members: Array.isArray(data.memberIds) ? data.memberIds : [],
    };

    // Try Supabase insert
    if (window.portalClient && window.portalClient.supabase) {
      try {
        await window.portalClient.supabase.from('projects').insert([newProject]);
      } catch (e) {
        console.warn('[ProjectService] Supabase insert failed, saved to local cache:', e);
      }
    }

    projects.unshift(newProject);
    saveLocalProjects(projects);
    return newProject;
  }

  async function updateProject(id, updates) {
    const projects = getLocalProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Project not found.');

    projects[idx] = {
      ...projects[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    saveLocalProjects(projects);
    return projects[idx];
  }

  async function publishProject(id) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    return updateProject(id, {
      status: 'Published',
      published_by: currentUser ? currentUser.id : 'usr-hr-1',
      published_at: new Date().toISOString(),
    });
  }

  async function completeProject(id) {
    return updateProject(id, {
      status: 'Completed',
      completed_at: new Date().toISOString(),
    });
  }

  return {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    publishProject,
    completeProject,
  };
})();

if (typeof window !== 'undefined') {
  window.ProjectService = ProjectService;
}
