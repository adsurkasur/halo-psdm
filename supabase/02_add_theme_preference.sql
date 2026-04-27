-- Migration: Add theme_preference column to users table
-- This column was referenced in code but never added to the database schema.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'light';
