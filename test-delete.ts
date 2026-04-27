import { createClient } from "@supabase/supabase-js";
import { readE2EEnv } from "./tests/helpers/e2e-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDelete() {
  const env = readE2EEnv();
  if (!env) return;

  // Login as PH! We need the PH credentials.
  // We can just use the service role to simulate it or find the PH email.
  // I will use service role to execute the delete directly AS the PH user.
  
  const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey);
  
  const { data: admins } = await supabaseAdmin.from("admin_profiles").select("user_id").limit(1);
  if (!admins || admins.length === 0) return console.log("No admins found");
  const targetId = admins[0].user_id;
  
  console.log("Target Admin ID:", targetId);
  
  // We don't have the user's password, but we can verify if the delete works using a direct postgres query via an RPC, or just log in as the sender and try to delete (which should fail because sender is not admin).
  // Wait, if sender is NOT admin, they can't delete!
  // Let's create a test admin profile for the sender, then the sender tries to delete it!

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.senderEmail,
    password: env.senderPassword,
  });

  if (authErr) return console.error("Auth Error:", authErr);
  const senderId = authData.user!.id;
  console.log("Logged in as sender UID:", senderId);

  // 1. Service role adds sender to admin_profiles
  await supabaseAdmin.from("admin_profiles").insert({
    user_id: senderId,
    display_name: "Test Admin",
    jabatan_display: "Pengurus Harian",
    availability_status: "ONLINE",
  });

  console.log("Inserted test admin profile for sender");

  // 2. Sender tries to delete themselves using their OWN authenticated client
  console.log("Sender attempting to delete their own admin profile...");
  const { data: delData, error: delErr } = await supabase.from("admin_profiles").delete().eq("user_id", senderId).select();
  
  console.log("Delete result data:", delData);
  console.log("Delete error:", delErr?.message);

  // Cleanup
  await supabaseAdmin.from("admin_profiles").delete().eq("user_id", senderId);
}

testDelete().catch(console.error);
