/**
 * PUVIMA Consultancy — Storage & Settings Service
 * Handles resilient persistence for contact enquiries, bookings, and live main-page settings.
 * Supports MySQL database with graceful local JSON fallback when MySQL is inactive.
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

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
  }
};

class StoreService {
  constructor() {
    this.ensureDataDir();
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
    // 1. Try MySQL if connected
    let dbSuccess = false;
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
    // Attempt DB first
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

    // Fallback to local file
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
    // Update local file
    const submissions = this.readSubmissionsFile();
    const contact = submissions.contacts.find(c => String(c.id) === String(id) || c.reference_id === id);
    if (contact) {
      if (status) contact.status = status;
      if (admin_notes !== undefined) contact.admin_notes = admin_notes;
      contact.updated_at = new Date().toISOString();
      this.writeSubmissionsFile(submissions);
    }

    // Try DB
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

    return contact;
  }

  async deleteContact(id) {
    const submissions = this.readSubmissionsFile();
    const index = submissions.contacts.findIndex(c => String(c.id) === String(id) || c.reference_id === id);
    if (index !== -1) {
      submissions.contacts.splice(index, 1);
      this.writeSubmissionsFile(submissions);
    }
    try {
      await db.query(`DELETE FROM contact_enquiries WHERE id = ? OR reference_id = ?`, [id, id]);
    } catch (e) {}
    return true;
  }

  // --- BOOKINGS ---
  async addBooking(data) {
    let dbSuccess = false;
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
    const submissions = this.readSubmissionsFile();
    const booking = submissions.bookings.find(b => String(b.id) === String(id) || b.reference_id === id);
    if (booking) {
      if (status) booking.status = status;
      if (admin_notes !== undefined) booking.admin_notes = admin_notes;
      if (preferred_date) booking.preferred_date = preferred_date;
      if (preferred_time) booking.preferred_time = preferred_time;
      booking.updated_at = new Date().toISOString();
      this.writeSubmissionsFile(submissions);
    }

    try {
      if (status) {
        await db.query(
          `UPDATE consultation_bookings SET status = ? WHERE id = ? OR reference_id = ?`,
          [status, id, id]
        );
      }
    } catch (e) {}

    return booking;
  }

  async deleteBooking(id) {
    const submissions = this.readSubmissionsFile();
    const index = submissions.bookings.findIndex(b => String(b.id) === String(id) || b.reference_id === id);
    if (index !== -1) {
      submissions.bookings.splice(index, 1);
      this.writeSubmissionsFile(submissions);
    }
    try {
      await db.query(`DELETE FROM consultation_bookings WHERE id = ? OR reference_id = ?`, [id, id]);
    } catch (e) {}
    return true;
  }

  // --- SITE SETTINGS ---
  getSettings() {
    this.ensureDataDir();
    try {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  updateSettings(newSettings) {
    this.ensureDataDir();
    const current = this.getSettings();
    const merged = {
      ...current,
      ...newSettings,
      announcement: { ...current.announcement, ...(newSettings.announcement || {}) },
      hero: { ...current.hero, ...(newSettings.hero || {}) },
      contact: { ...current.contact, ...(newSettings.contact || {}) },
      stats: { ...current.stats, ...(newSettings.stats || {}) }
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  // --- REVIEWS MANAGEMENT ---
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
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    const date_display = `${now.getDate()} ${months[now.getMonth()]}, ${hrs}:${mins} ${ampm}`;

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
      status: 'pending', // Starts pending until approved by admin
      created_at: now.toISOString()
    };

    list.unshift(newReview);
    this.writeReviewsFile(list);
    return newReview;
  }

  async updateReviewStatus(id, { status }) {
    const list = this.readReviewsFile();
    const review = list.find(r => String(r.id) === String(id) || r.reference_id === id);
    if (review) {
      if (status) review.status = status;
      review.updated_at = new Date().toISOString();
      this.writeReviewsFile(list);
    }
    return review;
  }

  async deleteReview(id) {
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
    try {
      const res = await db.testConnection();
      dbHealthy = res.isConnected;
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
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new StoreService();
