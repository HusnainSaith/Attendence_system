# EduPresence database

The migration chain is the database source of truth. It is ordered by dependency: platform and tenancy; identity and access; academics and people; consent, biometrics and devices; attendance and leave; operations, audit and privacy; then integrity, lifecycle triggers and row-level security.

Every tenant-owned parent exposes `(id, tenant_id)` as a candidate key. Child tables use composite foreign keys whenever both sides are tenant-owned, making cross-school references impossible even if application code is defective. Polymorphic student/employee references are validated by triggers. Current subscriptions, default academic years, active enrollments, device assignments, biometric profiles and attendance records use partial unique indexes.

Application work must run through `withDatabaseContext`. It creates a transaction and uses transaction-local PostgreSQL settings for `app.tenant_id` and `app.is_super_admin`; this prevents connection-pool context leakage. Direct tenant queries outside this transaction are expected to return no rows once RLS is active.

Attendance events and audit logs are append-only. Corrections create superseding attendance-record versions. Timestamps are `timestamptz`; policy calendar values use `date` and `time`. JSONB is reserved for provider metadata, snapshots, policy rules and flexible operational payloads.

Commands:

- `pnpm db:migrate` applies all pending migrations transactionally.
- `pnpm db:migrate:revert` reverts the latest migration.
- `pnpm test:db` starts PostgreSQL 16 with Testcontainers, applies the complete chain, and verifies schema coverage, cross-tenant relationships and append-only evidence. Docker Desktop must be running.

Production migrations run as one controlled pre-deploy job using a dedicated migration role. The runtime role must not own tables, bypass RLS, create schemas or run migrations. Back up before migration, rehearse against the previous release, record query timings and locks, and document rollback or forward-fix steps for every release.
