-- Protect chat history from accidental or application-level hard deletion.
-- Apply this migration before deploying the matching application changes.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Preserve participant identity even after an account is removed.
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS user_name_snapshot text,
  ADD COLUMN IF NOT EXISTS assigned_admin_name_snapshot text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid,
  ADD COLUMN IF NOT EXISTS hidden_by_name_snapshot text,
  ADD COLUMN IF NOT EXISTS hidden_reason text;

ALTER TABLE public.chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_hidden_only_when_closed;

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_hidden_only_when_closed
  CHECK (hidden_at IS NULL OR status = 'CLOSED');

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sender_name_snapshot text;

-- Keep notification visibility synchronized with soft-hidden chat sessions.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.chat_sessions cs
SET user_name_snapshot = u.name
FROM public.users u
WHERE cs.user_id = u.id
  AND cs.user_name_snapshot IS NULL;

UPDATE public.chat_sessions cs
SET assigned_admin_name_snapshot = COALESCE(ap.display_name, u.name)
FROM public.users u
LEFT JOIN public.admin_profiles ap ON ap.user_id = u.id
WHERE cs.assigned_admin_id = u.id
  AND cs.assigned_admin_name_snapshot IS NULL;

UPDATE public.chat_messages cm
SET sender_name_snapshot = u.name
FROM public.users u
WHERE cm.sender_id = u.id
  AND cm.sender_name_snapshot IS NULL;

CREATE OR REPLACE FUNCTION public.fill_chat_session_identity_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_name_snapshot IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT u.name INTO NEW.user_name_snapshot
    FROM public.users u
    WHERE u.id = NEW.user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(ap.display_name, u.name)
    INTO NEW.assigned_admin_name_snapshot
    FROM public.users u
    LEFT JOIN public.admin_profiles ap ON ap.user_id = u.id
    WHERE u.id = NEW.assigned_admin_id;
  ELSIF NEW.assigned_admin_id IS DISTINCT FROM OLD.assigned_admin_id
        OR NEW.assigned_admin_name_snapshot IS NULL THEN
    SELECT COALESCE(ap.display_name, u.name)
    INTO NEW.assigned_admin_name_snapshot
    FROM public.users u
    LEFT JOIN public.admin_profiles ap ON ap.user_id = u.id
    WHERE u.id = NEW.assigned_admin_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_chat_session_identity_snapshots ON public.chat_sessions;
CREATE TRIGGER trg_fill_chat_session_identity_snapshots
BEFORE INSERT OR UPDATE OF user_id, assigned_admin_id ON public.chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.fill_chat_session_identity_snapshots();

CREATE OR REPLACE FUNCTION public.fill_chat_message_identity_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_name_snapshot IS NULL AND NEW.sender_id IS NOT NULL THEN
    SELECT u.name INTO NEW.sender_name_snapshot
    FROM public.users u
    WHERE u.id = NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_chat_message_identity_snapshot ON public.chat_messages;
CREATE TRIGGER trg_fill_chat_message_identity_snapshot
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.fill_chat_message_identity_snapshot();

-- A report or account may be removed, but its chat history must survive.
ALTER TABLE public.chat_sessions
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN assigned_admin_id DROP NOT NULL;

ALTER TABLE public.chat_messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_report_id_fkey,
  DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_chat_sessions_user,
  DROP CONSTRAINT IF EXISTS chat_sessions_assigned_admin_id_fkey,
  DROP CONSTRAINT IF EXISTS chat_sessions_created_by_fkey,
  DROP CONSTRAINT IF EXISTS chat_sessions_hidden_by_fkey;

ALTER TABLE public.chat_sessions
  ADD CONSTRAINT chat_sessions_report_id_fkey
    FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE SET NULL,
  ADD CONSTRAINT chat_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chat_sessions_assigned_admin_id_fkey
    FOREIGN KEY (assigned_admin_id) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chat_sessions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT chat_sessions_hidden_by_fkey
    FOREIGN KEY (hidden_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_visible_created
  ON public.chat_sessions(created_at DESC)
  WHERE hidden_at IS NULL;

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_session_id_fkey,
  DROP CONSTRAINT IF EXISTS fk_chat_messages_session,
  DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT chat_messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Append-only audit trail for every lifecycle transition.
CREATE TABLE IF NOT EXISTS public.chat_session_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE RESTRICT,
  actor_user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_name_snapshot text NOT NULL DEFAULT 'System',
  event_type          text NOT NULL CHECK (event_type IN (
    'MIGRATED', 'CREATED', 'ASSIGNED', 'CLOSED', 'HIDDEN', 'RESTORED',
    'DELETE_BLOCKED', 'REPORT_DETACHED', 'RECOVERED'
  )),
  old_status          text,
  new_status          text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_session_events_session_created
  ON public.chat_session_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_session_events_actor
  ON public.chat_session_events(actor_user_id, created_at DESC);

INSERT INTO public.chat_session_events (
  session_id,
  actor_name_snapshot,
  event_type,
  new_status,
  metadata,
  created_at
)
SELECT
  cs.id,
  'System Migration',
  'MIGRATED',
  cs.status,
  jsonb_build_object('reason', 'Initial retention audit snapshot'),
  now()
FROM public.chat_sessions cs
WHERE NOT EXISTS (
  SELECT 1
  FROM public.chat_session_events e
  WHERE e.session_id = cs.id
    AND e.event_type = 'MIGRATED'
);

CREATE OR REPLACE FUNCTION public.audit_new_chat_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
BEGIN
  SELECT u.name INTO v_actor_name
  FROM public.users u
  WHERE u.id = NEW.created_by;

  INSERT INTO public.chat_session_events (
    session_id, actor_user_id, actor_name_snapshot,
    event_type, new_status, metadata, created_at
  ) VALUES (
    NEW.id, NEW.created_by, COALESCE(v_actor_name, NEW.user_name_snapshot, 'System'),
    'CREATED', NEW.status,
    jsonb_build_object('report_id', NEW.report_id), NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_new_chat_session ON public.chat_sessions;
CREATE TRIGGER trg_audit_new_chat_session
AFTER INSERT ON public.chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_new_chat_session();

CREATE OR REPLACE FUNCTION public.assign_chat_session_retained(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_actor_name text
)
RETURNS public.chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.chat_sessions;
  v_after public.chat_sessions;
  v_actor_name text;
  v_actor_role text;
BEGIN
  SELECT u.name, u.role INTO v_actor_name, v_actor_role
  FROM public.users u
  WHERE u.id = p_actor_user_id;

  IF NOT FOUND OR v_actor_role NOT IN ('PH', 'HR') THEN
    RAISE EXCEPTION 'CHAT_ACTOR_NOT_AUTHORIZED_TO_ASSIGN';
  END IF;

  SELECT * INTO v_before
  FROM public.chat_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAT_SESSION_NOT_FOUND';
  END IF;

  IF v_before.status = 'CLOSED' THEN
    RAISE EXCEPTION 'CHAT_SESSION_ALREADY_CLOSED';
  END IF;

  PERFORM set_config('halo_psdm.chat_transition_authorized', 'on', true);

  UPDATE public.chat_sessions
  SET assigned_admin_id = p_actor_user_id,
      assigned_admin_name_snapshot = COALESCE(v_actor_name, p_actor_name)
  WHERE id = p_session_id
  RETURNING * INTO v_after;

  IF v_before.assigned_admin_id IS DISTINCT FROM p_actor_user_id THEN
    INSERT INTO public.chat_session_events (
      session_id, actor_user_id, actor_name_snapshot,
      event_type, old_status, new_status, metadata
    ) VALUES (
      p_session_id, p_actor_user_id, COALESCE(v_actor_name, p_actor_name),
      'ASSIGNED', v_before.status, v_after.status,
      jsonb_build_object('previous_admin_id', v_before.assigned_admin_id)
    );
  END IF;

  PERFORM set_config('halo_psdm.chat_transition_authorized', 'off', true);

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_chat_session_retained(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_actor_name text
)
RETURNS public.chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.chat_sessions;
  v_after public.chat_sessions;
  v_actor_name text;
  v_actor_role text;
BEGIN
  SELECT u.name, u.role INTO v_actor_name, v_actor_role
  FROM public.users u
  WHERE u.id = p_actor_user_id;

  IF NOT FOUND OR v_actor_role NOT IN ('PH', 'HR') THEN
    RAISE EXCEPTION 'CHAT_ACTOR_NOT_AUTHORIZED_TO_CLOSE';
  END IF;

  SELECT * INTO v_before
  FROM public.chat_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAT_SESSION_NOT_FOUND';
  END IF;

  IF v_before.status = 'CLOSED' THEN
    RETURN v_before;
  END IF;

  IF v_before.assigned_admin_id IS DISTINCT FROM p_actor_user_id THEN
    RAISE EXCEPTION 'CHAT_SESSION_NOT_ASSIGNED_TO_ACTOR';
  END IF;

  PERFORM set_config('halo_psdm.chat_transition_authorized', 'on', true);

  UPDATE public.chat_sessions
  SET status = 'CLOSED', closed_at = now()
  WHERE id = p_session_id
  RETURNING * INTO v_after;

  INSERT INTO public.chat_session_events (
    session_id, actor_user_id, actor_name_snapshot,
    event_type, old_status, new_status
  ) VALUES (
    p_session_id, p_actor_user_id, COALESCE(v_actor_name, p_actor_name),
    'CLOSED', v_before.status, v_after.status
  );

  PERFORM set_config('halo_psdm.chat_transition_authorized', 'off', true);

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.hide_chat_session_retained(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_actor_name text,
  p_reason text DEFAULT 'Hidden from frontend'
)
RETURNS public.chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.chat_sessions;
  v_after public.chat_sessions;
  v_actor_name text;
  v_actor_role text;
BEGIN
  SELECT u.name, u.role INTO v_actor_name, v_actor_role
  FROM public.users u
  WHERE u.id = p_actor_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAT_ACTOR_NOT_FOUND';
  END IF;

  SELECT * INTO v_before
  FROM public.chat_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAT_SESSION_NOT_FOUND';
  END IF;

  IF v_before.status <> 'CLOSED' THEN
    RAISE EXCEPTION 'CHAT_SESSION_MUST_BE_CLOSED_BEFORE_HIDE';
  END IF;

  IF v_before.user_id IS DISTINCT FROM p_actor_user_id
     AND v_before.assigned_admin_id IS DISTINCT FROM p_actor_user_id
     AND v_actor_role NOT IN ('PH', 'HR') THEN
    RAISE EXCEPTION 'CHAT_ACTOR_NOT_AUTHORIZED_TO_HIDE';
  END IF;

  IF v_before.hidden_at IS NOT NULL THEN
    RETURN v_before;
  END IF;

  PERFORM set_config('halo_psdm.chat_transition_authorized', 'on', true);

  UPDATE public.chat_sessions
  SET hidden_at = now(),
      hidden_by = p_actor_user_id,
      hidden_by_name_snapshot = COALESCE(v_actor_name, p_actor_name),
      hidden_reason = p_reason
  WHERE id = p_session_id
  RETURNING * INTO v_after;

  INSERT INTO public.chat_session_events (
    session_id, actor_user_id, actor_name_snapshot,
    event_type, old_status, new_status, metadata
  ) VALUES (
    p_session_id, p_actor_user_id, COALESCE(v_actor_name, p_actor_name),
    'HIDDEN', v_before.status, v_after.status,
    jsonb_build_object('reason', p_reason, 'actor_role', v_actor_role)
  );

  UPDATE public.notifications
  SET archived_at = now(),
      is_read = true
  WHERE session_id = p_session_id
    AND archived_at IS NULL;

  PERFORM set_config('halo_psdm.chat_transition_authorized', 'off', true);
  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_chat_session_retained(
  p_session_id uuid,
  p_actor_user_id uuid,
  p_actor_name text
)
RETURNS public.chat_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.chat_sessions;
  v_after public.chat_sessions;
  v_actor_name text;
  v_actor_role text;
BEGIN
  SELECT u.name, u.role INTO v_actor_name, v_actor_role
  FROM public.users u
  WHERE u.id = p_actor_user_id;

  IF NOT FOUND OR v_actor_role NOT IN ('PH', 'HR') THEN
    RAISE EXCEPTION 'CHAT_ACTOR_NOT_AUTHORIZED_TO_RESTORE';
  END IF;

  SELECT * INTO v_before
  FROM public.chat_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHAT_SESSION_NOT_FOUND';
  END IF;

  IF v_before.hidden_at IS NULL THEN
    RETURN v_before;
  END IF;

  PERFORM set_config('halo_psdm.chat_transition_authorized', 'on', true);

  UPDATE public.chat_sessions
  SET hidden_at = NULL,
      hidden_by = NULL,
      hidden_by_name_snapshot = NULL,
      hidden_reason = NULL
  WHERE id = p_session_id
  RETURNING * INTO v_after;

  INSERT INTO public.chat_session_events (
    session_id, actor_user_id, actor_name_snapshot,
    event_type, old_status, new_status, metadata
  ) VALUES (
    p_session_id, p_actor_user_id, COALESCE(v_actor_name, p_actor_name),
    'RESTORED', v_before.status, v_after.status,
    jsonb_build_object(
      'previous_hidden_at', v_before.hidden_at,
      'previous_hidden_by', v_before.hidden_by
    )
  );

  UPDATE public.notifications
  SET archived_at = NULL
  WHERE session_id = p_session_id
    AND archived_at IS NOT NULL;

  PERFORM set_config('halo_psdm.chat_transition_authorized', 'off', true);
  RETURN v_after;
END;
$$;

-- Status and assignment may only change through the audited functions above.
CREATE OR REPLACE FUNCTION public.prevent_unaudited_chat_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('halo_psdm.chat_transition_authorized', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'CHAT_TRANSITION_REQUIRES_AUDITED_FUNCTION';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unaudited_chat_transition ON public.chat_sessions;
CREATE TRIGGER trg_prevent_unaudited_chat_transition
BEFORE UPDATE OF status, assigned_admin_id, hidden_at, hidden_by ON public.chat_sessions
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.assigned_admin_id IS DISTINCT FROM NEW.assigned_admin_id
  OR OLD.hidden_at IS DISTINCT FROM NEW.hidden_at
  OR OLD.hidden_by IS DISTINCT FROM NEW.hidden_by
)
EXECUTE FUNCTION public.prevent_unaudited_chat_transition();

-- Backfill real session references that were previously stored only in URL strings.
UPDATE public.notifications n
SET session_id = cs.id
FROM public.chat_sessions cs
WHERE n.session_id IS NULL
  AND cs.id::text = COALESCE(
    substring(
      COALESCE(NULLIF(n.link, ''), n.payload ->> 'link')
      FROM 'session=([0-9a-fA-F-]{36})'
    ),
    substring(
      COALESCE(NULLIF(n.link, ''), n.payload ->> 'link')
      FROM '/chat/([0-9a-fA-F-]{36})'
    )
  );

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_session_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_notifications_session_id
  ON public.notifications(session_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_visible_created
  ON public.notifications(user_id, created_at DESC)
  WHERE archived_at IS NULL;

-- Last line of defense: no role, including service routes, can hard-delete history.
CREATE OR REPLACE FUNCTION public.prevent_chat_history_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'CHAT_HISTORY_IMMUTABLE: close/archive the session instead of deleting it';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_chat_session_delete ON public.chat_sessions;
CREATE TRIGGER trg_prevent_chat_session_delete
BEFORE DELETE ON public.chat_sessions
FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_history_delete();

DROP TRIGGER IF EXISTS trg_prevent_chat_message_delete ON public.chat_messages;
CREATE TRIGGER trg_prevent_chat_message_delete
BEFORE DELETE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_history_delete();

CREATE OR REPLACE FUNCTION public.prevent_chat_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'CHAT_AUDIT_IMMUTABLE: audit events cannot be changed or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_chat_event_mutation ON public.chat_session_events;
CREATE TRIGGER trg_prevent_chat_event_mutation
BEFORE UPDATE OR DELETE ON public.chat_session_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_event_mutation();

ALTER TABLE public.chat_session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_session_events_select_participants ON public.chat_session_events;
CREATE POLICY chat_session_events_select_participants
ON public.chat_session_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_sessions cs
    WHERE cs.id = chat_session_events.session_id
      AND (
        cs.user_id = auth.uid()
        OR cs.assigned_admin_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.role IN ('PH', 'HR')
        )
      )
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.chat_sessions FROM anon, authenticated;
REVOKE INSERT, DELETE ON public.chat_messages FROM anon, authenticated;
REVOKE UPDATE ON public.chat_messages FROM anon, authenticated;
GRANT UPDATE (is_read, read_at) ON public.chat_messages TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.chat_session_events FROM anon, authenticated;
GRANT SELECT ON public.chat_session_events TO authenticated;

REVOKE ALL ON FUNCTION public.assign_chat_session_retained(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_chat_session_retained(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hide_chat_session_retained(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_chat_session_retained(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_chat_session_retained(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_chat_session_retained(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hide_chat_session_retained(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_chat_session_retained(uuid, uuid, text) TO service_role;

COMMENT ON TABLE public.chat_session_events IS
  'Append-only audit trail for retained chat lifecycle events.';
COMMENT ON FUNCTION public.prevent_chat_history_delete() IS
  'Database-level guard that makes chat sessions and messages immutable against DELETE.';

COMMIT;
