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

const initialDb: Record<TableName, Row[]> = {
  users: [
    {
      id: "u1",
      name: "Ade Surya Ananda",
      biro: "INFOKOM",
      jabatan: "ANGGOTA_MUDA",
      role: "SENDER",
      email: "ade@arsc.org",
      password_hash: "ade123",
      is_active: true,
      created_at: now,
    },
    {
      id: "u2",
      name: "Sarah Amelia",
      biro: "PSDM",
      jabatan: "PENGURUS_HARIAN",
      role: "ADMIN",
      email: "sarah@arsc.org",
      password_hash: "sarah123",
      is_active: true,
      created_at: now,
    },
    {
      id: "u3",
      name: "Nadia Putri",
      biro: "PSDM",
      jabatan: "PENGURUS_HARIAN",
      role: "SUPER_ADMIN",
      email: "nadia@arsc.org",
      password_hash: "nadia123",
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

beforeEach(() => {
  db = structuredClone(initialDb);
  window.localStorage.clear();
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
