-- Drop the old insert policy
DROP POLICY IF EXISTS "Admin_profiles insert" ON public.admin_profiles;

-- Create the security definer function
CREATE OR REPLACE FUNCTION public.can_insert_admin_profile()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('HR', 'PH')
  );
$$;

-- Create the new insert policy
CREATE POLICY "Admin_profiles insert" 
ON public.admin_profiles FOR INSERT 
TO authenticated 
WITH CHECK (
  user_id = auth.uid() AND public.can_insert_admin_profile()
);
