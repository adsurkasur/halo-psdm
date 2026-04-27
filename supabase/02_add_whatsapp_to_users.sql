-- Migration: Add WhatsApp number to users table
-- This allows both Members and Admins to have a unified WhatsApp field.

ALTER TABLE public.users
ADD COLUMN whatsapp text;

-- Optional: Sync existing wa_number from admin_profiles to users table for Admins
UPDATE public.users u
SET whatsapp = ap.wa_number
FROM public.admin_profiles ap
WHERE u.id = ap.user_id;
