# Rick's Command Center

Private, mobile-first dashboard for **Rick Aubrey**, Executive Director of **Not By Chance Outreach**.

It answers one question when it opens:

**What do I need to do next?**

The four jobs on the home screen are:

1. Deploy Not By Chance Website 2.0 to production/mainnet
2. Contact remaining Next Chance Navigator resources
3. Begin underwear / apparel in-kind outreach
4. Set up Microsoft Teams for the board meeting

This is not a generic CRM. It is a phone-first call-and-follow-up tool.

Production:

- Firebase project: `notbychance-command-center` (display name **Rick's Command Center**)
- URL: https://notbychance-command-center.web.app
- Alias: https://notbychance-command-center.firebaseapp.com
- Admin: `nbc@notbychanceoutreach.com`

Working repo: [NotByChanceOutreach/Louisville-Regional-Outreach-Command-Center](https://github.com/NotByChanceOutreach/Louisville-Regional-Outreach-Command-Center).

Related tools:

- Resource verifier: https://next-chance-navigator-staging.web.app/verify/
- Public navigator: https://next-chance-navigator.web.app/navigator/

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, Firebase Authentication (Google), Cloud Firestore, Firebase Hosting, PWA.

## Local development

```bash
npm install
copy .env.example .env.local
```

Fill in the Firebase web config in `.env.local`, then:

```bash
npm run dev
```

Open http://localhost:5173.

Without Firebase config the app shows a login page explaining that `.env.local` is missing. It will not pretend to save work.

## Firebase project setup

1. Create a Firebase project. Display name can be `Louisville Regional Outreach Command Center`. The Hosting URL will be `<project-id>.web.app` unless you add a custom site.
2. Enable **Authentication → Google**.
3. Add authorized domains: `localhost`, plus the Hosting domain (`<project-id>.web.app`).
4. Create a **Cloud Firestore** database (production mode — these rules deny public access).
5. Enable **Hosting**.
6. Copy the web app config into `.env.local` (never commit it).
7. `.firebaserc` is already set to `notbychance-command-center`.

### First admin (required)

Any Google account is **not** an admin. Access is an explicit allowlist.

```bash
npx tsx scripts/grant-admin.ts --project notbychance-command-center --email nbc@notbychanceoutreach.com
```

This writes `adminEmails/{email}`. Sign in once; the app then creates `admins/{uid}`.

You need Application Default Credentials for that script:

```bash
gcloud auth application-default login
```

Or paste a service account JSON path into `GOOGLE_APPLICATION_CREDENTIALS`. Do not commit that file.

After you are an admin, Settings → Add admin email can allowlist additional people.

### Seed data

The first successful admin sign-in seeds:

- the four priority tasks
- 20 underwear / apparel organizations from the supplied HTML directory
- 6 board members (names and titles only)
- the Microsoft Teams checklist

Re-run anytime with:

```bash
npx tsx scripts/seed.ts --project notbychance-command-center
```

Document IDs are stable, so this is idempotent.

## Deploy

```bash
npm run build
firebase login
firebase use notbychance-command-center
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Exact Hosting URL: `https://notbychance-command-center.web.app`

Optional named site (Firebase site IDs are max 30 characters):

```bash
firebase hosting:sites:create louisville-command-center
```

Then add `"site": "louisville-command-center"` under `hosting` in `firebase.json` and deploy again. That yields `https://louisville-command-center.web.app`.

## Install on a phone (PWA)

- **iPhone:** Safari → Share → Add to Home Screen
- **Android:** Chrome → menu → Install app / Add to Home Screen

The app shell is cached. Firestore remains the source of truth; do not enter notes while driving.

## Phase 2 (operational command center)

Seed data is a starting point, not a lock. Every organization can be edited, archived, verified, and improved while you work.

- Full resource/contact editing, labeled phones, multiple people per organization
- Archive (remove from active list) with restore; permanent delete is separate
- Verification checklist + aging (current / aging / stale / never verified)
- Call outcomes, follow-up engine, Today view, Next Best Action
- Quick capture (`+`), global search, duplicate warnings, merge, data quality
- CSV import (preview first) and export
- Settings for categories, archive reasons, aging thresholds, and follow-up intervals

After deploy, existing Firestore documents are hydrated in the client. Persist the new fields with:

```bash
npx tsx scripts/migrate-phase2.ts --project notbychance-command-center
```

This is idempotent and does not delete records.

## Data model

| Collection | Purpose |
|---|---|
| `adminEmails/{email}` | Explicit Google email allowlist |
| `admins/{uid}` | Active admin role for a signed-in user |
| `tasks` | Priorities and other work |
| `contacts` | Organizations/resources with nested `people` and `methods`, archive + verification |
| `contactActivity` | Append-only contact log |
| `followUps` | Dated / recurring follow-ups |
| `boardTasks` | Board meeting checklist |
| `settings/app` | Seed flag, URLs, categories, archive reasons, aging thresholds |
| `activity` | Chronological feed |

## Imported underwear contacts

The 20 organizations from the supplied HTML (Fruit of the Loom, Carhartt, SanMar, Amazon facilities, Gap, Walmart, Wolverine, Under Armour, and Louisville apparel shops) are imported as `Underwear/Apparel` contacts.

Preserved from the source: names, addresses, phones, listed emails, listed websites, inventory notes, and recommended approach.

**Not independently verified.** Each record has `verificationStatus: unverified` and a source note. Missing phones, emails, people, and websites display **Needs Research**. Placeholder patterns such as `First.Last@fotlinc.com` were not imported.

## Security

Firestore rules deny everything by default.

- Unauthenticated: no reads, no writes
- Signed-in but not allowlisted: no command-center data
- Allowlisted + `admins/{uid}.active == true`: full access to app collections

Rules tests (emulator required):

```bash
npx firebase emulators:exec --only firestore "npm run test:rules"
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Unit / component tests |
| `npm run test:rules` | Security rules tests (needs emulator) |
| `npm run grant-admin` | Allowlist an email |
| `npm run seed` | Write seed documents |
| `npm run migrate:phase2` | Idempotent Phase 2 contact/settings hydration |

## Quality checks before calling it done

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
