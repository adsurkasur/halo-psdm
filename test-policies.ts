import { createClient } from "@supabase/supabase-js";
import { readE2EEnv } from "./tests/helpers/e2e-helpers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey);

async function checkPolicies() {
  const { data, error } = await supabaseAdmin.rpc("get_policies", {});
  if (error) {
    console.log("RPC get_policies failed, let's query directly via postgres_query if possible");
    // Unfortunately we can't easily query pg_policies via standard rest api.
  }
}

checkPolicies();
