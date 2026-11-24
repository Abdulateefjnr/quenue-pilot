# QueuePilot

QueuePilot is a Next.js healthcare queue-management application backed by Neon Postgres, private Neon Object Storage, and Neon Realtime.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the required values. Neon CLI can populate the Neon service variables:

   ```powershell
   neon init -y --org-id <org-id> --project-id <project-id> --branch production --services postgres --services object-storage --services realtime
   neon deploy
   ```

   The deployed Neon values are written to the local environment file. Do not commit environment files.
3. Generate and apply database migrations:

   ```powershell
   npm run db:generate
   npm run db:migrate
   ```

   Review generated SQL in `drizzle/` before applying schema changes. Migrations prefer `DATABASE_URL_UNPOOLED`; the app uses pooled `DATABASE_URL`.
4. Configure `BETTER_AUTH_SECRET` with a unique random value of at least 32 characters. Keep `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` aligned with the app origin.
5. Add a verified Resend sender to `EMAIL_FROM` and set `RESEND_API_KEY` to enable verification and password-reset emails.
6. To enable social sign-in, set the relevant provider ID and secret pairs. Configure each provider callback URL as `<app-origin>/api/auth/callback/<provider>` (for example, `/api/auth/callback/google`).
7. Start the app with `npm run dev`.

Neon preview branches allow the local origin `http://localhost:3000` through `preview.realtime.allowedOrigins` in `neon.ts`. Update that allowlist for the origins used by preview deployments.

### Administrator setup

Set `QUEUEPILOT_INITIAL_ADMIN_EMAIL` to the verified email address of the first platform administrator before allowing account onboarding. Apply the database migrations before deploying the updated app. That account is promoted from the server-side role check at sign-in and can create the first facility. New registrations are regular users and cannot create workspaces until an administrator grants them access. The `/admin/users` page manages platform super-admin access and assigns facility roles to a specific existing facility; those roles do not grant platform privileges. QueuePilot prevents removing the configured first administrator or demoting the final administrator.

### Isolated appointment verification account

Never create test accounts or synthetic records on the linked `production` branch. Configure a separate non-production Neon branch containing no production patient data, then set the `QUEUEPILOT_TEST_*` variables in the ignored `.env.local` file. Use a dedicated test email inbox you control and a unique password; do not reuse production credentials. The account flow below calls the same signup, email-verification, sign-in, and onboarding APIs as the application and does not bypass authentication.

1. Set `QUEUEPILOT_TEST_MODE=true`, `QUEUEPILOT_TEST_BRANCH`, `QUEUEPILOT_TEST_DATABASE_URL`, `QUEUEPILOT_TEST_DATABASE_URL_UNPOOLED`, `QUEUEPILOT_TEST_EMAIL`, `QUEUEPILOT_TEST_PASSWORD`, `QUEUEPILOT_TEST_OWNER_NAME`, and `QUEUEPILOT_TEST_FACILITY`. The facility name must start with `QueuePilot QA `; set `QUEUEPILOT_TEST_TERMS_ACCEPTED=true` only after reviewing the signup terms.
2. Start the local app against only the isolated database with `npm run test:dev`. It binds to `127.0.0.1:3001`, overrides the app database URLs with the test branch URLs, and refuses a production-like branch or an endpoint identical to the linked database. Before any signup request, the helper verifies the running app's test-only local configuration endpoint matches the configured test branch and database host.
3. In another terminal run `npm run test:account -- signup`. Open the verification message in the dedicated test inbox and follow the regular verification link.
4. Run `npm run test:account -- onboard`. It signs in through Better Auth, completes the normal organization onboarding, and checks in PostgreSQL that the test user is the sole owner of the named test facility.

Passwords and connection strings stay in `.env.local`; the helper never prints them. Do not commit the file or share credentials in chat. The appointment migration (`0003_redundant_lily_hollister.sql`) has been applied to the linked `production` branch; ensure the isolated test branch has the current migrations before running API verification.

## Neon services

- **Postgres:** Drizzle uses the `pg` Node.js driver. Application queries use `DATABASE_URL`; Drizzle migrations use `DATABASE_URL_UNPOOLED` when available.
- **Object Storage:** Profile photos are private, validated PNG/JPEG/WebP objects, limited to 5 MB, and stored under per-user prefixes in the private `assets` bucket. API responses use short-lived signed URLs.
- **Realtime:** The dashboard uses server-sealed, user-filtered notification queries. Keep `NEON_REALTIME_SECRET` server-only.

## Auth configuration

Better Auth provides password and optional OAuth sign-in, email verification, password reset, database-backed sessions and rate limits, and organization membership. Platform roles are read from the database on the server; the public signup form cannot grant administrator access. Email delivery requires Resend configuration; OAuth providers remain unavailable until their credentials and callbacks are configured.

For Render, set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to the exact public origin, `https://quenue-pilot.onrender.com` (no trailing slash or path). The app can use Render's automatic `RENDER_EXTERNAL_URL` as a fallback if those values are omitted. Deployed production origins must use HTTPS; local production runs may use HTTP only for loopback origins when `RENDER_EXTERNAL_URL` is absent. Do not add wildcard origins or disable origin/CSRF checks. Better Auth's browser client sends cookies with `credentials: "include"`; its auth requests stay on the app origin.

Set `BETTER_AUTH_SECRET` to a unique random value of at least 32 characters, `RESEND_API_KEY` to a valid Resend API key, and `EMAIL_FROM` to a sender address on a verified Resend domain. Email verification remains required before sign-in. Set `QUEUEPILOT_INITIAL_ADMIN_EMAIL` to the first administrator's address if that account needs to create the first facility.

The authentication schema and application tables are managed by the checked-in Drizzle migrations. No schema migration was added for the auth fixes. Before deploying, ensure the production database has migrations `0000` through `0006` applied; run `npm run db:migrate` with `DATABASE_URL_UNPOOLED` pointing at that database if required. Do not use `db:generate` or a development database URL as a production migration substitute.

Required application variables are listed in `.env.example`. `BETTER_AUTH_SECRET`, database credentials, storage credentials, and the Realtime secret must never be exposed to client code or committed to source control.

## Patient and queue workflow

The operational dashboard is scoped to the signed-in member's organization. Patient check-in creates a patient record, visit, department queue ticket, patient journey, and audit events in one database transaction. Queue ticket numbers are allocated by an atomic per-organization, per-department, per-day counter.

Users who belong to more than one facility must explicitly select an active facility. The dashboard switcher changes the active facility for the current session, and server-rendered pages and API handlers verify that the selected facility is one the user belongs to.

- `/dashboard/patients` registers and searches patients, with 25 patients per page. A possible duplicate is flagged when both normalized phone number and date of birth match; phone and date of birth are optional.
- `/dashboard/queue` lists active tickets with server-side patient search, status/department filters, and 25 tickets per page. Call, start, complete, and transfer actions are supported; completion and transfer require confirmation. Valid transitions are waiting → called → in service → completed. Transfer creates a new ticket in the selected department and records both sides of the transfer.
- `/dashboard/departments` lets organization owners and admins create departments with unique ticket codes, then search and filter the department list by name/code and active status.
- `/dashboard/profile` lets organization owners and admins edit the facility name, hospital/clinic type, and contact phone, and upload or remove a facility logo. Patient records can be removed from active lists by owners and admins; removal archives the record so visit and queue history remains intact.
- `/dashboard/appointments` provides weekly calendar and paginated list views, patient search, status filtering, appointment create/reschedule/cancel, lifecycle transitions, and facility doctor/nurse assignment. Staff availability currently means no overlapping active appointment; working schedules and department assignments are Phase 2.
- Appointment writes enforce organization scope, role permissions, active patient/department membership, staff membership, patient/staff overlap checks serialized with PostgreSQL transaction advisory locks, create idempotency keys, valid lifecycle transitions, and per-change audit events.
- Dashboard routes share responsive navigation, page loading skeletons, route-level error recovery, accessible forms, and explicit empty, error, and success states.
- The overview reports tenant-scoped visit check-ins, a seven-day visit trend, waiting/in-service/completed tickets, active patient records, notifications, and per-department queue counts and wait durations from today's ticket timestamps. Dashboard date and time displays use the facility's Africa/Lagos timezone. The sidebar can collapse on desktop and opens as an accessible drawer on mobile, and the dashboard supports a persisted light/dark theme toggle.
- Dashboard controls follow the source-owned shadcn/ui setup (`components.json`) and use the existing emerald palette.
- Route handlers are `GET/POST /api/patients`, `DELETE /api/patients/[patientId]`, `GET/PATCH /api/profile/organization`, `GET/POST/DELETE /api/profile/organization/logo`, `GET /api/queue`, `POST /api/queue/[ticketId]`, and `GET/POST /api/departments`. They derive organization context from the authenticated membership, enforce role permissions, and do not accept a client-supplied organization ID.
- Doctor/staff profiles and working schedules, waitlists, recovery approvals, revenue reporting, configurable alerts, facility application reviews, and AI operations are not implemented yet. They are intentionally not presented as live metrics or working controls.

The operational tables are in `drizzle/0001_robust_morg.sql`, `drizzle/0002_thankful_squirrel_girl.sql`, `drizzle/0003_redundant_lily_hollister.sql`, and `drizzle/0004_burly_speed.sql`. Appointment migration `0003` is applied to the currently linked `production` branch. Migration `0002` seeds a `General` department for existing organizations, and onboarding seeds one for new organizations. Review and test schema changes on a Neon development branch or another non-production database before promotion.

## Validation

```powershell
npm run lint
npm test
npx tsc --noEmit
npm run build
```
