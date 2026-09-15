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

Live hosting target: a new Firebase Hosting site under the Louisville Regional Outreach Command Center project. Working repo: [NotByChanceOutreach/Louisville-Regional-Outreach-Command-Center](https://github.com/NotByChanceOutreach/Louisville-Regional-Outreach-Command-Center).

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
7. Replace `YOUR_FIREBASE_PROJECT_ID` in `.firebaserc`.

### First admin (required)

Any Google account is **not** an admin. Access is an explicit allowlist.

```bash
npx tsx scripts/grant-admin.ts --project YOUR_FIREBASE_PROJECT_ID --email YOUR_GOOGLE_EMAIL
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
npx tsx scripts/seed.ts --project YOUR_FIREBASE_PROJECT_ID
```

Document IDs are stable, so this is idempotent.

## Deploy

```bash
npm run build
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Exact Hosting URL after deploy: `https://YOUR_FIREBASE_PROJECT_ID.web.app`

Optional named site (Firebase site IDs are max 30 characters):

```bash
firebase hosting:sites:create louisville-command-center
```

Then add `"site": "louisville-command-center"` under `hosting` in `firebase.json` and deploy again. That yields `https://louisville-command-center.web.app`.

## Install on a phone (PWA)

- **iPhone:** Safari → Share → Add to Home Screen
- **Android:** Chrome → menu → Install app / Add to Home Screen

The app shell is cached. Firestore remains the source of truth; do not enter notes while driving.

## Data model

| Collection | Purpose |
|---|---|
| `adminEmails/{email}` | Explicit Google email allowlist |
| `admins/{uid}` | Active admin role for a signed-in user |
| `tasks` | Priorities and other work |
| `contacts` | Combined directory (underwear, board, resources, donors, partners) |
| `contactActivity` | Append-only contact log |
| `followUps` | Dated follow-ups |
| `boardTasks` | Board meeting checklist |
| `settings/app` | Seed flag, resource counts, verifier URL |
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

## Quality checks before calling it done

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
