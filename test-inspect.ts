import { createClient } from "@supabase/supabase-js";
import { readE2EEnv } from "./tests/helpers/e2e-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectData() {
  const env = readE2EEnv();
  if (!env) return;

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.senderEmail,
    password: env.senderPassword,
  });

  if (authErr) return console.error("Auth Error:", authErr);
  
  const { data: admins } = await supabase.from("admin_profiles").select("*");
  console.log("=== ADMIN PROFILES ===");
  console.log(admins);

  for (const admin of admins || []) {
    const { data: user } = await supabase.from("users").select("*").eq("id", admin.user_id).single();
    console.log(`=== USER: ${admin.user_id} ===`);
    console.log(user);
  }
}

inspectData().catch(console.error);
