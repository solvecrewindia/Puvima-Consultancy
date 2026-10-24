/**
 * PUVIMA Consultancy — Storage & Settings Service
 * Handles resilient persistence for contact enquiries, bookings, and live main-page settings.
 * Supports MySQL database with graceful local JSON fallback when MySQL is inactive.
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const supabase = require('../config/supabase');

const DATA_DIR = path.resolve(__dirname, '../../data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'site-settings.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

const DEFAULT_SETTINGS = {
  announcement: {
    enabled: false,
    badge: '',
    text: '',
    linkText: '',
    linkUrl: ''
  },
  hero: {
    headlineMain: 'Innovation.',
    headlineGradient: 'Research. Excellence.',
    subhead: 'PUVIMA Consultancy transforms innovative ideas into impactful solutions. We specialize in technical project development, IT solutions, data analytics, and research support, delivering quality-driven services through innovation, expertise, and collaboration.'
  },
  contact: {
    email: 'advisory@puvima.com',
    phone: '+91 (0) 44 2810 5000',
    hours: 'Mon – Fri: 09:00 – 18:00 IST',
    location: 'Chennai & Bangalore, India'
  },
  stats: {
    consultationsDelivered: '120+',
    activePrototypes: '18',
    researchDomains: '4',
    clientSatisfaction: '99.4%'
  },
  careersFormUrl: ''
};

class StoreService {
  constructor() {
    this.ensureDataDir();
    // Asynchronously warm-up / sync settings from Supabase
    setTimeout(() => {
      this.syncSettingsFromSupabase().catch(() => {});
    }, 100);
  }

  async syncSettingsFromSupabase() {
    const sb = supabase.getSupabaseClient();
    if (!sb) return;
    try {
      const { data, error } = await sb.from('site_settings').select('data').eq('id', 'main_page').single();
      if (!error && data && data.data) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data.data, null, 2), 'utf8');
      }
    } catch (e) {}
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(SUBMISSIONS_FILE)) {
      const initial = {
        contacts: [
          {
            id: 1,
            reference_id: 'CNT-2026-SAMPLE',
            name: 'Kavitha Raman',
            email: 'kavitha.raman@nexuslabs.io',
            company: 'Nexus Robotics Labs',
            subject: 'Autonomous Navigation Advisory',
            message: 'We are developing an AMR for logistics and need specialized sensor fusion and SLAM advisory assistance.',
            status: 'new',
            ip_hash: 'sample_hash_01',
            admin_notes: 'High-priority enterprise enquiry regarding ROS2 integration.',
            created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
            updated_at: new Date(Date.now() - 3600000 * 4).toISOString()
          },
          {
            id: 2,
            reference_id: 'CNT-2026-SAMPLE2',
            name: 'David Chen',
            email: 'd.chen@apexquant.co',
            company: 'Apex Quantitative',
            subject: 'FinTech Algorithmic Models',
            message: 'Inquiring about your backtesting framework for options volatility surfaces and tick data ingestion pipelines.',
            status: 'in_review',
            ip_hash: 'sample_hash_02',
            admin_notes: 'Reviewed initial query. Scheduling call.',
            created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
            updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
          }
        ],
        bookings: [
          {
            id: 1,
            reference_id: 'REQ-2026-SAMPLE',
            name: 'Dr. Srinivas Rao',
            email: 'srinivas.rao@iit-madras.res.in',
            company: 'Department of Computing',
            topic: 'AI/ML & Research Solutions',
            preferred_date: '2026-11-05',
            preferred_time: '14:00 - 15:00 IST',
            meeting_format: 'Virtual Video Session (Zoom / Meet)',
            message: 'Discussion on edge model quantization and TensorRT deployment benchmarks.',
            status: 'pending_review',
            ip_hash: 'sample_hash_03',
            admin_notes: '',
            created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
            updated_at: new Date(Date.now() - 3600000 * 8).toISOString()
          }
        ]
      };
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(initial, null, 2), 'utf8');
    }
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
    }
  }

  readSubmissionsFile() {
    this.ensureDataDir();
    try {
      const content = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('[StoreService] Error reading submissions file:', e.message);
      return { contacts: [], bookings: [] };
    }
  }

  writeSubmissionsFile(data) {
    this.ensureDataDir();
    try {
      fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[StoreService] Error writing submissions file:', e.message);
    }
  }

  // --- CONTACTS ---
  async addContact(data) {
    // 1. Try Supabase cloud first if configured, else MySQL
    let dbSuccess = false;
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        const { error } = await sb.from('contact_enquiries').insert([{
          reference_id: data.reference_id,
          name: data.name,
          email: data.email,
          company: data.company || null,
          subject: data.subject || null,
          message: data.message,
          status: 'new',
          ip_hash: data.ip_hash || null
        }]);
        if (!error) dbSuccess = true;
      } catch (err) {}
    }

    if (!dbSuccess) {
      try {
        const sql = `
          INSERT INTO contact_enquiries (
            reference_id, name, email, company, subject, message, status, ip_hash
          ) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)
        `;
        const params = [
          data.reference_id,
          data.name,
          data.email,
          data.company || null,
          data.subject || null,
          data.message,
          data.ip_hash || null
        ];
        await db.query(sql, params);
        dbSuccess = true;
      } catch (err) {
        // MySQL unavailable or failed; will fallback to local file
      }
    }

    // 2. Always persist to local storage as well for guaranteed zero data loss
    const submissions = this.readSubmissionsFile();
    const newContact = {
      id: submissions.contacts.length ? Math.max(...submissions.contacts.map(c => c.id || 0)) + 1 : 1,
      reference_id: data.reference_id,
      name: data.name,
      email: data.email,
      company: data.company || null,
      subject: data.subject || null,
      message: data.message,
      status: 'new',
      ip_hash: data.ip_hash || null,
      admin_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persisted_in_db: dbSuccess
    };
    submissions.contacts.unshift(newContact);
    this.writeSubmissionsFile(submissions);

    return newContact;
  }

  async getContacts({ status, search } = {}) {
    // 1. Try Supabase cloud first
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        let query = sb.from('contact_enquiries').select('*').order('created_at', { ascending: false });
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          let list = data;
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(r => 
              (r.name && r.name.toLowerCase().includes(q)) ||
              (r.email && r.email.toLowerCase().includes(q)) ||
              (r.company && r.company.toLowerCase().includes(q)) ||
              (r.subject && r.subject.toLowerCase().includes(q)) ||
              (r.reference_id && r.reference_id.toLowerCase().includes(q))
            );
          }
          return list;
        }
      } catch (e) {
        // Fallback
      }
    }

    // 2. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = `SELECT * FROM contact_enquiries ORDER BY created_at DESC`;
        const [rows] = await db.query(sql);
        if (rows && rows.length > 0) {
          let list = rows;
          if (status && status !== 'all') {
            list = list.filter(r => r.status === status);
          }
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(r => 
              (r.name && r.name.toLowerCase().includes(q)) ||
              (r.email && r.email.toLowerCase().includes(q)) ||
              (r.company && r.company.toLowerCase().includes(q)) ||
              (r.subject && r.subject.toLowerCase().includes(q)) ||
              (r.reference_id && r.reference_id.toLowerCase().includes(q))
            );
          }
          return list;
        }
      }
    } catch (e) {
      // Fallback
    }

    // 3. Fallback to local file
    const submissions = this.readSubmissionsFile();
    let list = submissions.contacts;
    if (status && status !== 'all') {
      list = list.filter(r => r.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => 
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.company && r.company.toLowerCase().includes(q)) ||
        (r.subject && r.subject.toLowerCase().includes(q)) ||
        (r.reference_id && r.reference_id.toLowerCase().includes(q))
      );
    }
    return list;
  }

  async updateContactStatus(id, { status, admin_notes }) {
    let updatedContact = null;

    // 1. Update Supabase
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        const updatePayload = { updated_at: new Date().toISOString() };
        if (status) updatePayload.status = status;
        if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;

        let query = sb.from('contact_enquiries').update(updatePayload);
        if (/^\d+$/.test(String(id))) {
          query = query.or(`id.eq.${id},reference_id.eq.${id}`);
        } else {
          query = query.eq('reference_id', id);
        }
        const { data, error } = await query.select();
        if (!error && data && data.length > 0) {
          updatedContact = data[0];
        }
      } catch (e) {}
    }

    // 2. Try MySQL
    try {
      if (status) {
        await db.query(
          `UPDATE contact_enquiries SET status = ? WHERE id = ? OR reference_id = ?`,
          [status, id, id]
        );
      }
    } catch (e) {
      // Ignored if DB offline
    }

    // 3. Update local file
    const submissions = this.readSubmissionsFile();
    const contact = submissions.contacts.find(c => String(c.id) === String(id) || c.reference_id === id);
    if (contact) {
      if (status) contact.status = status;
      if (admin_notes !== undefined) contact.admin_notes = admin_notes;
      contact.updated_at = new Date().toISOString();
      this.writeSubmissionsFile(submissions);
      if (!updatedContact) updatedContact = contact;
    }

    return updatedContact || contact || { id, status, admin_notes };
  }

  async deleteContact(id) {
    // 1. Delete from Supabase
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        let query = sb.from('contact_enquiries').delete();
        if (/^\d+$/.test(String(id))) {
          query = query.or(`id.eq.${id},reference_id.eq.${id}`);
        } else {
          query = query.eq('reference_id', id);
        }
        await query;
      } catch (e) {}
    }

    // 2. Delete from MySQL
    try {
      await db.query(`DELETE FROM contact_enquiries WHERE id = ? OR reference_id = ?`, [id, id]);
    } catch (e) {}

    // 3. Delete from local file
    const submissions = this.readSubmissionsFile();
    const index = submissions.contacts.findIndex(c => String(c.id) === String(id) || c.reference_id === id);
    if (index !== -1) {
      submissions.contacts.splice(index, 1);
      this.writeSubmissionsFile(submissions);
    }
    return true;
  }

  // --- BOOKINGS ---
  async addBooking(data) {
    let dbSuccess = false;
    // 1. Try Supabase cloud first
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        const { error } = await sb.from('consultation_bookings').insert([{
          reference_id: data.reference_id,
          name: data.name,
          email: data.email,
          company: data.company || null,
          topic: data.topic,
          preferred_date: data.preferred_date || data.preferredDate,
          preferred_time: data.preferred_time || data.preferredTime,
          meeting_format: data.meeting_format || data.meetingFormat || 'Virtual Video Session (Zoom / Meet)',
          message: data.message || null,
          status: 'pending_review',
          ip_hash: data.ip_hash || null,
          admin_notes: ''
        }]);
        if (!error) dbSuccess = true;
      } catch (err) {}
    }

    if (!dbSuccess) {
      try {
        const sql = `
          INSERT INTO consultation_bookings (
            reference_id, name, email, company, topic,
            preferred_date, preferred_time, meeting_format,
            message, status, ip_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)
        `;
        const params = [
          data.reference_id,
          data.name,
          data.email,
          data.company || null,
          data.topic,
          data.preferred_date || data.preferredDate,
          data.preferred_time || data.preferredTime,
          data.meeting_format || data.meetingFormat || 'Virtual Video Session (Zoom / Meet)',
          data.message || null,
          data.ip_hash || null
        ];
        await db.query(sql, params);
        dbSuccess = true;
      } catch (err) {
        // MySQL unavailable; store locally
      }
    }

    const submissions = this.readSubmissionsFile();
    const newBooking = {
      id: submissions.bookings.length ? Math.max(...submissions.bookings.map(b => b.id || 0)) + 1 : 1,
      reference_id: data.reference_id,
      name: data.name,
      email: data.email,
      company: data.company || null,
      topic: data.topic,
      preferred_date: data.preferred_date || data.preferredDate,
      preferred_time: data.preferred_time || data.preferredTime,
      meeting_format: data.meeting_format || data.meetingFormat || 'Virtual Video Session (Zoom / Meet)',
      message: data.message || null,
      status: 'pending_review',
      ip_hash: data.ip_hash || null,
      admin_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      persisted_in_db: dbSuccess
    };
    submissions.bookings.unshift(newBooking);
    this.writeSubmissionsFile(submissions);

    return newBooking;
  }

  async getBookings({ status, search } = {}) {
    // 1. Try Supabase cloud first
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        let query = sb.from('consultation_bookings').select('*').order('created_at', { ascending: false });
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          let list = data;
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(r => 
              (r.name && r.name.toLowerCase().includes(q)) ||
              (r.email && r.email.toLowerCase().includes(q)) ||
              (r.company && r.company.toLowerCase().includes(q)) ||
              (r.topic && r.topic.toLowerCase().includes(q)) ||
              (r.reference_id && r.reference_id.toLowerCase().includes(q))
            );
          }
          return list;
        }
      } catch (e) {}
    }

    // 2. Try MySQL
    try {
      const dbStatus = await db.testConnection();
      if (dbStatus.isConnected) {
        let sql = `SELECT * FROM consultation_bookings ORDER BY created_at DESC`;
        const [rows] = await db.query(sql);
        if (rows && rows.length > 0) {
          let list = rows;
          if (status && status !== 'all') {
            list = list.filter(r => r.status === status);
          }
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(r => 
              (r.name && r.name.toLowerCase().includes(q)) ||
              (r.email && r.email.toLowerCase().includes(q)) ||
              (r.company && r.company.toLowerCase().includes(q)) ||
              (r.topic && r.topic.toLowerCase().includes(q)) ||
              (r.reference_id && r.reference_id.toLowerCase().includes(q))
            );
          }
          return list;
        }
      }
    } catch (e) {}

    // 3. Fallback to local file
    const submissions = this.readSubmissionsFile();
    let list = submissions.bookings;
    if (status && status !== 'all') {
      list = list.filter(r => r.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => 
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.company && r.company.toLowerCase().includes(q)) ||
        (r.topic && r.topic.toLowerCase().includes(q)) ||
        (r.reference_id && r.reference_id.toLowerCase().includes(q))
      );
    }
    return list;
  }

  async updateBookingStatus(id, { status, admin_notes, preferred_date, preferred_time }) {
    let updatedBooking = null;

    // 1. Update Supabase
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        const updatePayload = { updated_at: new Date().toISOString() };
        if (status) updatePayload.status = status;
        if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;
        if (preferred_date) updatePayload.preferred_date = preferred_date;
        if (preferred_time) updatePayload.preferred_time = preferred_time;

        let query = sb.from('consultation_bookings').update(updatePayload);
        if (/^\d+$/.test(String(id))) {
          query = query.or(`id.eq.${id},reference_id.eq.${id}`);
        } else {
          query = query.eq('reference_id', id);
        }
        const { data, error } = await query.select();
        if (!error && data && data.length > 0) {
          updatedBooking = data[0];
        }
      } catch (e) {}
    }

    // 2. Try MySQL
    try {
      if (status) {
        await db.query(
          `UPDATE consultation_bookings SET status = ? WHERE id = ? OR reference_id = ?`,
          [status, id, id]
        );
      }
    } catch (e) {}

    // 3. Update local file
    const submissions = this.readSubmissionsFile();
    const booking = submissions.bookings.find(b => String(b.id) === String(id) || b.reference_id === id);
    if (booking) {
      if (status) booking.status = status;
      if (admin_notes !== undefined) booking.admin_notes = admin_notes;
      if (preferred_date) booking.preferred_date = preferred_date;
      if (preferred_time) booking.preferred_time = preferred_time;
      booking.updated_at = new Date().toISOString();
      this.writeSubmissionsFile(submissions);
      if (!updatedBooking) updatedBooking = booking;
    }

    return updatedBooking || booking || { id, status };
  }

  async deleteBooking(id) {
    // 1. Delete from Supabase
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        let query = sb.from('consultation_bookings').delete();
        if (/^\d+$/.test(String(id))) {
          query = query.or(`id.eq.${id},reference_id.eq.${id}`);
        } else {
          query = query.eq('reference_id', id);
        }
        await query;
      } catch (e) {}
    }

    // 2. Delete from MySQL
    try {
      await db.query(`DELETE FROM consultation_bookings WHERE id = ? OR reference_id = ?`, [id, id]);
    } catch (e) {}

    // 3. Delete from local file
    const submissions = this.readSubmissionsFile();
    const index = submissions.bookings.findIndex(b => String(b.id) === String(id) || b.reference_id === id);
    if (index !== -1) {
      submissions.bookings.splice(index, 1);
      this.writeSubmissionsFile(submissions);
    }
    return true;
  }

  // --- SITE SETTINGS ---
  async getSettings() {
    this.ensureDataDir();
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('site_settings').select('data').eq('id', 'main_page').single();
        if (!error && data && data.data) {
          fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data.data, null, 2), 'utf8');
          return data.data;
        }
      } catch (e) {}
    }
    return this.getSettingsSync();
  }

  getSettingsSync() {
    this.ensureDataDir();
    try {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  async updateSettings(newSettings) {
    this.ensureDataDir();
    const current = await this.getSettings();
    const merged = {
      ...current,
      ...newSettings,
      announcement: { ...current.announcement, ...(newSettings.announcement || {}) },
      hero: { ...current.hero, ...(newSettings.hero || {}) },
      contact: { ...current.contact, ...(newSettings.contact || {}) },
      stats: { ...current.stats, ...(newSettings.stats || {}) },
      careersFormUrl: newSettings.careersFormUrl !== undefined
        ? String(newSettings.careersFormUrl).trim()
        : (newSettings.careers && newSettings.careers.formUrl !== undefined ? String(newSettings.careers.formUrl).trim() : (current.careersFormUrl || ''))
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');

    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('site_settings').upsert({
          id: 'main_page',
          data: merged,
          updated_at: new Date().toISOString()
        });
      } catch (e) {}
    }

    return merged;
  }

  // --- REVIEWS MANAGEMENT ---
  formatDisplayDate(isoString) {
    try {
      const d = new Date(isoString || Date.now());
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const hrs = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
      return `${d.getDate()} ${months[d.getMonth()]}, ${hrs}:${mins} ${ampm}`;
    } catch (e) {
      return '';
    }
  }

  readReviewsFile() {
    this.ensureDataDir();
    try {
      if (fs.existsSync(REVIEWS_FILE)) {
        return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('[StoreService] Error reading reviews file:', e.message);
    }
    return [];
  }

  writeReviewsFile(data) {
    this.ensureDataDir();
    try {
      fs.writeFileSync(REVIEWS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[StoreService] Error writing reviews file:', e.message);
    }
  }

  async getReviews({ status, search } = {}) {
    // 1. Try Supabase cloud first
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        let query = sb.from('customer_reviews').select('*').order('created_at', { ascending: false });
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          let list = data.map(r => ({
            id: r.id,
            reference_id: r.reference_id,
            name: r.name,
            company: r.company || r.role || '',
            date_display: this.formatDisplayDate(r.created_at),
            avatar_url: 'assets/images/team/member-1.svg',
            platform: r.source || 'google',
            rating: parseInt(r.rating, 10) || 5,
            review_text: r.review_text,
            status: r.status || 'pending',
            created_at: r.created_at,
            updated_at: r.updated_at
          }));
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(r =>
              (r.name && r.name.toLowerCase().includes(q)) ||
              (r.company && r.company.toLowerCase().includes(q)) ||
              (r.review_text && r.review_text.toLowerCase().includes(q)) ||
              (r.reference_id && r.reference_id.toLowerCase().includes(q))
            );
          }
          return list;
        }
      } catch (e) {}
    }

    // 2. Fallback to local file
    let list = this.readReviewsFile();

    if (status && status !== 'all') {
      list = list.filter(r => r.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.company && r.company.toLowerCase().includes(q)) ||
        (r.review_text && r.review_text.toLowerCase().includes(q)) ||
        (r.reference_id && r.reference_id.toLowerCase().includes(q))
      );
    }
    return list;
  }

  async addReview(data) {
    const list = this.readReviewsFile();
    const id = list.length ? Math.max(...list.map(r => r.id || 0)) + 1 : 1;
    const refCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const reference_id = `REV-2026-${refCode}`;

    const now = new Date();
    const date_display = this.formatDisplayDate(now);

    const newReview = {
      id,
      reference_id,
      name: data.name,
      company: data.company || null,
      date_display: data.date_display || date_display,
      avatar_url: data.avatar_url || 'assets/images/team/member-1.svg',
      platform: data.platform || 'google',
      rating: parseInt(data.rating, 10) || 5,
      review_text: data.review_text,
      status: data.status || 'pending',
      created_at: now.toISOString()
    };

    // 1. Try Supabase Cloud
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        await sb.from('customer_reviews').insert([{
          reference_id: newReview.reference_id,
          name: newReview.name,
          role: newReview.company || 'Client',
          company: newReview.company || 'Private Client',
          rating: newReview.rating,
          review_text: newReview.review_text,
          source: newReview.platform,
          status: newReview.status,
          featured: newReview.status === 'approved'
        }]);
      } catch (e) {}
    }

    // 2. Always persist locally
    list.unshift(newReview);
    this.writeReviewsFile(list);

    return newReview;
  }

  async updateReviewStatus(id, { status }) {
    // 1. Update Supabase
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        let query = sb.from('customer_reviews').update({
          status,
          featured: status === 'approved',
          updated_at: new Date().toISOString()
        });
        if (/^\d+$/.test(String(id))) {
          query = query.or(`id.eq.${id},reference_id.eq.${id}`);
        } else {
          query = query.eq('reference_id', id);
        }
        await query;
      } catch (e) {}
    }

    // 2. Update local file
    const list = this.readReviewsFile();
    const review = list.find(r => String(r.id) === String(id) || r.reference_id === id);
    if (review) {
      if (status) review.status = status;
      review.updated_at = new Date().toISOString();
      this.writeReviewsFile(list);
    }
    return review || { id, status };
  }

  async deleteReview(id) {
    // 1. Delete from Supabase
    const sb = supabase.getSupabaseClient();
    if (sb) {
      try {
        let query = sb.from('customer_reviews').delete();
        if (/^\d+$/.test(String(id))) {
          query = query.or(`id.eq.${id},reference_id.eq.${id}`);
        } else {
          query = query.eq('reference_id', id);
        }
        await query;
      } catch (e) {}
    }

    // 2. Delete from local file
    const list = this.readReviewsFile();
    const index = list.findIndex(r => String(r.id) === String(id) || r.reference_id === id);
    if (index !== -1) {
      list.splice(index, 1);
      this.writeReviewsFile(list);
    }
    return true;
  }

  // --- STATS OVERVIEW ---
  async getDashboardStats() {
    const contacts = await this.getContacts();
    const bookings = await this.getBookings();
    const reviews = await this.getReviews();

    let openPositions = 0;
    let totalPositions = 0;
    let totalApplications = 0;
    let pendingApplications = 0;

    try {
      const careersService = require('./careers.service');
      const positions = await careersService.getAllPositionsAdmin();
      const apps = await careersService.getApplicationsAdmin();
      totalPositions = positions.length;
      openPositions = positions.filter(p => p.status === 'published').length;
      totalApplications = apps.total;
      pendingApplications = apps.applications.filter(a => a.recruitment_status === 'received').length;
    } catch (e) {}

    const newContacts = contacts.filter(c => c.status === 'new').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending_review').length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const pendingReviews = reviews.filter(r => r.status === 'pending').length;
    const approvedReviews = reviews.filter(r => r.status === 'approved').length;

    let dbHealthy = false;
    let dbProvider = 'file_fallback';

    try {
      const sbRes = await supabase.testConnection();
      if (sbRes.isConnected) {
        dbHealthy = true;
        dbProvider = 'supabase_postgres';
      } else {
        const res = await db.testConnection();
        if (res.isConnected) {
          dbHealthy = true;
          dbProvider = 'mysql';
        }
      }
    } catch (e) {}

    return {
      totalContacts: contacts.length,
      newContacts,
      totalBookings: bookings.length,
      pendingBookings,
      confirmedBookings,
      totalReviews: reviews.length,
      pendingReviews,
      approvedReviews,
      openPositions,
      totalPositions,
      totalApplications,
      pendingApplications,
      dbStatus: dbHealthy ? 'connected' : 'degraded_file_fallback',
      dbProvider,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new StoreService();
