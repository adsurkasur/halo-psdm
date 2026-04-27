-- SQL Script: Change User Role
-- Usage: Replace 'user@example.com' with the target email and 'PH' with the desired role ('MEMBER', 'HR', or 'PH').

-- 1. Update the user's role in the 'users' table
UPDATE public.users
SET role = 'PH' -- Options: 'MEMBER', 'HR', 'PH'
WHERE email = 'user@example.com';

-- 2. If promoting to HR or PH, ensure they have an entry in 'admin_profiles' 
-- so they appear in the appointment/directory list.
INSERT INTO public.admin_profiles (user_id, display_name, jabatan_display, availability_status)
SELECT 
  id, 
  name as display_name, 
  jabatan as jabatan_display, 
  'ONLINE' as availability_status
FROM public.users
WHERE email = 'user@example.com'
  AND role IN ('HR', 'PH')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Verify the change
SELECT id, email, name, role FROM public.users WHERE email = 'user@example.com';
