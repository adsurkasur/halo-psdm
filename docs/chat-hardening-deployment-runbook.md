# Runbook: Backup and Chat Hardening Migration

## Safety gate

Do not execute migration `08_chat_history_retention_and_audit.sql` until the backup is verified and the pre-check result has been reviewed. Do not send a database password, connection string, dump file, access token, or service-role key through chat.

## 1. Confirm the managed Supabase recovery point

1. Open the correct project in Supabase Dashboard.
2. Open **Database > Backups**.
3. Record the newest available backup or PITR recovery-point time.
4. Confirm the project reference matches the production application.

Managed backups may not be recent enough for an immediate migration rollback. Create a manual logical dump as the second backup layer.

Official references:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

Database backups do not contain the actual objects in Supabase Storage. The chat migration does not delete Storage objects, but critical media should have a separate Storage backup policy.

## 2. Create a manual logical backup

On this workstation, Docker Desktop is installed but must be running. Supabase CLI can be invoked through `npx`.

### Simplest option for the Free plan

Run the prepared helper from PowerShell:

```powershell
Set-Location -LiteralPath 'F:\My Files\ARSC\halo-psdm'
powershell -ExecutionPolicy Bypass -File '.\tools\backup-supabase-free-plan.ps1'
```

The script asks for the connection string with hidden input, creates the three official dump files outside the repository, verifies that they are non-empty, and prints their SHA-256 hashes. Continue with the manual commands below only if the helper cannot be used.

1. Start Docker Desktop and wait until its engine reports that it is running.
2. In Supabase Dashboard, click **Connect** and copy the **Session pooler** connection string. Use the direct connection only when the network supports IPv6.
3. Replace the password placeholder locally. URL-encode special characters in the password.
4. Open PowerShell and run:

```powershell
Set-Location -LiteralPath 'F:\My Files\ARSC\halo-psdm'

$backupDir = 'F:\My Files\ARSC\halo-psdm-private-backups\2026-07-31-pre-chat-hardening'
New-Item -ItemType Directory -Force -Path $backupDir

$env:HALO_PSDM_DB_URL = 'PASTE_CONNECTION_STRING_HERE'

npx supabase@latest db dump --db-url $env:HALO_PSDM_DB_URL -f "$backupDir\roles.sql" --role-only
npx supabase@latest db dump --db-url $env:HALO_PSDM_DB_URL -f "$backupDir\schema.sql"
npx supabase@latest db dump --db-url $env:HALO_PSDM_DB_URL -f "$backupDir\data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"

Remove-Item Env:\HALO_PSDM_DB_URL

Get-ChildItem -LiteralPath $backupDir | Select-Object Name, Length, LastWriteTime
Get-ChildItem -LiteralPath $backupDir -File | Get-FileHash -Algorithm SHA256 | Select-Object Path, Hash
```

All three dump commands must exit successfully. `roles.sql`, `schema.sql`, and `data.sql` must exist and have a non-zero size. Keep this directory outside the repository and restrict access because `data.sql` contains production data.

## 3. Run the read-only pre-check

1. Open **SQL Editor > New query** in the production project.
2. Copy and run the entire file `supabase/verification/08_chat_hardening_precheck.sql`.
3. Copy all ten result rows.
4. Stop here and send:
   - managed backup/PITR timestamp;
   - dump filenames, sizes, and SHA-256 hashes only;
   - all pre-check result rows.

## 4. Migration, after approval

1. Choose a quiet period and prevent chat/report writes for approximately 5–10 minutes.
2. Open a new SQL Editor query.
3. Copy the complete `supabase/migrations/08_chat_history_retention_and_audit.sql` file, from `BEGIN;` through `COMMIT;`.
4. Run it once.
5. If any error appears, do not run fragments or manually edit production objects. Copy the complete error and run the post-check to determine whether the transaction committed.

The migration uses one transaction, a five-second lock timeout, and a sixty-second statement timeout. A normal error before `COMMIT` rolls the migration back as a unit.

## 5. Verify after migration

1. Run `supabase/verification/08_chat_hardening_postcheck.sql`.
2. Every check except the informational `summary_counts_after` row must show `passed = true`.
3. Compare `chat_sessions`, `chat_messages`, and `notifications` with the pre-check counts. Session and message counts must not decrease. Notification count must not decrease during the migration.
4. Run `supabase/verification/08_chat_hardening_guard_test.sql`.
5. The guard test must return `passed = true`. It does not retain any test mutation.
6. Send the migration result, all post-check rows, the latest audit-event result, and the guard-test result for review.

## 6. Deploy the application

Deploy the application only after all database checks pass. Then perform a controlled UI smoke test:

1. Create a test session.
2. Exchange one message each way.
3. Close the session and confirm the history remains readable.
4. Confirm **Sembunyikan dari daftar** appears only after close.
5. Hide the test session and confirm it leaves regular lists and related notifications disappear.
6. Verify the database still contains the session and messages and records `CLOSED` and `HIDDEN` audit events with the correct actors.
