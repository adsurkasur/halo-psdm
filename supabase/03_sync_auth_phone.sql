-- Migration: Populate and automatically sync WhatsApp number to Supabase Auth native phone column
-- This script handles duplicate WhatsApp numbers gracefully without violating unique constraints.

-- 1. Populate native `phone` column in `auth.users` for the earliest user of each distinct `whatsapp` number
UPDATE auth.users au
SET phone = u.whatsapp
FROM (
  SELECT DISTINCT ON (whatsapp) id, whatsapp
  FROM public.users
  WHERE whatsapp IS NOT NULL
    AND whatsapp <> ''
  ORDER BY whatsapp, created_at ASC
) u
WHERE au.id = u.id
  AND (au.phone IS NULL OR au.phone <> u.whatsapp)
  AND NOT EXISTS (
    SELECT 1 FROM auth.users au2
    WHERE au2.phone = u.whatsapp AND au2.id <> au.id
  );

-- 2. Create a Database Trigger Function to automatically keep auth.users.phone updated when users.whatsapp changes
CREATE OR REPLACE FUNCTION public.sync_whatsapp_to_auth_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp <> '' AND (OLD IS NULL OR OLD.whatsapp IS DISTINCT FROM NEW.whatsapp) THEN
    BEGIN
      UPDATE auth.users
      SET phone = NEW.whatsapp
      WHERE id = NEW.id
        AND (phone IS NULL OR phone <> NEW.whatsapp)
        AND NOT EXISTS (
          SELECT 1 FROM auth.users WHERE phone = NEW.whatsapp AND id <> NEW.id
        );
    EXCEPTION WHEN unique_violation THEN
      -- Jika nomor WhatsApp sudah digunakan oleh user lain di auth.users, abaikan agar tidak melempar error
      RAISE NOTICE 'WhatsApp number % is already used in auth.users by another user.', NEW.whatsapp;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach the trigger to public.users table
DROP TRIGGER IF EXISTS trg_sync_whatsapp_to_auth_phone ON public.users;
CREATE TRIGGER trg_sync_whatsapp_to_auth_phone
AFTER INSERT OR UPDATE OF whatsapp ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_whatsapp_to_auth_phone();
