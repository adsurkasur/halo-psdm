import { createClient } from "@supabase/supabase-js";
import { readE2EEnv } from "./tests/helpers/e2e-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey);

async function testInsert() {
  const env = readE2EEnv();
  if (!env) return;

  // We will test if an admin can insert themselves using their authenticated client.
  // Wait, I only have the sender's credentials in env.
  // Let's make the sender an HR first using admin client.
  
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.senderEmail,
    password: env.senderPassword,
  });

  if (authErr) return console.error("Auth Error:", authErr);
  const senderId = authData.user!.id;
  console.log("Logged in as sender UID:", senderId);

  // 1. Temporarily elevate sender to HR via admin client
  await supabaseAdmin.from("users").update({ role: "HR" }).eq("id", senderId);
  console.log("Elevated sender to HR");

  // 2. Sender attempts to insert themselves into admin_profiles
  console.log("Sender attempting to INSERT their own admin profile...");
  const { data: insData, error: insErr } = await supabase.from("admin_profiles").insert({
    user_id: senderId,
    display_name: "Test HR Insert",
    jabatan_display: "Pengurus Harian",
    availability_status: "ONLINE"
  }).select();

  console.log("Insert result data:", insData?.length > 0 ? "SUCCESS" : "FAILED");
  console.log("Insert error:", insErr?.message);

  // Cleanup
  await supabaseAdmin.from("admin_profiles").delete().eq("user_id", senderId);
  await supabaseAdmin.from("users").update({ role: "MEMBER" }).eq("id", senderId);
}

testInsert().catch(console.error);
