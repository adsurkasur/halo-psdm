import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publicKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || ""
).trim();
const secretKey = (
  process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || ""
).trim();

const requiredEnv = {
  E2E_PH_EMAIL: process.env.E2E_PH_EMAIL?.trim() ?? "",
  E2E_PH_PASSWORD: process.env.E2E_PH_PASSWORD?.trim() ?? "",
  E2E_SENDER_EMAIL: process.env.E2E_SENDER_EMAIL?.trim() ?? "",
  E2E_SENDER_PASSWORD: process.env.E2E_SENDER_PASSWORD?.trim() ?? "",
  E2E_HR_EMAIL: process.env.E2E_HR_EMAIL?.trim() ?? "",
  E2E_HR_PASSWORD: process.env.E2E_HR_PASSWORD?.trim() ?? "",
};

if (!supabaseUrl || !publicKey || !secretKey || Object.values(requiredEnv).some((value) => !value)) {
  throw new Error("The isolated E2E Supabase environment is incomplete.");
}

const parsedUrl = new URL(supabaseUrl);
if (
  parsedUrl.protocol !== "http:"
  || !["127.0.0.1", "localhost"].includes(parsedUrl.hostname)
  || parsedUrl.port !== "55321"
) {
  throw new Error(`Refusing to seed a non-local Supabase target: ${parsedUrl.origin}`);
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const accountSpecs = [
  {
    key: "ph",
    email: requiredEnv.E2E_PH_EMAIL,
    password: requiredEnv.E2E_PH_PASSWORD,
    profile: {
      name: "CI Pengurus Harian",
      biro: "PSDM",
      jabatan: "PENGURUS_HARIAN",
      role: "PH",
      whatsapp: "6280000000001",
    },
  },
  {
    key: "sender",
    email: requiredEnv.E2E_SENDER_EMAIL,
    password: requiredEnv.E2E_SENDER_PASSWORD,
    profile: {
      name: "CI Sender",
      biro: "RISTEK",
      jabatan: "STAF",
      role: "MEMBER",
      whatsapp: "6280000000002",
    },
  },
  {
    key: "hr",
    email: requiredEnv.E2E_HR_EMAIL,
    password: requiredEnv.E2E_HR_PASSWORD,
    profile: {
      name: "CI Human Resources",
      biro: "PSDM",
      jabatan: "STAF_AHLI",
      role: "HR",
      whatsapp: "6280000000003",
    },
  },
];

const { data: existingUsersResult, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
const existingByEmail = new Map(
  existingUsersResult.users.map((user) => [user.email?.toLowerCase() ?? "", user]),
);

const authUsers = new Map();
for (const account of accountSpecs) {
  const existing = existingByEmail.get(account.email.toLowerCase());
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: account.profile,
    });
    if (error || !data.user) throw error ?? new Error(`Could not refresh CI auth user ${account.key}.`);
    authUsers.set(account.key, data.user);
    continue;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: account.profile,
  });
  if (error || !data.user) throw error ?? new Error(`Could not create CI auth user ${account.key}.`);
  authUsers.set(account.key, data.user);
}

const profileRows = accountSpecs.map((account) => ({
  id: authUsers.get(account.key).id,
  email: account.email,
  ...account.profile,
  avatar_url: null,
  is_active: true,
}));

const { error: profileError } = await admin
  .from("users")
  .upsert(profileRows, { onConflict: "id" });
if (profileError) throw profileError;

const adminRows = ["ph", "hr"].map((key) => {
  const account = accountSpecs.find((candidate) => candidate.key === key);
  return {
    user_id: authUsers.get(key).id,
    display_name: account.profile.name,
    jabatan_display: key === "ph" ? "Pengurus Harian" : "Human Resources",
    availability_status: "ONLINE",
    wa_number: account.profile.whatsapp,
  };
});

const { error: adminProfileError } = await admin
  .from("admin_profiles")
  .upsert(adminRows, { onConflict: "user_id" });
if (adminProfileError) throw adminProfileError;

const reportId = process.env.E2E_REPORT_ID?.trim() || "00000000-0000-4000-8000-000000000101";
const sender = accountSpecs.find((account) => account.key === "sender");
const senderUser = authUsers.get("sender");
const { error: reportError } = await admin.from("reports").upsert({
  id: reportId,
  case_id: "E2E-CI-001",
  user_id: senderUser.id,
  reporter_name: sender.profile.name,
  reporter_email: sender.email,
  reporter_whatsapp: sender.profile.whatsapp,
  category: "LAINNYA",
  urgency: "NORMAL",
  kronologi: "Laporan fixture khusus CI untuk memverifikasi alur Halo PSDM tanpa menyentuh data produksi.",
  status: "RECEIVED",
  admin_notes: "",
}, { onConflict: "id" });
if (reportError) throw reportError;

for (const account of accountSpecs) {
  const loginClient = createClient(supabaseUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await loginClient.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (error || !data.user) throw error ?? new Error(`CI login verification failed for ${account.key}.`);
  await loginClient.auth.signOut();
}

console.log(JSON.stringify({
  target: parsedUrl.origin,
  seededAuthUsers: accountSpecs.length,
  seededProfiles: profileRows.length,
  seededAdminProfiles: adminRows.length,
  seededReports: 1,
  verifiedLogins: accountSpecs.length,
  productionDataTouched: false,
}, null, 2));
