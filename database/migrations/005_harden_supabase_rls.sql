-- ============================================================================
-- PUVIMA Consultancy — Migration 005: Supabase RLS Policy Hardening
-- Remediates Critical Over-Permission Vulnerability (CWE-284 / OWASP A01:2021)
-- Replaces "FOR ALL USING (true)" with strict least-privilege role policies
-- ============================================================================

-- Enable Row Level Security (RLS) on all public tables
ALTER TABLE IF EXISTS public.contact_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.consultation_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.site_settings ENABLE ROW LEVEL SECURITY;

-- 1. Drop overly permissive wildcard policies
DROP POLICY IF EXISTS "Allow All on Site Settings" ON public.site_settings;
DROP POLICY IF EXISTS "Allow All on Contact Enquiries" ON public.contact_enquiries;
DROP POLICY IF EXISTS "Allow All on Consultation Bookings" ON public.consultation_bookings;
DROP POLICY IF EXISTS "Allow All on Reviews" ON public.customer_reviews;

-- 2. Contact Enquiries:
-- Unauthenticated public clients may only INSERT new enquiries.
-- Reading, updating, or deleting requires authenticated backend service role.
DROP POLICY IF EXISTS "Public Can Only Submit Contact Enquiries" ON public.contact_enquiries;
CREATE POLICY "Public Can Only Submit Contact Enquiries" ON public.contact_enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Contact Enquiries" ON public.contact_enquiries;
CREATE POLICY "Service Role Full Access Contact Enquiries" ON public.contact_enquiries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Consultation Bookings:
-- Unauthenticated public clients may only INSERT new consultation booking requests.
-- Reading, rescheduling, confirming, or deleting requires service role.
DROP POLICY IF EXISTS "Public Can Only Submit Bookings" ON public.consultation_bookings;
CREATE POLICY "Public Can Only Submit Bookings" ON public.consultation_bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service Role Full Access Consultation Bookings" ON public.consultation_bookings;
CREATE POLICY "Service Role Full Access Consultation Bookings" ON public.consultation_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Customer Reviews:
-- Public visitors may only READ approved reviews.
-- Public visitors may submit new reviews in pending state.
-- Review moderation (approve/reject/edit/delete) is restricted to service role.
DROP POLICY IF EXISTS "Public Can Read Approved Reviews Only" ON public.customer_reviews;
CREATE POLICY "Public Can Read Approved Reviews Only" ON public.customer_reviews
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "Public Can Submit Pending Review" ON public.customer_reviews;
CREATE POLICY "Public Can Submit Pending Review" ON public.customer_reviews
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending' OR status IS NULL);

DROP POLICY IF EXISTS "Service Role Full Access Customer Reviews" ON public.customer_reviews;
CREATE POLICY "Service Role Full Access Customer Reviews" ON public.customer_reviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Site Settings:
-- Public visitors have read-only access to published site configuration.
-- Mutations (updating hero, announcements, contact info) restricted to service role.
DROP POLICY IF EXISTS "Public Read Only Site Settings" ON public.site_settings;
CREATE POLICY "Public Read Only Site Settings" ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service Role Full Access Site Settings" ON public.site_settings;
CREATE POLICY "Service Role Full Access Site Settings" ON public.site_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

