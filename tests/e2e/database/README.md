# Isolated Halo PSDM E2E database

`shared-schema.sql` is a schema-only fixture copied from the protected ARSC remote-schema snapshot. It contains no production rows, credentials, or raw Rapor access codes.

The GitHub E2E job applies this fixture only to a fresh local Supabase container, then applies the chat-retention migration and seeds dedicated CI-only users. The setup must reject every Supabase URL that is not localhost so browser tests can never mutate the production project.
