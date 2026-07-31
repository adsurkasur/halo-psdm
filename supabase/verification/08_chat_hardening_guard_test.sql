-- Safe destructive-guard test.
-- Every attempted mutation runs inside an exception subtransaction and is rolled back.

DO $$
DECLARE
  v_session_id uuid;
  v_session_status text;
  v_message_id uuid;
  v_event_id uuid;
BEGIN
  SELECT id, status INTO v_session_id, v_session_status
  FROM public.chat_sessions
  ORDER BY created_at
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.chat_sessions WHERE id = v_session_id;
      RAISE EXCEPTION 'GUARD_TEST_FAILED: chat session delete succeeded';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CHAT_HISTORY_IMMUTABLE:%' THEN
        RAISE;
      END IF;
    END;

    BEGIN
      IF v_session_status = 'OPEN' THEN
        UPDATE public.chat_sessions SET status = 'CLOSED' WHERE id = v_session_id;
      ELSE
        UPDATE public.chat_sessions SET status = 'OPEN' WHERE id = v_session_id;
      END IF;
      RAISE EXCEPTION 'GUARD_TEST_FAILED: unaudited status update succeeded';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CHAT_TRANSITION_REQUIRES_AUDITED_FUNCTION%' THEN
        RAISE;
      END IF;
    END;
  END IF;

  SELECT id INTO v_message_id
  FROM public.chat_messages
  ORDER BY created_at
  LIMIT 1;

  IF v_message_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.chat_messages WHERE id = v_message_id;
      RAISE EXCEPTION 'GUARD_TEST_FAILED: chat message delete succeeded';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CHAT_HISTORY_IMMUTABLE:%' THEN
        RAISE;
      END IF;
    END;
  END IF;

  SELECT id INTO v_event_id
  FROM public.chat_session_events
  ORDER BY created_at
  LIMIT 1;

  IF v_event_id IS NOT NULL THEN
    BEGIN
      DELETE FROM public.chat_session_events WHERE id = v_event_id;
      RAISE EXCEPTION 'GUARD_TEST_FAILED: audit event delete succeeded';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CHAT_AUDIT_IMMUTABLE:%' THEN
        RAISE;
      END IF;
    END;
  END IF;
END;
$$;

SELECT
  true AS passed,
  'Hard delete, unaudited transition, and audit mutation were blocked; no row was changed.' AS result;
