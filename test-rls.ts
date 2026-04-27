import { createClient } from "@supabase/supabase-js";
import { readE2EEnv } from "./tests/helpers/e2e-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugRLS() {
  const env = readE2EEnv();
  if (!env) return console.error("No E2E env");

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.senderEmail,
    password: env.senderPassword,
  });

  if (authErr) return console.error("Auth Error:", authErr);
  
  console.log("Logged in as sender UID:", authData.user?.id);

  console.log("--- Testing users SELECT ---");
  const { data: usersData, error: usersErr } = await supabase.from("users").select("id, name, role").limit(2);
  console.log("Users SELECT:", usersErr ? "ERROR " + usersErr.message : "SUCCESS " + usersData?.length);

  console.log("--- Testing users UPDATE ---");
  const { error: updateErr } = await supabase.from("users").update({ name: "Test Sender" }).eq("id", authData.user!.id);
  console.log("Users UPDATE:", updateErr ? "ERROR " + updateErr.message : "SUCCESS");

  console.log("--- Testing admin_profiles SELECT ---");
  const { data: adminData, error: adminErr } = await supabase.from("admin_profiles").select("user_id").limit(2);
  console.log("admin_profiles SELECT:", adminErr ? "ERROR " + adminErr.message : "SUCCESS " + adminData?.length);

  console.log("--- Testing admin_profiles DELETE ---");
  const { error: delErr } = await supabase.from("admin_profiles").delete().eq("user_id", authData.user!.id);
  console.log("admin_profiles DELETE:", delErr ? "ERROR " + delErr.message : "SUCCESS");
}

debugRLS().catch(console.error);
