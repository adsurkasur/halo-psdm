import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

type Row = Record<string, unknown>;
type TableName =
  | "users"
  | "reports"
  | "report_status_history"
  | "chat_sessions"
  | "chat_messages"
  | "admin_profiles"
  | "appointments"
  | "notifications";

const now = new Date().toISOString();
const makeId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Date.now().toString(36);

const initialDb: Record<TableName, Row[]> = {
  users: [
    {
      id: "u1",
      name: "Ade Surya Ananda",
      biro: "INFOKOM",
      jabatan: "ANGGOTA_MUDA",
      role: "MEMBER",
      email: "ade@arsc.org",
      password: "ade123",
      is_active: true,
      created_at: now,
    },
    {
      id: "u2",
      name: "Sarah Amelia",
      biro: "PSDM",
      jabatan: "PENGURUS_HARIAN",
      role: "HR",
      email: "sarah@arsc.org",
      password: "sarah123",
      is_active: true,
      created_at: now,
    },
    {
      id: "u3",
      name: "Nadia Putri",
      biro: "PSDM",
      jabatan: "PENGURUS_HARIAN",
      role: "PH",
      email: "nadia@arsc.org",
      password: "nadia123",
      is_active: true,
      created_at: now,
    },
  ],
  reports: [
    {
      id: "r1",
      case_id: "HP-20260313-0001",
      user_id: "u1",
      category: "KONFLIK",
      urgency: "TINGGI",
      kronologi: "Kronologi panjang untuk pengujian yang memenuhi minimal karakter pada test.",
      status: "RECEIVED",
      admin_notes: "",
      created_at: now,
      updated_at: now,
    },
  ],
  report_status_history: [
    {
      id: "sh1",
      report_id: "r1",
      old_status: null,
      new_status: "RECEIVED",
      changed_by: "system",
      note: "Laporan diterima",
      created_at: now,
    },
  ],
  chat_sessions: [],
  chat_messages: [],
  admin_profiles: [
    {
      id: "u2",
      user_id: "u2",
      display_name: "Sarah Amelia",
      jabatan_display: "Pengurus Harian",
      availability_status: "ONLINE",
      wa_number: "628123456789",
      avatar_url: "",
    },
  ],
  appointments: [],
  notifications: [],
};

let db: Record<TableName, Row[]> = structuredClone(initialDb);
let currentAuthUserId: string | null = null;
const authListeners = new Set<(event: string, session: { user: { id: string; email?: string | null } } | null) => void>();

beforeEach(() => {
  db = structuredClone(initialDb);
  currentAuthUserId = null;
  authListeners.clear();
  window.localStorage.clear();

  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" ? input : input.toString();
    const url = new URL(rawUrl, "http://localhost");
    const path = url.pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (!currentAuthUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const currentUser = db.users.find((u) => String(u.id) === currentAuthUserId);
    if (!currentUser) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    if (path === "/api/secure/reports" && method === "POST") {
      const nowIso = new Date().toISOString();
      const reportId = makeId();
      const report = {
        id: reportId,
        case_id: `HP-${nowIso.slice(0, 10).replace(/-/g, "")}-0001`,
        user_id: currentAuthUserId,
        category: body.category,
        urgency: body.urgency,
        kronologi: body.kronologi,
        status: "RECEIVED",
        admin_notes: "",
        created_at: nowIso,
        updated_at: nowIso,
      };
      const historyEntry = {
        id: makeId(),
        report_id: report.id,
        old_status: null,
        new_status: "RECEIVED",
        changed_by: "system",
        note: "Laporan diterima",
        created_at: nowIso,
      };
      db.reports.push(report);
      db.report_status_history.push(historyEntry);
      return new Response(JSON.stringify({ report, historyEntry }), { status: 200 });
    }

    if (path === "/api/secure/auth/sync-profile" && method === "POST") {
      const authUser = db.users.find((u) => String(u.id) === currentAuthUserId);
      if (!authUser) {
        return new Response(JSON.stringify({ error: "Profil pengguna tidak ditemukan." }), { status: 404 });
      }

      return new Response(JSON.stringify({ profile: authUser }), { status: 200 });
    }

    const statusMatch = path.match(/^\/api\/secure\/reports\/([^/]+)\/status$/);
    if (statusMatch && method === "PATCH") {
      const reportId = statusMatch[1];
      const report = db.reports.find((r) => String(r.id) === reportId);
      if (!report) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
      const nowIso = new Date().toISOString();
      const historyEntry = {
        id: makeId(),
        report_id: reportId,
        old_status: report.status,
        new_status: body.newStatus,
        changed_by: currentAuthUserId,
        note: body.note ?? "",
        created_at: nowIso,
      };
      report.status = body.newStatus;
      report.updated_at = nowIso;
      db.report_status_history.push(historyEntry);
      return new Response(JSON.stringify({ ok: true, historyEntry }), { status: 200 });
    }

    const urgencyMatch = path.match(/^\/api\/secure\/reports\/([^/]+)\/urgency$/);
    if (urgencyMatch && method === "PATCH") {
      const reportId = urgencyMatch[1];
      const report = db.reports.find((r) => String(r.id) === reportId);
      if (!report) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
      report.urgency = body.newUrgency;
      report.updated_at = new Date().toISOString();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (path === "/api/secure/chat/sessions" && method === "POST") {
      const session = {
        id: makeId(),
        report_id: body.reportId ?? null,
        user_id: currentAuthUserId,
        assigned_admin_id: null,
        status: "OPEN",
        created_at: new Date().toISOString(),
        closed_at: null,
      };
      db.chat_sessions.push(session);
      return new Response(JSON.stringify({ session }), { status: 200 });
    }

    const closeMatch = path.match(/^\/api\/secure\/chat\/sessions\/([^/]+)\/close$/);
    if (closeMatch && method === "POST") {
      const sessionId = closeMatch[1];
      const session = db.chat_sessions.find((s) => String(s.id) === sessionId);
      if (!session) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
      const closedAt = new Date().toISOString();
      session.status = "CLOSED";
      session.closed_at = closedAt;
      return new Response(JSON.stringify({ ok: true, closed_at: closedAt }), { status: 200 });
    }

    if (path === "/api/secure/chat/messages" && method === "POST") {
      const message = {
        id: makeId(),
        session_id: body.sessionId,
        sender_id: currentAuthUserId,
        content: body.content,
        type: body.type ?? "TEXT",
        media_url: body.mediaUrl,
        media_name: body.mediaName,
        is_read: false,
        read_at: null,
        created_at: new Date().toISOString(),
      };
      db.chat_messages.push(message);
      return new Response(JSON.stringify({ message }), { status: 200 });
    }

    if (path === "/api/secure/appointments" && method === "POST") {
      const appointment = {
        id: makeId(),
        user_id: currentAuthUserId,
        target_admin_id: body.targetAdminId,
        created_at: new Date().toISOString(),
      };
      db.appointments.push(appointment);
      return new Response(JSON.stringify({ appointment }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: `Unhandled route: ${method} ${path}` }), { status: 404 });
  }) as unknown as typeof fetch;
});

type Filter = (row: Row) => boolean;

class QueryBuilder {
  private filters: Filter[] = [];
  private sortKey: string | null = null;
  private sortAsc = true;
  private mode: "select" | "update" | "delete" = "select";
  private updatePayload: Row = {};

  constructor(private table: TableName) {}

  select() {
    this.mode = "select";
    return this;
  }

  update(payload: Row) {
    this.mode = "update";
    this.updatePayload = payload;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  neq(key: string, value: unknown) {
    this.filters.push((row) => row[key] !== value);
    return this;
  }

  in(key: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[key]));
    return this;
  }

  or(expression: string) {
    const parts = expression.split(",");
    const ors = parts.map((p) => {
      const [left, value] = p.split(".eq.");
      return { key: left, value };
    });
    this.filters.push((row) => ors.some((o) => String(row[o.key]) === o.value));
    return this;
  }

  order(key: string, opts?: { ascending?: boolean }) {
    this.sortKey = key;
    this.sortAsc = opts?.ascending ?? true;
    return Promise.resolve(this.execute());
  }

  maybeSingle() {
    const res = this.execute();
    const first = (res.data as Row[])[0] ?? null;
    return Promise.resolve({ data: first, error: null });
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    const rows = db[this.table];
    const filtered = rows.filter((row) => this.filters.every((f) => f(row)));

    if (this.mode === "update") {
      filtered.forEach((row) => Object.assign(row, this.updatePayload));
      return { data: filtered, error: null };
    }

    if (this.mode === "delete") {
      db[this.table] = rows.filter((row) => !filtered.includes(row));
      return { data: filtered, error: null };
    }

    const sorted = [...filtered];
    if (this.sortKey) {
      sorted.sort((a, b) => {
        const av = String(a[this.sortKey as string] ?? "");
        const bv = String(b[this.sortKey as string] ?? "");
        return this.sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }

    return { data: sorted, error: null };
  }
}

const supabaseMock = {
  auth: {
    getSession: async () => ({
      data: {
        session: currentAuthUserId
          ? {
              user: {
                id: currentAuthUserId,
              },
              access_token: "test-access-token",
            }
          : null,
      },
      error: null,
    }),
    getUser: async () => {
      if (!currentAuthUserId) {
        return { data: { user: null }, error: null };
      }

      const row = db.users.find((u) => String(u.id) === currentAuthUserId) as Row | undefined;
      if (!row) {
        return {
          data: {
            user: {
              id: currentAuthUserId,
              email: null,
              user_metadata: {},
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        };
      }

      return {
        data: {
          user: {
            id: String(row.id),
            email: String(row.email),
            user_metadata: {
              name: String(row.name ?? "User"),
              biro: String(row.biro ?? "INFOKOM"),
              jabatan: String(row.jabatan ?? "ANGGOTA_MUDA"),
            },
            created_at: String(row.created_at ?? new Date().toISOString()),
          },
        },
        error: null,
      };
    },
    onAuthStateChange: (callback: (event: string, session: { user: { id: string; email?: string | null } } | null) => void) => {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const user = db.users.find((u) => u.email === email && u.password === password) as Row | undefined;
      if (!user) {
        return {
          data: { user: null, session: null },
          error: { message: "Invalid login credentials" },
        };
      }

      currentAuthUserId = String(user.id);
      const session = { user: { id: String(user.id), email: String(user.email) } };
      authListeners.forEach((listener) => listener("SIGNED_IN", session));

      return {
        data: { user: session.user, session: { ...session, access_token: "test-access-token" } },
        error: null,
      };
    },
    signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
      const existing = db.users.find((u) => u.email === email);
      if (existing) {
        return {
          data: { user: null, session: null },
          error: { message: "User already registered" },
        };
      }

      const userId = `auth-${Date.now().toString(36)}`;
      const session = { user: { id: userId, email } };
      currentAuthUserId = userId;
      authListeners.forEach((listener) => listener("SIGNED_IN", session));

      // mimic that app-side profile upsert still happens after auth signup
      void password;
      void options;

      return {
        data: { user: session.user, session: { ...session, access_token: "test-access-token" } },
        error: null,
      };
    },
    signOut: async () => {
      currentAuthUserId = null;
      authListeners.forEach((listener) => listener("SIGNED_OUT", null));
      return { error: null };
    },
    updateUser: async ({ email, password }: { email?: string; password?: string }) => {
      if (!currentAuthUserId) {
        return { data: { user: null }, error: { message: "Not authenticated" } };
      }

      const idx = db.users.findIndex((u) => String(u.id) === currentAuthUserId);
      if (idx >= 0) {
        if (typeof email !== "undefined") db.users[idx].email = email;
        if (typeof password !== "undefined") db.users[idx].password = password;
      }

      return {
        data: { user: { id: currentAuthUserId, email: email ?? null } },
        error: null,
      };
    },
  },
  from(table: TableName) {
    return {
      select: () => new QueryBuilder(table).select(),
      update: (payload: Row) => new QueryBuilder(table).update(payload),
      delete: () => new QueryBuilder(table).delete(),
      insert: (payload: Row | Row[]) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        db[table].push(...rows);
        return Promise.resolve({ data: rows, error: null });
      },
      upsert: (payload: Row) => {
        const existingIdx = db[table].findIndex((r) => r.id === payload.id || r.user_id === payload.user_id);
        if (existingIdx >= 0) {
          db[table][existingIdx] = { ...db[table][existingIdx], ...payload };
        } else {
          db[table].push(payload);
        }
        return Promise.resolve({ data: payload, error: null });
      },
    };
  },
};

vi.mock("@/lib/supabase/client", () => ({
  supabase: supabaseMock,
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
