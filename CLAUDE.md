# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run tests once (vitest)
npm run test:watch   # Run tests in watch mode

# Prisma / DB
npm run prisma:generate   # Regenerate Prisma client after schema changes
npm run prisma:db:push    # Push schema to DB (dev)
npm run prisma:studio     # Open Prisma Studio

# User management
npm run seed:user    # Seed a default user
npm run user:create  # Create a new user interactively
```

To run a single test file: `npx vitest run src/lib/tournament-engine/__tests__/bracket.test.ts`

## Environment Variables

Required in `.env`:
- `DATABASE_URL` – Neon PostgreSQL connection string (pooled)
- `DIRECT_URL` – Neon direct connection (for migrations)
- `JWT_SECRET` – At least 32 characters; used to sign all tokens
- `JWT_ISSUER` / `JWT_AUDIENCE` – Optional, default to `torneos-americanos` / `torneos-americanos-app`

## Architecture

**Stack:** Next.js 16 (App Router) · TypeScript · Prisma + PostgreSQL (Neon) · Tailwind CSS v4 · Vitest

### Tournament Flow

`GRUPOS → RANKING → DESEMPATE → ELIMINATORIA → FINALIZADO`

Tournaments are called *torneos*. Each torneo has:
- **Parejas** (pairs/teams): can be generic (e.g. "Pareja 1") or named (jugador1 + jugador2)
- **Grupos** (round-robin groups of 3 or 4 pairs): play RONDA1 matches; 4-pair groups also play RONDA2 (generated automatically once RONDA1 is complete)
- **Ranking**: computed from group results via `src/lib/tournament-engine/ranking.ts`; tiebreaks resolved via `desempate` (`MONEDA` or `TIEBREAK` method)
- **Bracket**: single-elimination generated from seeded ranking via `src/lib/tournament-engine/bracket.ts`

### Tournament Engine (`src/lib/tournament-engine/`)

Pure TypeScript, no DB dependency — fully unit-tested:
- `groups.ts` – fixture generation (RONDA1 and RONDA2)
- `seeding.ts` – seeds pairs from ranking for bracket placement
- `ranking.ts` – computes standings (goals for/against/diff), detects tiebreaks
- `tiebreak.ts` – applies tiebreak resolution to ranking
- `bracket.ts` – builds/progresses single-elimination bracket
- `types.ts` – shared interfaces (`Pareja`, `BracketMatch`, `MatchResult`, etc.)

### Backend (`src/app/api/`)

REST API routes under `src/app/api/torneo/[id]/`:
- `route.ts` – CRUD for torneo
- `resultado-grupo/route.ts` – submit group match scores
- `resultado-bracket/route.ts` – submit bracket match scores
- `ranking/route.ts` – get computed ranking
- `desempate/route.ts` – resolve tiebreaks
- `bracket/route.ts` – get/create bracket

**Service layer:** `src/lib/tournament-service.ts` centralizes DB queries and business logic (used by API routes). `src/lib/api.ts` provides `ok()`, `fail()`, `parseJson()`, and `fromUnknownError()` for consistent API responses.

**DB singleton:** `src/lib/db.ts` exports a shared `PrismaClient` instance (reused across hot reloads in dev).

### Auth

JWT-based, stored in httpOnly cookies:
- Access token (15 min) + Refresh token (7 days, hashed in DB as `AuthSession`)
- `src/lib/auth/jwt.ts` – sign/verify tokens, set/clear cookies
- `src/lib/auth/session.ts` – DB session management (create, rotate, revoke)
- `src/lib/auth/require-auth.ts` – `requireApiAuth(request)` for API routes, `requirePageAuth()` for page server components

### Pair naming (`src/lib/pair-utils.ts`)

`PairMode` is either `"GENERIC"` (auto-numbered) or `"NAMED"` (jugador1 + jugador2). Use `resolvePairDisplayName(pair)` to get the correct display name regardless of mode.
