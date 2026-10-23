-- ============================================================================
-- PUVIMA Consultancy — Supabase PostgreSQL Schema
-- Project: jarrtmqdhfcijarbuntl
-- Run this in Supabase Dashboard -> SQL Editor (https://supabase.com/dashboard/project/jarrtmqdhfcijarbuntl/sql)
-- ============================================================================

-- 1. Contact Enquiries Table
CREATE TABLE IF NOT EXISTS public.contact_enquiries (
  id BIGSERIAL PRIMARY KEY,
  reference_id VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(128),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new', -- 'new', 'in_review', 'responded', 'archived'
  ip_hash VARCHAR(64),
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_email ON public.contact_enquiries(email);
CREATE INDEX IF NOT EXISTS idx_contact_status ON public.contact_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_contact_created_at ON public.contact_enquiries(created_at DESC);

-- 2. Consultation Bookings Table
CREATE TABLE IF NOT EXISTS public.consultation_bookings (
  id BIGSERIAL PRIMARY KEY,
  reference_id VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(255) NOT NULL,
  company VARCHAR(128),
  topic VARCHAR(255) NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time VARCHAR(64) NOT NULL,
  meeting_format VARCHAR(64) NOT NULL DEFAULT 'Virtual Video Session (Zoom / Meet)',
  message TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review', -- 'pending_review', 'under_evaluation', 'confirmed', 'cancelled', 'completed'
  ip_hash VARCHAR(64),
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_email ON public.consultation_bookings(email);
CREATE INDEX IF NOT EXISTS idx_booking_status ON public.consultation_bookings(status);
CREATE INDEX IF NOT EXISTS idx_booking_date ON public.consultation_bookings(preferred_date);

-- 3. Customer Reviews Table
CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id BIGSERIAL PRIMARY KEY,
  reference_id VARCHAR(64) UNIQUE,
  name VARCHAR(128) NOT NULL,
  role VARCHAR(128),
  company VARCHAR(128),
  rating SMALLINT NOT NULL DEFAULT 5,
  review_text TEXT NOT NULL,
  source VARCHAR(64) DEFAULT 'PUVIMA Portal',
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_status ON public.customer_reviews(status);

-- 4. Site Settings Table (Key-Value / JSONB Store)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id VARCHAR(64) PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert Default Site Settings
INSERT INTO public.site_settings (id, data, updated_at)
VALUES (
  'main_page',
  '{
    "announcement": { "enabled": false, "badge": "", "text": "", "linkText": "", "linkUrl": "" },
    "hero": {
      "headlineMain": "Innovation.",
      "headlineGradient": "Research. Excellence.",
      "subhead": "PUVIMA Consultancy transforms innovative ideas into impactful solutions. We specialize in technical project development, IT solutions, data analytics, and research support, delivering quality-driven services through innovation, expertise, and collaboration."
    },
    "contact": {
      "email": "advisory@puvima.com",
      "phone": "+91 (0) 44 2810 5000",
      "hours": "Mon – Fri: 09:00 – 18:00 IST",
      "location": "Chennai & Bangalore, India"
    },
    "stats": {
      "consultationsDelivered": "120+",
      "activePrototypes": "18",
      "researchDomains": "4",
      "clientSatisfaction": "99.4%"
    },
    "careersFormUrl": ""
  }'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Public Read Site Settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow All on Site Settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public Insert Enquiries" ON public.contact_enquiries;
DROP POLICY IF EXISTS "Allow All on Contact Enquiries" ON public.contact_enquiries;
DROP POLICY IF EXISTS "Public Insert Bookings" ON public.consultation_bookings;
DROP POLICY IF EXISTS "Allow All on Consultation Bookings" ON public.consultation_bookings;
DROP POLICY IF EXISTS "Public Read Approved Reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Public Insert Reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Allow All on Reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Service Role Full Access Enquiries" ON public.contact_enquiries;
DROP POLICY IF EXISTS "Service Role Full Access Bookings" ON public.consultation_bookings;
DROP POLICY IF EXISTS "Service Role Full Access Reviews" ON public.customer_reviews;
DROP POLICY IF EXISTS "Service Role Full Access Settings" ON public.site_settings;

-- Site Settings: Full access so live admin modifications & reading work seamlessly
CREATE POLICY "Allow All on Site Settings" ON public.site_settings
  FOR ALL USING (true) WITH CHECK (true);

-- Contact Enquiries: Full access for client submissions and admin reviews
CREATE POLICY "Allow All on Contact Enquiries" ON public.contact_enquiries
  FOR ALL USING (true) WITH CHECK (true);

-- Consultation Bookings: Full access for client booking and admin workflow
CREATE POLICY "Allow All on Consultation Bookings" ON public.consultation_bookings
  FOR ALL USING (true) WITH CHECK (true);

-- Customer Reviews: Full access for reading and submissions
CREATE POLICY "Allow All on Reviews" ON public.customer_reviews
  FOR ALL USING (true) WITH CHECK (true);
