import { createClient } from "@supabase/supabase-js";
import { readE2EEnv } from "./tests/helpers/e2e-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRLS() {
  const env = readE2EEnv();
  if (!env) return;

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.senderEmail,
    password: env.senderPassword,
  });

  if (authErr) return console.error("Auth Error:", authErr);
  console.log("Logged in as sender:", authData.user!.id);

  // 1. Fetch admin_profiles
  const { data: admins, error: adminErr } = await supabase.from("admin_profiles").select("*");
  console.log("Admins:", admins?.length, adminErr?.message || "");

  if (admins && admins.length > 0) {
    const phId = admins[0].user_id;
    console.log("Found admin user_id:", phId);

    // 2. Fetch users table for this PH id
    const { data: userData, error: userErr } = await supabase.from("users").select("*").eq("id", phId);
    console.log("Fetch user profile:", userData?.length, userErr?.message || "");
  }
}

testRLS().catch(console.error);
