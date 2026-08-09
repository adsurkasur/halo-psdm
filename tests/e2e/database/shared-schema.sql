


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."can_insert_admin_profile"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('HR', 'PH')
  );
$$;


ALTER FUNCTION "public"."can_insert_admin_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_app_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."current_app_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_auth_user_email_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.users
  set email = new.email
  where id = new.id::text;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_auth_user_email_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  raw_name text;
  raw_biro text;
  raw_jabatan text;
begin
  raw_name := coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'User'), '@', 1));
  raw_biro := coalesce(new.raw_user_meta_data ->> 'biro', 'INFOKOM');
  raw_jabatan := coalesce(new.raw_user_meta_data ->> 'jabatan', 'ANGGOTA_MUDA');

  begin
    insert into public.users (
      id,
      name,
      biro,
      jabatan,
      role,
      email,
      is_active,
      created_at
    )
    values (
      new.id::text,
      raw_name,
      raw_biro,
      raw_jabatan,
      'SENDER',
      new.email,
      true,
      now()
    )
    on conflict (id) do update
      set email = excluded.email,
          name = coalesce(public.users.name, excluded.name);
  exception when others then
    -- Never block auth signup if profile bootstrap fails.
    null;
  end;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'Returns true if the current authenticated user has admin role';



CREATE OR REPLACE FUNCTION "public"."sync_admin_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if the user exists in the admin_profiles table
  IF EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = NEW.id) THEN
    -- Update the admin_profiles row with the fresh data from the users table
    UPDATE public.admin_profiles 
    SET 
      display_name = NEW.name,
      wa_number = NEW.whatsapp,
      -- Map the exact enum values from the users table to the human-readable display labels
      jabatan_display = CASE NEW.jabatan 
        WHEN 'PENGURUS_HARIAN' THEN 'Pengurus Harian'
        WHEN 'STAF_AHLI' THEN 'Staf Ahli'
        WHEN 'STAF' THEN 'Staf'
        WHEN 'ANGGOTA_MUDA' THEN 'Anggota Muda'
        ELSE NEW.jabatan
      END,
      updated_at = now()
    WHERE user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_admin_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_reporter_identity_snapshot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Jika reporter_name belum diisi dari frontend, ambil langsung dari tabel users
  IF NEW.reporter_name IS NULL OR NEW.reporter_name = '' THEN
    SELECT name, email, whatsapp 
    INTO NEW.reporter_name, NEW.reporter_email, NEW.reporter_whatsapp
    FROM public.users
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_reporter_identity_snapshot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_whatsapp_to_auth_phone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp <> '' AND (OLD IS NULL OR OLD.whatsapp IS DISTINCT FROM NEW.whatsapp) THEN
    BEGIN
      UPDATE auth.users
      SET phone = NEW.whatsapp
      WHERE id = NEW.id
        AND (phone IS NULL OR phone <> NEW.whatsapp)
        AND NOT EXISTS (
          SELECT 1 FROM auth.users WHERE phone = NEW.whatsapp AND id <> NEW.id
        );
    EXCEPTION WHEN unique_violation THEN
      -- Jika nomor WhatsApp sudah dipakai oleh user lain di auth.users, abaikan agar transaksi tidak gagal
      RAISE NOTICE 'WhatsApp number % is already used in auth.users by another user.', NEW.whatsapp;
    END;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_whatsapp_to_auth_phone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "jabatan_display" "text" DEFAULT ''::"text" NOT NULL,
    "availability_status" "text" DEFAULT 'OFFLINE'::"text" NOT NULL,
    "wa_number" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "target_admin_id" "uuid",
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "status_note" "text",
    "handled_by" "uuid",
    "handled_at" timestamp with time zone,
    "wa_redirect_logged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "type" "text" DEFAULT 'TEXT'::"text" NOT NULL,
    "media_url" "text",
    "media_name" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid",
    "user_id" "uuid",
    "assigned_admin_id" "uuid",
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone
);


ALTER TABLE "public"."chat_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."key_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "actor_name" "text" NOT NULL,
    "actor_user_id" "uuid",
    "from_holder" "text",
    "to_holder" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."key_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."key_status" (
    "id" integer NOT NULL,
    "status" "text" DEFAULT 'satpam'::"text" NOT NULL,
    "holder_name" "text",
    "holder_user_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."key_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "title" "text",
    "message" "text",
    "link" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rapor_access_codes" (
    "member_code" "text" NOT NULL,
    "release_code" "text" NOT NULL,
    "access_code_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rapor_access_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rapor_members" (
    "member_code" "text" NOT NULL,
    "release_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "jabatan" "text" NOT NULL,
    "status_penilaian" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rapor_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rapor_payloads" (
    "member_code" "text" NOT NULL,
    "release_code" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "sync_status" "text" DEFAULT 'ready'::"text" NOT NULL,
    "sync_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rapor_payloads_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['ready'::"text", 'incomplete'::"text"])))
);


ALTER TABLE "public"."rapor_payloads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rapor_releases" (
    "release_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "period" "text" NOT NULL,
    "status" "text" DEFAULT 'staging'::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rapor_releases_status_check" CHECK (("status" = ANY (ARRAY['staging'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."rapor_releases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rapor_sync_runs" (
    "run_id" "text" NOT NULL,
    "release_code" "text" NOT NULL,
    "status" "text" NOT NULL,
    "total_members" integer DEFAULT 0 NOT NULL,
    "sync_type" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rapor_sync_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "changed_by" "uuid",
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "text" NOT NULL,
    "user_id" "uuid",
    "category" "text" NOT NULL,
    "urgency" "text" DEFAULT 'NORMAL'::"text" NOT NULL,
    "kronologi" "text" NOT NULL,
    "status" "text" DEFAULT 'RECEIVED'::"text" NOT NULL,
    "admin_notes" "text" DEFAULT ''::"text" NOT NULL,
    "attachment_url" "text",
    "attachment_name" "text",
    "attachment_path" "text",
    "attachment_mime" "text",
    "attachment_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reporter_name" "text",
    "reporter_email" "text",
    "reporter_whatsapp" "text"
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "biro" "text" DEFAULT ''::"text" NOT NULL,
    "jabatan" "text" DEFAULT ''::"text" NOT NULL,
    "role" "text" DEFAULT 'MEMBER'::"text" NOT NULL,
    "avatar_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "whatsapp" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."key_log"
    ADD CONSTRAINT "key_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."key_status"
    ADD CONSTRAINT "key_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rapor_access_codes"
    ADD CONSTRAINT "rapor_access_codes_pkey" PRIMARY KEY ("member_code");



ALTER TABLE ONLY "public"."rapor_access_codes"
    ADD CONSTRAINT "rapor_access_codes_release_hash_key" UNIQUE ("release_code", "access_code_hash");



ALTER TABLE ONLY "public"."rapor_members"
    ADD CONSTRAINT "rapor_members_pkey" PRIMARY KEY ("member_code");



ALTER TABLE ONLY "public"."rapor_payloads"
    ADD CONSTRAINT "rapor_payloads_pkey" PRIMARY KEY ("member_code");



ALTER TABLE ONLY "public"."rapor_releases"
    ADD CONSTRAINT "rapor_releases_pkey" PRIMARY KEY ("release_code");



ALTER TABLE ONLY "public"."rapor_sync_runs"
    ADD CONSTRAINT "rapor_sync_runs_pkey" PRIMARY KEY ("run_id");



ALTER TABLE ONLY "public"."report_status_history"
    ADD CONSTRAINT "report_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_case_id_key" UNIQUE ("case_id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_appointments_user_id" ON "public"."appointments" USING "btree" ("user_id");



CREATE INDEX "idx_apt_created_at" ON "public"."appointments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_apt_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "idx_apt_target_admin_id" ON "public"."appointments" USING "btree" ("target_admin_id");



CREATE INDEX "idx_apt_user_id" ON "public"."appointments" USING "btree" ("user_id");



CREATE INDEX "idx_chat_messages_session_id" ON "public"."chat_messages" USING "btree" ("session_id");



CREATE INDEX "idx_chat_sessions_report_id" ON "public"."chat_sessions" USING "btree" ("report_id");



CREATE INDEX "idx_chat_sessions_user_id" ON "public"."chat_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_cm_created_at" ON "public"."chat_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cm_is_read" ON "public"."chat_messages" USING "btree" ("is_read");



CREATE INDEX "idx_cm_sender_id" ON "public"."chat_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_cm_session_id" ON "public"."chat_messages" USING "btree" ("session_id");



CREATE INDEX "idx_cs_assigned_admin_id" ON "public"."chat_sessions" USING "btree" ("assigned_admin_id");



CREATE INDEX "idx_cs_created_at" ON "public"."chat_sessions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cs_status" ON "public"."chat_sessions" USING "btree" ("status");



CREATE INDEX "idx_cs_user_id" ON "public"."chat_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_key_log_actor_user_id" ON "public"."key_log" USING "btree" ("actor_user_id");



CREATE INDEX "idx_key_log_created_at" ON "public"."key_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notif_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notif_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notif_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_rapor_access_codes_hash" ON "public"."rapor_access_codes" USING "btree" ("access_code_hash");



CREATE INDEX "idx_rapor_access_codes_release" ON "public"."rapor_access_codes" USING "btree" ("release_code");



CREATE INDEX "idx_rapor_members_name" ON "public"."rapor_members" USING "btree" ("name");



CREATE INDEX "idx_rapor_members_release_code" ON "public"."rapor_members" USING "btree" ("release_code");



CREATE INDEX "idx_rapor_payloads_jsonb" ON "public"."rapor_payloads" USING "gin" ("payload");



CREATE INDEX "idx_rapor_payloads_release_status" ON "public"."rapor_payloads" USING "btree" ("release_code", "sync_status");



CREATE INDEX "idx_rapor_sync_runs_release_created" ON "public"."rapor_sync_runs" USING "btree" ("release_code", "created_at" DESC);



CREATE INDEX "idx_report_status_history_report_id" ON "public"."report_status_history" USING "btree" ("report_id");



CREATE INDEX "idx_reports_case_id" ON "public"."reports" USING "btree" ("case_id");



CREATE INDEX "idx_reports_created_at" ON "public"."reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reports_status" ON "public"."reports" USING "btree" ("status");



CREATE INDEX "idx_reports_user_id" ON "public"."reports" USING "btree" ("user_id");



CREATE INDEX "idx_rsh_created_at" ON "public"."report_status_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_rsh_report_id" ON "public"."report_status_history" USING "btree" ("report_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_is_active" ON "public"."users" USING "btree" ("is_active");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE OR REPLACE TRIGGER "admin_profiles_updated_at" BEFORE UPDATE ON "public"."admin_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "on_user_profile_update" AFTER UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_admin_profile"();



CREATE OR REPLACE TRIGGER "reports_updated_at" BEFORE UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_whatsapp_to_auth_phone" AFTER INSERT OR UPDATE OF "whatsapp" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_whatsapp_to_auth_phone"();



CREATE OR REPLACE TRIGGER "trigger_sync_reporter_identity" BEFORE INSERT OR UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."sync_reporter_identity_snapshot"();



CREATE OR REPLACE TRIGGER "update_rapor_members_updated_at" BEFORE UPDATE ON "public"."rapor_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rapor_payloads_updated_at" BEFORE UPDATE ON "public"."rapor_payloads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_rapor_releases_updated_at" BEFORE UPDATE ON "public"."rapor_releases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_target_admin_id_fkey" FOREIGN KEY ("target_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_sessions"
    ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."key_log"
    ADD CONSTRAINT "key_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."key_status"
    ADD CONSTRAINT "key_status_holder_user_id_fkey" FOREIGN KEY ("holder_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rapor_access_codes"
    ADD CONSTRAINT "rapor_access_codes_member_code_fkey" FOREIGN KEY ("member_code") REFERENCES "public"."rapor_members"("member_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rapor_access_codes"
    ADD CONSTRAINT "rapor_access_codes_release_code_fkey" FOREIGN KEY ("release_code") REFERENCES "public"."rapor_releases"("release_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rapor_members"
    ADD CONSTRAINT "rapor_members_release_code_fkey" FOREIGN KEY ("release_code") REFERENCES "public"."rapor_releases"("release_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rapor_payloads"
    ADD CONSTRAINT "rapor_payloads_member_code_fkey" FOREIGN KEY ("member_code") REFERENCES "public"."rapor_members"("member_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rapor_payloads"
    ADD CONSTRAINT "rapor_payloads_release_code_fkey" FOREIGN KEY ("release_code") REFERENCES "public"."rapor_releases"("release_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rapor_sync_runs"
    ADD CONSTRAINT "rapor_sync_runs_release_code_fkey" FOREIGN KEY ("release_code") REFERENCES "public"."rapor_releases"("release_code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_status_history"
    ADD CONSTRAINT "report_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."report_status_history"
    ADD CONSTRAINT "report_status_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin_profiles delete" ON "public"."admin_profiles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_profiles" "admin_profiles_1"
  WHERE ("admin_profiles_1"."user_id" = "auth"."uid"()))));



CREATE POLICY "Admin_profiles insert" ON "public"."admin_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."can_insert_admin_profile"()));



CREATE POLICY "Admin_profiles select" ON "public"."admin_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admin_profiles update" ON "public"."admin_profiles" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Appointments insert" ON "public"."appointments" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Appointments select" ON "public"."appointments" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("target_admin_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Appointments update" ON "public"."appointments" FOR UPDATE TO "authenticated" USING ((("target_admin_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Chat_messages insert" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND (("chat_sessions"."user_id" = "auth"."uid"()) OR ("chat_sessions"."assigned_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Chat_messages select" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND (("chat_sessions"."user_id" = "auth"."uid"()) OR ("chat_sessions"."assigned_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Chat_messages update" ON "public"."chat_messages" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."chat_sessions"
  WHERE (("chat_sessions"."id" = "chat_messages"."session_id") AND (("chat_sessions"."user_id" = "auth"."uid"()) OR ("chat_sessions"."assigned_admin_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Chat_sessions insert" ON "public"."chat_sessions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Chat_sessions select" ON "public"."chat_sessions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("assigned_admin_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Chat_sessions update" ON "public"."chat_sessions" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("assigned_admin_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Notifications insert" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Notifications select" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Notifications update" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Public read access for active published releases" ON "public"."rapor_releases" FOR SELECT USING ((("is_active" = true) AND ("status" = 'published'::"text")));



CREATE POLICY "Report_status insert" ON "public"."report_status_history" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Report_status select" ON "public"."report_status_history" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."reports"
  WHERE (("reports"."id" = "report_status_history"."report_id") AND ("reports"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Reports insert" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Reports select" ON "public"."reports" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"())))));



CREATE POLICY "Reports update" ON "public"."reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "Service role full access on rapor_access_codes" ON "public"."rapor_access_codes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on rapor_members" ON "public"."rapor_members" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on rapor_payloads" ON "public"."rapor_payloads" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on rapor_releases" ON "public"."rapor_releases" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access on rapor_sync_runs" ON "public"."rapor_sync_runs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users update access" ON "public"."users" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Users view access" ON "public"."users" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."admin_profiles"
  WHERE ("admin_profiles"."user_id" = "users"."id")))));



ALTER TABLE "public"."admin_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_profiles_insert_ph" ON "public"."admin_profiles" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_app_role"() = 'PH'::"text"));



CREATE POLICY "admin_profiles_update_ph_and_self" ON "public"."admin_profiles" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("public"."current_app_role"() = 'PH'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR ("public"."current_app_role"() = 'PH'::"text")));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."key_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "key_log_insert" ON "public"."key_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "key_log_read" ON "public"."key_log" FOR SELECT USING (true);



ALTER TABLE "public"."key_status" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "key_status_read" ON "public"."key_status" FOR SELECT USING (true);



CREATE POLICY "key_status_write" ON "public"."key_status" USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rapor_access_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rapor_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rapor_payloads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rapor_releases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rapor_sync_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_admin_and_self" ON "public"."users" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR ("public"."current_app_role"() = ANY (ARRAY['PH'::"text", 'HR'::"text"]))));



CREATE POLICY "users_update_admin_and_self" ON "public"."users" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR ("public"."current_app_role"() = 'PH'::"text"))) WITH CHECK ((("id" = "auth"."uid"()) OR ("public"."current_app_role"() = 'PH'::"text")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."can_insert_admin_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."can_insert_admin_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_insert_admin_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_app_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_app_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_auth_user_email_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_auth_user_email_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_auth_user_email_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_admin_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_admin_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_admin_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_reporter_identity_snapshot"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_reporter_identity_snapshot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_reporter_identity_snapshot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_whatsapp_to_auth_phone"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_whatsapp_to_auth_phone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_whatsapp_to_auth_phone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_profiles" TO "anon";
GRANT ALL ON TABLE "public"."admin_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_sessions" TO "anon";
GRANT ALL ON TABLE "public"."chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."key_log" TO "anon";
GRANT ALL ON TABLE "public"."key_log" TO "authenticated";
GRANT ALL ON TABLE "public"."key_log" TO "service_role";



GRANT ALL ON TABLE "public"."key_status" TO "anon";
GRANT ALL ON TABLE "public"."key_status" TO "authenticated";
GRANT ALL ON TABLE "public"."key_status" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."rapor_access_codes" TO "anon";
GRANT ALL ON TABLE "public"."rapor_access_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."rapor_access_codes" TO "service_role";



GRANT ALL ON TABLE "public"."rapor_members" TO "anon";
GRANT ALL ON TABLE "public"."rapor_members" TO "authenticated";
GRANT ALL ON TABLE "public"."rapor_members" TO "service_role";



GRANT ALL ON TABLE "public"."rapor_payloads" TO "anon";
GRANT ALL ON TABLE "public"."rapor_payloads" TO "authenticated";
GRANT ALL ON TABLE "public"."rapor_payloads" TO "service_role";



GRANT ALL ON TABLE "public"."rapor_releases" TO "anon";
GRANT ALL ON TABLE "public"."rapor_releases" TO "authenticated";
GRANT ALL ON TABLE "public"."rapor_releases" TO "service_role";



GRANT ALL ON TABLE "public"."rapor_sync_runs" TO "anon";
GRANT ALL ON TABLE "public"."rapor_sync_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."rapor_sync_runs" TO "service_role";



GRANT ALL ON TABLE "public"."report_status_history" TO "anon";
GRANT ALL ON TABLE "public"."report_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."report_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







