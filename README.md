# SmartBook

Campus room booking for Building Z, with live (simulated) occupancy, ghost-booking detection, an AI booking assistant (OpenAI) and door kiosks.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · Prisma 7 + SQLite · Auth.js v5 (credentials) · Zod 4 · OpenAI SDK · Vitest

## Getting started

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then fill in values (see below)
npx prisma migrate dev      # creates dev.db
npm run db:seed             # rooms, demo users, demo bookings
npm run dev                 # http://localhost:3000
```

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file, default `file:./dev.db` |
| `AUTH_SECRET` | Auth.js secret (`npx auth secret`) |
| `OPENAI_API_KEY` | Enables the assistant |
| `OPENAI_MODEL` | Default `gpt-5-mini` |
| `OCCUPANCY_SOURCE` | `sim` (default) or `board` |
| `OCCUPANCY_INGEST_KEY` | Shared key for `POST /api/occupancy` |
| `GHOST_AFTER_MINUTES` | Minutes of empty booked room before "ghost" (default 2) |

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@smartbook.dev | admin1234 |
| Member | member@smartbook.dev | member1234 |
| Member (holds demo bookings) | holder@smartbook.dev | holder1234 |

## Demo script (simulator)

- **Z.1.03** – booked and in use.
- **Z.1.09** – booked but empty → becomes a **ghost booking** after ~2 min; any member can "Book now" to take it over, admins can reclaim it.
- **Z.1.10** – booking auto checks in after ~25 s.
- **Z.1.11** – unbooked room becomes occupied (squatter) after ~10 s.

Admins can toggle simulated occupancy per room and restart the demo from `/admin`.

## Pages

- `/` floor view · `/rooms/[id]` room detail + booking · `/bookings` my bookings
- `/assistant` AI assistant (also docked on every page; write actions require confirmation)
- `/admin`, `/admin/rooms` admin dashboard and room editor
- `/door/[id]` public door kiosk display

## Occupancy board integration

Set `OCCUPANCY_SOURCE=board` and have the board POST events (single object or array) to `/api/occupancy` with header `x-occupancy-key: <OCCUPANCY_INGEST_KEY>`:

```json
{ "roomId": "Z.1.05", "source": "board", "ts": "2026-01-01T10:00:00Z",
  "occupied": true, "peopleCount": 2, "noiseDb": 55 }
```

Returns `202 { "accepted": n, "unknownRooms": [] }`. Rooms with no signal for 60 s are treated as offline and never flagged as ghosts.

## Scripts

`npm run dev` · `build` · `lint` · `typecheck` · `test` · `db:migrate` · `db:seed` · `db:reset`