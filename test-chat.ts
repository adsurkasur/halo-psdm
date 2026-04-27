import { createClient } from "@supabase/supabase-js";
import { readE2EEnv } from "./tests/helpers/e2e-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Use service role to bypass RLS and see what's actually there
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testChatRLS() {
  const env = readE2EEnv();
  if (!env) return;

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.senderEmail,
    password: env.senderPassword,
  });

  if (authErr) return console.error("Auth Error:", authErr);
  const uid = authData.user!.id;
  console.log("Logged in as sender UID:", uid);

  // Use service role to create a test session for this user
  console.log("Creating test session...");
  const sessionId = crypto.randomUUID();
  const { error: insertSessErr } = await supabaseAdmin.from("chat_sessions").insert({
    id: sessionId,
    user_id: uid,
    created_at: new Date().toISOString()
  });
  if (insertSessErr) return console.error("Failed to create test session:", insertSessErr);

  console.log("Creating test message...");
  const msgId = crypto.randomUUID();
  const { error: insertMsgErr } = await supabaseAdmin.from("chat_messages").insert({
    id: msgId,
    session_id: sessionId,
    sender_id: uid,
    content: "Test message",
    created_at: new Date().toISOString()
  });
  if (insertMsgErr) return console.error("Failed to create test message:", insertMsgErr);

  console.log("--- RLS TEST ---");
  const { data: sessCheck } = await supabase.from("chat_sessions").select("*").eq("id", sessionId);
  console.log("Can read session?", sessCheck?.length > 0 ? "YES" : "NO");

  const { data: msgCheck, error: msgErr } = await supabase.from("chat_messages").select("*").eq("session_id", sessionId);
  console.log("Can read message?", msgCheck?.length > 0 ? "YES" : "NO", msgErr?.message || "");

  // Cleanup
  await supabaseAdmin.from("chat_sessions").delete().eq("id", sessionId);
}

testChatRLS().catch(console.error);
