import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabasePublishableKey) {
  // Only warn during build, throw at runtime if actually needed
  if (typeof window !== "undefined") {
    console.error("Missing Supabase environment variables for browser client.");
  }
}

export const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
