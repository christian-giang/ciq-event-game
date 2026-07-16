# Teodora & Uroš — Wedding Party Game

A one-evening party game for ~200 wedding guests, played on their own phones.
Guests sign up with an email, get a color-animal username and a 6-digit access
code, complete quests (quiz / text / photo / video), vote on each other's
submissions and follow a live leaderboard.

Built to survive bad venue wifi and iPhones: offline-first submissions,
installable PWA, no accounts, no passwords. Used once, then exported and
deleted (30 days after the wedding at the latest).

## Local development (no cloud accounts needed)

Requirements: Node 22+, a local PostgreSQL server (or adjust `DATABASE_URL`).

```bash
./scripts/db-setup.sh        # creates role `wedding` + db `wedding_game` (system Postgres)
cp .env.example .env.local   # local defaults work out of the box
npm install
npm run db:migrate           # apply Drizzle migrations
npm run seed                 # fill access-code + username pools, validate quests
npm run dev                  # http://localhost:3000
```

Local drivers (set in `.env.local`):

- `EMAIL_DRIVER=console` — "sent" emails (access codes) are printed to the
  terminal running `npm run dev`.
- `STORAGE_DRIVER=local` — media uploads land in `.uploads/` instead of
  Vercel Blob.

Phone testing against dev needs a secure context for camera APIs: use a
Vercel preview deploy (or `next dev --experimental-https` + your LAN IP).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | the usual Next.js trio |
| `npm test` | unit tests (code pool, quest config, scoring) |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `npm run seed` | seed code + username pools (refuses if codes are in use) |
| `npm run export` | zip of all DB data + media for the couple — run before teardown |
| `npm run teardown -- --yes-delete-everything` | wipe DB + media (the privacy promise) |

## Editing quests

All quests live in `src/content/quests.ts` — and only there. Add, edit,
reorder or deactivate (`active: false`) quests by editing that one file;
routing, UI and scoring derive from it. The config is validated by
`npm test` (unique ids/orders, quiz answers exist, descending rank points).
Keep video quests to 4–5 — they cost real bandwidth on venue wifi.

## Architecture notes

- **Auth:** email → code shown once on screen (emailed as backup). Login is
  code-only; the username is display-only and never a credential. Repeat
  signups get the code emailed, never shown. Postgres-backed rate limiting
  (10/min/IP) guards the login endpoint with a uniform error message.
- **Sessions:** HMAC-signed HTTP-only cookie, 7 days.
- **Service worker (`public/sw.js`):** deliberately minimal — offline page +
  static asset caching only; never touches `/api` or uploads. Offline
  correctness belongs to the IndexedDB outbox (Phase 4), not the SW.
- **DB:** Drizzle + node-postgres; same driver locally and against Neon in
  production.
