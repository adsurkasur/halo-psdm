import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateId,
  type Report,
  type ReportStatus,
  type ReportStatusHistory,
  type ChatSession,
  type ChatMessage,
  type ChatMessageType,
  type AdminProfile,
  type Appointment,
  type Notification,
  type ReportCategory,
  type Urgency,
  type AvailabilityStatus,
  type NotificationType,
  type AppointmentStatus,
} from "@/data/domain";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DataContextType {
  isBusy: boolean;
  dataLoadIssues: string[];
  lastSyncedAt: string | null;
  reloadData: () => Promise<void>;
  reports: Report[];
  statusHistory: ReportStatusHistory[];
  addReport: (data: {
    user_id: string;
    category: ReportCategory;
    urgency: Urgency;
    kronologi: string;
    attachment_url?: string | null;
    attachment_name?: string | null;
    attachment_path?: string | null;
    attachment_mime?: string | null;
    attachment_size?: number | null;
  }) => Promise<Report>;
  updateReportStatus: (reportId: string, newStatus: ReportStatus, adminId: string, note?: string) => Promise<void>;
  updateReportUrgency: (reportId: string, newUrgency: Urgency, adminId: string) => Promise<void>;
  updateReportNotes: (reportId: string, notes: string) => Promise<void>;

  chatSessions: ChatSession[];
  chatMessages: ChatMessage[];
  createChatSession: (userId: string, reportId?: string | null) => Promise<ChatSession>;
  assignAdminToSession: (sessionId: string, adminId: string) => Promise<void>;
  closeChatSession: (sessionId: string) => Promise<void>;
  addChatMessage: (sessionId: string, senderId: string, content: string, type?: ChatMessageType, mediaUrl?: string, mediaName?: string) => Promise<ChatMessage>;
  markMessagesRead: (sessionId: string, readerId: string) => Promise<void>;

  adminProfiles: AdminProfile[];
  updateAvailability: (adminUserId: string, status: AvailabilityStatus) => Promise<void>;
  addAdminProfile: (profile: AdminProfile) => Promise<void>;
  removeAdminProfile: (userId: string) => Promise<void>;

  appointments: Appointment[];
  addAppointment: (userId: string, targetAdminId: string) => Promise<Appointment>;
  updateAppointmentStatus: (appointmentId: string, status: AppointmentStatus, statusNote?: string) => Promise<void>;

  notifications: Notification[];
  addNotification: (data: {
    user_id: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  getUnreadCount: (userId: string) => number;
}

const QUERY_KEYS = {
  reports: (userId: string, role: string) => ["reports", userId, role],
  reportHistory: (reportIds: string[]) => ["reportHistory", reportIds],
  chatSessions: (userId: string, role: string) => ["chatSessions", userId, role],
  chatMessages: (sessionIds: string[]) => ["chatMessages", sessionIds],
  adminProfiles: ["adminProfiles"],
  appointments: (userId: string, role: string) => ["appointments", userId, role],
  notifications: (userId: string) => ["notifications", userId],
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const API_TIMEOUT_MS = 15000;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [pendingOps, setPendingOps] = useState(0);
  const inFlightRequestsRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const isBusy = pendingOps > 0;
  const dataLoadIssues: string[] = [];
  const lastSyncedAt: string | null = null;

  const mapAdminProfiles = useCallback((rows: unknown[]) => {
    return rows.map((p) => {
      const raw = p as {
        id?: string;
        user_id?: string;
        display_name: string;
        jabatan_display: string;
        availability_status: AvailabilityStatus;
        wa_number?: string;
        avatar_url: string;
        updated_at?: string;
      };

      return {
        user_id: raw.user_id ?? raw.id ?? "",
        display_name: raw.display_name,
        jabatan_display: raw.jabatan_display,
        availability_status: raw.availability_status,
        wa_number: raw.wa_number ?? "",
        avatar_url: raw.avatar_url,
        updated_at: raw.updated_at ?? new Date().toISOString(),
      } satisfies AdminProfile;
    });
  }, []);

  const mapNotifications = useCallback((rows: unknown[]) => {
    return rows.map((n) => {
      const raw = n as {
        id: string;
        user_id: string;
        type: NotificationType;
        title?: string;
        message?: string;
        link?: string;
        payload?: { title?: string; message?: string; link?: string };
        is_read: boolean;
        created_at: string;
      };

      return {
        id: raw.id,
        user_id: raw.user_id,
        type: raw.type,
        title: raw.title ?? raw.payload?.title ?? "Notifikasi",
        message: raw.message ?? raw.payload?.message ?? "",
        link: raw.link ?? raw.payload?.link,
        is_read: raw.is_read,
        created_at: raw.created_at,
      };
    });
  }, []);

  const withBusy = useCallback(async <T,>(executor: () => Promise<T>): Promise<T> => {
    setPendingOps((prev) => prev + 1);
    try {
      return await executor();
    } finally {
      setPendingOps((prev) => Math.max(0, prev - 1));
    }
  }, []);

  const callSecureApi = useCallback(
    async <T,>(path: string, init: RequestInit): Promise<T> => {
      const method = (init.method ?? "GET").toUpperCase();
      const requestBody = typeof init.body === "string" ? init.body : "";
      const requestKey = `${method}:${path}:${requestBody}`;

      const existing = inFlightRequestsRef.current.get(requestKey);
      if (existing) {
        return (await existing) as T;
      }

      const requestPromise = withBusy(async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, API_TIMEOUT_MS);

      try {
        const response = await fetch(path, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init.headers ?? {}),
          },
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
        if (!response.ok) {
          throw new Error(payload.error ?? `API error (${response.status})`);
        }

        return payload;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("Permintaan melebihi batas waktu. Coba lagi beberapa saat.");
        }
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
      });

      inFlightRequestsRef.current.set(requestKey, requestPromise as Promise<unknown>);

      try {
        return (await requestPromise) as T;
      } finally {
        inFlightRequestsRef.current.delete(requestKey);
      }
    },
    [withBusy]
  );

  const reportsQuery = useQuery({
    queryKey: QUERY_KEYS.reports(user?.id ?? "", user?.role ?? ""),
    queryFn: async () => {
      if (!user) return [];
      const isPh = user.role === "PH";
      const { data, error } = isPh
        ? await supabase.from("reports").select("*").order("created_at", { ascending: false })
        : await supabase.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Report[];
    },
    enabled: !!user,
  });

  const reports = reportsQuery.data ?? [];

  const historyQuery = useQuery({
    queryKey: QUERY_KEYS.reportHistory(reports.map((r) => r.id)),
    queryFn: async () => {
      const reportIds = reports.map((r) => r.id);
      if (reportIds.length === 0) return [];
      const { data, error } = await supabase
        .from("report_status_history")
        .select("*")
        .in("report_id", reportIds)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ReportStatusHistory[];
    },
    enabled: reports.length > 0,
  });

  const statusHistory = historyQuery.data ?? [];

  const sessionsQuery = useQuery({
    queryKey: QUERY_KEYS.chatSessions(user?.id ?? "", user?.role ?? ""),
    queryFn: async () => {
      if (!user) return [];
      const isPh = user.role === "PH";
      if (isPh) {
        const { data, error } = await supabase.from("chat_sessions").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as ChatSession[];
      } else {
        const [sessionsByUser, reportIdsRes] = await Promise.all([
          supabase.from("chat_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
          supabase.from("reports").select("id").eq("user_id", user.id),
        ]);

        if (sessionsByUser.error) throw sessionsByUser.error;
        if (reportIdsRes.error) throw reportIdsRes.error;

        const reportIds = (reportIdsRes.data ?? []).map((row) => row.id as string);
        let sessionsByReport: ChatSession[] = [];
        if (reportIds.length > 0) {
          const res = await supabase
            .from("chat_sessions")
            .select("*")
            .in("report_id", reportIds)
            .order("created_at", { ascending: false });
          if (res.error) throw res.error;
          sessionsByReport = (res.data ?? []) as ChatSession[];
        }

        const merged = [...(sessionsByUser.data ?? []), ...sessionsByReport];
        const deduped = new Map<string, ChatSession>();
        for (const session of merged) {
          deduped.set(session.id, session as ChatSession);
        }
        return Array.from(deduped.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }
    },
    enabled: !!user,
  });

  const chatSessions = sessionsQuery.data ?? [];

  const messagesQuery = useQuery({
    queryKey: QUERY_KEYS.chatMessages(chatSessions.map((s) => s.id)),
    queryFn: async () => {
      const sessionIds = chatSessions.map((s) => s.id);
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []).map((m) => ({
        ...(m as ChatMessage),
        type: ((m as { type?: ChatMessageType }).type ?? "TEXT") as ChatMessageType,
      }));
    },
    enabled: chatSessions.length > 0,
  });

  const chatMessages = messagesQuery.data ?? [];

  const adminProfilesQuery = useQuery({
    queryKey: QUERY_KEYS.adminProfiles,
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_profiles").select("*");
      if (error) throw error;
      return mapAdminProfiles(data ?? []);
    },
  });

  const adminProfiles = adminProfilesQuery.data ?? [];

  const appointmentsQuery = useQuery({
    queryKey: QUERY_KEYS.appointments(user?.id ?? "", user?.role ?? ""),
    queryFn: async () => {
      if (!user) return [];
      const isPh = user.role === "PH";
      const { data, error } = isPh
        ? await supabase.from("appointments").select("*").order("created_at", { ascending: false })
        : await supabase.from("appointments").select("*").eq("user_id", user.id).order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((a) => {
        const raw = a as Partial<Appointment>;
        return {
          id: raw.id ?? "",
          user_id: raw.user_id ?? "",
          target_admin_id: raw.target_admin_id ?? "",
          status: raw.status ?? "OPEN",
          status_note: raw.status_note ?? null,
          handled_by: raw.handled_by ?? null,
          handled_at: raw.handled_at ?? null,
          created_at: raw.created_at ?? new Date().toISOString(),
        } as Appointment;
      });
    },
    enabled: !!user,
  });

  const appointments = appointmentsQuery.data ?? [];

  const notificationsQuery = useQuery({
    queryKey: QUERY_KEYS.notifications(user?.id ?? ""),
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return mapNotifications(data ?? []);
    },
    enabled: !!user,
  });

  const notifications = notificationsQuery.data ?? [];

  const reloadData = useCallback(async () => {
    await queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`live-data-${user.id}-${user.role}`);
    
    const invalidate = (table: string) => {
      if (table === "reports" || table === "report_status_history") {
        void queryClient.invalidateQueries({ queryKey: ["reports"] });
        void queryClient.invalidateQueries({ queryKey: ["reportHistory"] });
      } else if (table === "chat_sessions") {
        void queryClient.invalidateQueries({ queryKey: ["chatSessions"] });
      } else if (table === "chat_messages") {
        void queryClient.invalidateQueries({ queryKey: ["chatMessages"] });
      } else if (table === "appointments") {
        void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      } else if (table === "notifications") {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } else if (table === "admin_profiles") {
        void queryClient.invalidateQueries({ queryKey: ["adminProfiles"] });
      }
    };

    const watchedTables = [
      "reports",
      "report_status_history",
      "chat_sessions",
      "chat_messages",
      "appointments",
      "notifications",
      "admin_profiles",
    ];

    for (const table of watchedTables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => invalidate(table)
      );
    }

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const addNotification = useCallback(
    async (data: { user_id: string; type: NotificationType; title: string; message: string; link?: string }) => {
      const notif: Notification = {
        id: generateId("n"),
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
        is_read: false,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("notifications").insert({
        id: notif.id,
        user_id: notif.user_id,
        type: notif.type,
        payload: {
          title: notif.title,
          message: notif.message,
          link: notif.link,
        },
        is_read: notif.is_read,
        created_at: notif.created_at,
      });

      if (error) return;

      queryClient.setQueryData(QUERY_KEYS.notifications(notif.user_id), (prev: Notification[] | undefined) => 
        prev ? [notif, ...prev] : [notif]
      );
    },
    [queryClient]
  );

  const addReport = useCallback(
    async (data: {
      user_id: string;
      category: ReportCategory;
      urgency: Urgency;
      kronologi: string;
      attachment_url?: string | null;
      attachment_name?: string | null;
      attachment_path?: string | null;
      attachment_mime?: string | null;
      attachment_size?: number | null;
    }) => {
      const response = await callSecureApi<{ report: Report; historyEntry: ReportStatusHistory }>("/api/secure/reports", {
        method: "POST",
        body: JSON.stringify({
          category: data.category,
          urgency: data.urgency,
          kronologi: data.kronologi,
          attachment_url: data.attachment_url,
          attachment_name: data.attachment_name,
          attachment_path: data.attachment_path,
          attachment_mime: data.attachment_mime,
          attachment_size: data.attachment_size,
        }),
      });

      queryClient.setQueryData(QUERY_KEYS.reports(user?.id ?? "", user?.role ?? ""), (prev: Report[] | undefined) => 
        prev ? [response.report, ...prev] : [response.report]
      );
      
      queryClient.setQueryData(QUERY_KEYS.reportHistory([response.report.id]), (prev: ReportStatusHistory[] | undefined) => 
        prev ? [...prev, response.historyEntry] : [response.historyEntry]
      );

      return response.report;
    },
    [callSecureApi, queryClient, user?.id, user?.role]
  );

  const updateReportStatus = useCallback(
    async (reportId: string, newStatus: ReportStatus, adminId: string, note: string = "") => {
      void adminId;

      const response = await callSecureApi<{ historyEntry: ReportStatusHistory }>(`/api/secure/reports/${reportId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ newStatus, note }),
      });

      queryClient.setQueryData(QUERY_KEYS.reports(user?.id ?? "", user?.role ?? ""), (prev: Report[] | undefined) => 
        prev?.map((r) => r.id === reportId ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r)
      );

      void queryClient.invalidateQueries({ queryKey: ["reportHistory"] });
    },
    [callSecureApi, queryClient, user?.id, user?.role]
  );

  const updateReportUrgency = useCallback(
    async (reportId: string, newUrgency: Urgency, adminId: string) => {
      void adminId;

      await callSecureApi(`/api/secure/reports/${reportId}/urgency`, {
        method: "PATCH",
        body: JSON.stringify({ newUrgency }),
      });

      queryClient.setQueryData(QUERY_KEYS.reports(user?.id ?? "", user?.role ?? ""), (prev: Report[] | undefined) => 
        prev?.map((r) => r.id === reportId ? { ...r, urgency: newUrgency, updated_at: new Date().toISOString() } : r)
      );
    },
    [callSecureApi, queryClient, user?.id, user?.role]
  );

  const updateReportNotes = useCallback(async (reportId: string, notes: string) => {
    await supabase
      .from("reports")
      .update({ admin_notes: notes, updated_at: new Date().toISOString() })
      .eq("id", reportId);

    queryClient.setQueryData(QUERY_KEYS.reports(user?.id ?? "", user?.role ?? ""), (prev: Report[] | undefined) => 
      prev?.map((r) => r.id === reportId ? { ...r, admin_notes: notes } : r)
    );
  }, [queryClient, user?.id, user?.role]);

  const createChatSession = useCallback(
    async (userId: string, reportId: string | null = null) => {
      const response = await callSecureApi<{ session: ChatSession }>("/api/secure/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ userId, reportId }),
      });

      queryClient.setQueryData(QUERY_KEYS.chatSessions(user?.id ?? "", user?.role ?? ""), (prev: ChatSession[] | undefined) => 
        prev ? [response.session, ...prev] : [response.session]
      );
      return response.session;
    },
    [callSecureApi, queryClient, user?.id, user?.role]
  );

  const assignAdminToSession = useCallback(async (sessionId: string, adminId: string) => {
    await supabase
      .from("chat_sessions")
      .update({ assigned_admin_id: adminId })
      .eq("id", sessionId);

    queryClient.setQueryData(QUERY_KEYS.chatSessions(user?.id ?? "", user?.role ?? ""), (prev: ChatSession[] | undefined) => 
      prev?.map((s) => s.id === sessionId ? { ...s, assigned_admin_id: adminId } : s)
    );
  }, [queryClient, user?.id, user?.role]);

  const closeChatSession = useCallback(
    async (sessionId: string) => {
      const response = await callSecureApi<{ closed_at: string }>(`/api/secure/chat/sessions/${sessionId}/close`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      queryClient.setQueryData(QUERY_KEYS.chatSessions(user?.id ?? "", user?.role ?? ""), (prev: ChatSession[] | undefined) => 
        prev?.map((s) => s.id === sessionId ? { ...s, status: "CLOSED" as const, closed_at: response.closed_at } : s)
      );
    },
    [callSecureApi, queryClient, user?.id, user?.role]
  );

  const addChatMessage = useCallback(
    async (
      sessionId: string,
      senderId: string,
      content: string,
      type: ChatMessageType = "TEXT",
      mediaUrl?: string,
      mediaName?: string
    ) => {
      void senderId;

      const response = await callSecureApi<{ message: ChatMessage }>("/api/secure/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          content,
          type,
          mediaUrl,
          mediaName,
        }),
      });

      queryClient.invalidateQueries({ queryKey: ["chatMessages"] });
      return response.message;
    },
    [callSecureApi, queryClient]
  );

  const markMessagesRead = useCallback(async (sessionId: string, readerId: string) => {
    const now = new Date().toISOString();

    await supabase
      .from("chat_messages")
      .update({ is_read: true, read_at: now })
      .eq("session_id", sessionId)
      .neq("sender_id", readerId)
      .eq("is_read", false);

    queryClient.invalidateQueries({ queryKey: ["chatMessages"] });
  }, [queryClient]);

  const updateAvailability = useCallback(async (adminUserId: string, status: AvailabilityStatus) => {
    await supabase
      .from("admin_profiles")
      .update({ availability_status: status })
      .eq("user_id", adminUserId);

    queryClient.setQueryData(QUERY_KEYS.adminProfiles, (prev: AdminProfile[] | undefined) => 
      prev?.map((p) => p.user_id === adminUserId ? { ...p, availability_status: status } : p)
    );
  }, [queryClient]);

  const addAdminProfile = useCallback(async (profile: AdminProfile) => {
    await supabase.from("admin_profiles").upsert({
      user_id: profile.user_id,
      display_name: profile.display_name,
      jabatan_display: profile.jabatan_display,
      availability_status: profile.availability_status,
      wa_number: profile.wa_number,
    });

    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminProfiles });
  }, [queryClient]);

  const removeAdminProfile = useCallback(async (userId: string) => {
    await supabase
      .from("admin_profiles")
      .delete()
      .eq("user_id", userId);

    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminProfiles });
  }, [queryClient]);

  const addAppointment = useCallback(
    async (userId: string, targetAdminId: string) => {
      void userId;

      const response = await callSecureApi<{ appointment: Appointment }>("/api/secure/appointments", {
        method: "POST",
        body: JSON.stringify({ targetAdminId }),
      });

      queryClient.setQueryData(QUERY_KEYS.appointments(user?.id ?? "", user?.role ?? ""), (prev: Appointment[] | undefined) => 
        prev ? [response.appointment, ...prev] : [response.appointment]
      );

      return response.appointment;
    },
    [callSecureApi, queryClient, user?.id, user?.role]
  );

  const updateAppointmentStatus = useCallback(
    async (appointmentId: string, status: AppointmentStatus, statusNote?: string) => {
      const response = await callSecureApi<{ appointment: Appointment }>("/api/secure/appointments", {
        method: "PATCH",
        body: JSON.stringify({ appointmentId, status, statusNote }),
      });

      queryClient.setQueryData(QUERY_KEYS.appointments(user?.id ?? "", user?.role ?? ""), (prev: Appointment[] | undefined) => 
        prev?.map((a) => a.id === appointmentId ? response.appointment : a)
      );
    },
    [callSecureApi, queryClient, user?.id, user?.role],
  );

  const markNotificationRead = useCallback(async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    queryClient.setQueryData(QUERY_KEYS.notifications(user?.id ?? ""), (prev: Notification[] | undefined) => 
      prev?.map((n) => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  }, [queryClient, user?.id]);

  const markAllNotificationsRead = useCallback(async (userId: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId);

    queryClient.setQueryData(QUERY_KEYS.notifications(userId), (prev: Notification[] | undefined) => 
      prev?.map((n) => ({ ...n, is_read: true }))
    );
  }, [queryClient]);

  const getUnreadCount = useCallback(
    (userId: string) => (notificationsQuery.data ?? []).filter((n) => n.user_id === userId && !n.is_read).length,
    [notificationsQuery.data]
  );


  return (
    <DataContext.Provider
      value={{
        isBusy,
        dataLoadIssues,
        lastSyncedAt,
        reloadData,
        reports, statusHistory, addReport, updateReportStatus, updateReportUrgency, updateReportNotes,
        chatSessions, chatMessages, createChatSession, assignAdminToSession, closeChatSession, addChatMessage, markMessagesRead,
        adminProfiles, updateAvailability, addAdminProfile, removeAdminProfile,
        appointments, addAppointment, updateAppointmentStatus,
        notifications, addNotification, markNotificationRead, markAllNotificationsRead, getUnreadCount,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
