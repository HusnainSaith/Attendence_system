# EduPresence backend

Next.js 16 API foundation for a multi-tenant school biometric attendance platform. It includes strict TypeScript Route Handlers, PostgreSQL with explicit TypeORM migrations, tenant-scoped operations, JWT permission checks, RFC 7807-style errors, signed immutable event ingestion, health endpoints and Vitest tests.

Read [the implementation plan](docs/PROJECT_PLAN.md) before extending the system.

## Local setup

1. Copy `.env.example` to `.env.local` and replace every secret.
2. Start PostgreSQL and create the configured database.
3. Run `pnpm install` and `pnpm db:migrate`.
4. Optionally set `BOOTSTRAP_SUPER_ADMIN_EMAIL` and `BOOTSTRAP_SUPER_ADMIN_PASSWORD`, then run `pnpm db:seed`.
5. Run `pnpm dev`.

Quality gates are `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

Authentication endpoints are `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, and `GET /api/v1/me`. Access tokens are short lived. Refresh tokens are opaque, hashed in PostgreSQL, rotated on every use, bound to a session family, and delivered through an HttpOnly `SameSite=Strict` cookie.

Onboarding and account-security endpoints include `POST /api/v1/users/invitations`, `POST /api/v1/auth/invitations/accept`, password forgot/reset routes, and MFA setup/verify/disable routes. Configure `MFA_ENCRYPTION_KEY` as a base64-encoded 32-byte random value. Recovery codes are returned only once after MFA verification and are stored as Argon2id hashes.

`POST /api/v1/onboarding/schools` performs the initial school setup as one serializable transaction: tenant, subscription, campus, default academic year, classes, sections, attendance policy, audit record and principal invitation. `GET /api/v1/onboarding/status` reports whether a tenant is ready for people enrollment and biometric attendance.

Student APIs support transactional admission with optional guardian and initial enrollment, keyset-paginated listing, tenant-scoped detail/update, and effective-dated transfers through `POST /api/v1/students/{id}/transfers`.

Staff APIs support employee categories, tenant-unique employee numbers, keyset listing, detail/update, effective-dated teacher assignments and campus shifts through `/api/v1/employees`, `/api/v1/employee-categories`, `/api/v1/teacher-assignments`, and `/api/v1/shifts`.

Guardian APIs support tenant-scoped creation, keyset listing, detail/update, student linking and unlinking through `/api/v1/guardians` and `/api/v1/students/{id}/guardians`. Every linked student retains exactly one primary guardian: the first link is promoted automatically, replacement is atomic, and unlinking a primary guardian promotes the best remaining contact.

Enrollment lifecycle APIs provide promotion preview and atomic bulk execution through `/api/v1/enrollments/promotions/preview` and `/api/v1/enrollments/promotions`. Historical placements are available from `/api/v1/students/{id}/enrollments`; promotions close source-year enrollments, preserve history, skip existing target enrollments safely, and audit each batch.

Student and employee imports use a staged workflow: validate up to 1,000 JSON rows through `POST /api/v1/imports/people`, inspect row-level results at `GET /api/v1/imports/{id}`, and atomically commit an error-free batch through `POST /api/v1/imports/{id}/commit`. Checksums make identical submissions idempotent, while database conflicts abort the entire commit.

Biometric operations require explicit, active consent. `/api/v1/consents`, `/api/v1/biometric-profiles`, and their withdrawal/revocation actions encrypt opaque provider capture references, maintain device synchronization work, and never accept raw fingerprint templates. `/api/v1/devices` supports tenant-scoped registration, health listing, credential rotation, and effective-dated location assignments.

Attendance APIs under `/api/v1/attendance` provide versioned policies, scoped daily sessions, record listing, audited manual marking, and idempotent finalization. Signed device events are matched to open campus sessions, checked against class/section/shift scope, and converted into immutable event-linked attendance record versions; finalization fills missing subjects as absent or approved leave.

Exception workflows support leave types and overlap-safe leave requests through `/api/v1/leave-types` and `/api/v1/leave-requests`. Attendance corrections use request/decision endpoints under `/api/v1/attendance`, enforce requester/approver separation, bind approval to an expected record version, and preserve the superseded record.

Operational APIs provide attendance summaries and formula-safe CSV downloads under `/api/v1/reports/attendance`, plus filtered audit and security-event views. Device event ingestion requires a timestamped asymmetric signature and active database credential identified by `x-device-key-id`; the shared integration secret is no longer accepted.

Notification APIs provide per-user preferences, an inbox, durable outbox-backed queuing, SMTP delivery records, bounded exponential retries, and a constant-time authenticated worker at `POST /api/v1/internal/jobs/notifications`. Privacy requests support access, export, deletion, restriction, and consent-withdrawal review with legal-hold and self-approval safeguards; approval records intent but deliberately does not destructively erase data.

## Security status

This is a production-oriented foundation, not authorization to begin a biometric pilot. Configure PostgreSQL, SMTP, encryption and worker secrets; run migrations and database integration tests; then complete hardware-in-loop, jurisdiction-specific legal/privacy, disaster-recovery, load and penetration-test gates before deployment.
