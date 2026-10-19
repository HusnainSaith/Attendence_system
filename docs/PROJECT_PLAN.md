# EduPresence backend implementation plan

## Product and architecture

EduPresence is a multi-school attendance SaaS. A platform super administrator provisions schools; each school manages principal/admin profiles, campuses, academics, classes, sections, students, guardians, employees, biometric devices, attendance, leave, corrections, notifications, and reports. Dedicated terminals submit fingerprint or face events. Ordinary phone fingerprint APIs are not multi-student scanners, and raw fingerprint images are not stored by default.

The SRS uses NestJS as its reference framework; this implementation uses Next.js Route Handlers because the requested target is Next.js. Domain and persistence code stays framework-independent. Queue consumers and schedulers run as separate Node processes, not request handlers.

Project paths:

- `src/app/api/v1`: thin HTTP handlers, authentication, DTO validation, response mapping.
- `src/modules`: vertical domain modules and application services.
- `src/common`: authentication, tenant context, errors, correlation, audit and idempotency primitives.
- `src/database`: TypeORM entities, reviewed migrations, seeds; never production synchronization.
- `src/integrations`: biometric, email, storage and observability adapters behind ports.
- `src/jobs`: separately deployed BullMQ workers and schedulers.
- `test`: architecture, PostgreSQL integration, API, contract, tenant-isolation and E2E suites.

Tenant identity always comes from the authenticated user/device, never client input. Every owned query includes tenant scope, with PostgreSQL RLS and tenant-consistent constraints as defense in depth. Device events are immutable; calculated attendance is versioned and corrections supersede earlier records.

## Delivery plan

### Phase 0 Decisions and proof of concept

Select biometric hardware/protocol and prove online, offline, enrollment and revocation flows. Confirm Pakistan biometric/child-data counsel, cloud region, SMTP provider, attendance formulas, approval hierarchy, capacity, SLA, RPO and RTO. Produce ADRs and threat model.

### Phase 1 Platform foundation

Implement Argon2id login, rotating hashed refresh sessions, reuse detection, privileged MFA, invitations and recovery; tenant-aware RBAC and scoped grants; school lifecycle, subscriptions and entitlements; audit/security events; OpenTelemetry; Redis/BullMQ; transactional outbox; rate limits and idempotency. Gate: cross-tenant endpoint and repository tests pass.

### Phase 2 School domain

Implement principal onboarding, campuses/locations, academic years/terms/calendars, classes/sections/subjects/schedules/shifts, students/guardians/employees, effective-dated enrollments and assignments, transfers, promotions and preview/commit imports. Compound student and enrollment workflows are transactional.

### Phase 3 Biometrics and devices

Implement versioned consent, provider-neutral enrollment/revocation, duplicate-match quarantine, encrypted references, per-device asymmetric credentials or mTLS, rotation/revocation, nonces and sequences, location assignment, clock drift, health, offline batches and profile synchronization. Gate: hardware-in-loop evidence.

### Phase 4 Attendance

Implement effective-dated policies, school-time-zone calendars, sessions, debounce, check-in/out derivation, late/early/absence, approved-leave override, manual fallback with reason, finalization/locking/reopening, versioned corrections and separation of duties. Gate: deterministic boundary/time-zone and reconciliation tests.

### Phase 5 Communication and reports

Implement transactional notifications, escaped/versioned Nodemailer templates, delivery history/suppression, guardian preferences, dashboards and asynchronous PDF/XLSX/CSV exports with expiring tenant/user/purpose-scoped links.

### Phase 6 Hardening and launch

Run baseline/burst load and query-plan tests, SAST/DAST/dependency/secret/container scans, authorization penetration tests, backup/PITR exercises, queue/provider outage drills, canary deployment, attendance reconciliation and pilot acceptance. Do not claim RPO/RTO before a timed exercise.

## Route plan

The foundation implements school, class, section, student and employee creation; signed immutable device event ingestion; and live/ready health endpoints. Next are auth and `/me`, campuses and academic calendars, enrollment and guardians, device registry/credentials, attendance policies/sessions/records/corrections, leave, imports, notifications, reports, audit and security events.

## Testing strategy

- Unit: validation, policy calculations, authorization, signature verification, time zones and adapter errors.
- PostgreSQL/Testcontainers: migrations, constraints, RLS, transactions, concurrency and idempotency.
- API: production handlers with real JWTs and PostgreSQL.
- Tenant isolation: substitute path/body/filter/cursor/cache/job/object/report identifiers across two tenants.
- Device security: signature, nonce replay, sequence rollback, expiry, rotation, revocation, clock drift, wrong tenant, duplicate events and partial offline batches.
- Contract: OpenAPI breaking-change checks and shared biometric adapter conformance.
- Performance/recovery: approved baseline and burst traffic, queue backlog, backup restore and event/record/outbox reconciliation.

## Definition of done and open decisions

Each feature requires acceptance criteria, permissions, tenant scope, audit, migration/rollback notes, API contract, unit/integration/E2E tests, metrics/logs/alerts, documentation, and security/privacy checks. CI gates formatting, lint, typecheck, unit/architecture tests, scans, build, integration/migration tests, OpenAPI diff, staging E2E, canary smoke and rollback.

Open decisions are the device vendor/protocol; principal-per-school versus effective campus assignments; attendance thresholds and approval hierarchy; consent/retention/deletion/legal-hold/hosting policy; cloud, storage, SMTP and secrets providers; and measured capacity/SLA/RPO/RTO.

The immediate milestone is to finish Phase 1: database-backed device credentials, IAM and session schema, login/refresh/logout/MFA, a transaction helper that sets `app.tenant_id`, append-only audit/security events, idempotency middleware, and Testcontainers tenant-isolation evidence.
