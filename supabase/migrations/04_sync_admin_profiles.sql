-- ==============================================================================
-- SYNCHRONIZE USERS -> ADMIN_PROFILES TRIGGER
-- ==============================================================================

-- Create the trigger function
CREATE OR REPLACE FUNCTION sync_admin_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user exists in the admin_profiles table
  IF EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = NEW.id) THEN
    -- Update the admin_profiles row with the fresh data from the users table
    UPDATE public.admin_profiles 
    SET 
      display_name = NEW.name,
      wa_number = NEW.whatsapp,
      -- Map the exact enum values from the users table to the human-readable display labels
      jabatan_display = CASE NEW.jabatan 
        WHEN 'PENGURUS_HARIAN' THEN 'Pengurus Harian'
        WHEN 'STAF_AHLI' THEN 'Staf Ahli'
        WHEN 'STAF' THEN 'Staf'
        WHEN 'ANGGOTA_MUDA' THEN 'Anggota Muda'
        ELSE NEW.jabatan
      END,
      updated_at = now()
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists to ensure a clean creation
DROP TRIGGER IF EXISTS on_user_profile_update ON public.users;

-- Create the trigger that fires AFTER any update on the users table
CREATE TRIGGER on_user_profile_update
AFTER UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION sync_admin_profile();
