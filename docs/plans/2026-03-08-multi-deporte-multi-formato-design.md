# Multi-Deporte + Multi-Formato Refactor Design

Date: 2026-03-08
Status: Approved by user
Project: Americano's

## 1. Context

The current app is optimized for one use case:
- Sport: padel
- Format: americano (groups + bracket in one day)

The product direction now requires:
- Multiple sports: PADEL, FUTBOL, TENIS
- Multiple formats: AMERICANO, LARGO, LIGA
- Rankings and stats by player and by participant (pair/team/individual)
- No production data constraints (reset/migration freedom is allowed)

Core constraint:
- Existing PADEL + AMERICANO flow must keep working during migration.

## 2. Goals and Non-Goals

### Goals
- Decouple sport rules from tournament format logic.
- Introduce a domain model that supports pairs, teams, and individuals.
- Prepare efficient data access for ranking/stat filters.
- Keep migration incremental with clear rollback boundaries.
- Standardize API contracts and domain error handling.
- Add adaptive tournament creation UI (sport + format wizard).

### Non-Goals (for this iteration)
- Full implementation of all LARGO/LIGA business rules.
- Final UI for all sports and all ranking pages.
- Historical data migration fidelity (not needed before launch).

## 3. Product Domain Exploration (Interface Design)

### Domain vocabulary
- Fixture
- Group table
- Knockout bracket
- Match sheet
- Referee notes
- Season date / jornada
- Seeding

### Color world
- Grass green (football pitch)
- Clay / hardcourt tones (tennis)
- Scoreboard navy
- LED amber
- Card red / yellow
- Chalk white field lines

### Signature element
- Competition Ribbon:
  `Sport -> Format -> Config`
  Always visible in create flow and tournament header.

### Defaults to avoid
- Generic equal cards for every step.
- One long form without structure.
- Heavy modal-only flow for match details.

## 4. Architecture Decisions

## 4.1 Two-axis domain model
- Axis A: `Deporte` (rules and score semantics)
- Axis B: `Formato` (competition structure and progression)

These axes are independent and composed by factory:
- `SportStrategy` + `FormatStrategy` -> `TournamentEngine`

## 4.2 Participant unification
Use a single `Participante` entity instead of separate `Pareja` and `Equipo`.

Rationale:
- One consistent relation graph for groups, bracket, matches, and rankings.
- Supports:
  - Padel pairs
  - Football teams
  - Tennis singles/doubles
- Lower branching complexity in API and UI.

## 4.3 Pure engine core
- `src/lib/tournament-engine` stays framework/db-agnostic.
- API/service layer orchestrates persistence and auth.

## 4.4 Backward-safe migration strategy
- Additive first, switch second, cleanup last.
- Keep adapters until PADEL + AMERICANO parity is verified.

## 5. Data Model Design (Prisma)

## 5.1 New enums
- `Deporte`: PADEL | FUTBOL | TENIS
- `Formato`: AMERICANO | LARGO | LIGA
- `TipoParticipante`: INDIVIDUAL | PAREJA | EQUIPO
- `EstadoPartido`: PENDIENTE | EN_JUEGO | FINALIZADO | WALKOVER
- `TipoEventoPartido`: GOL | ASISTENCIA | AMARILLA | ROJA | MVP | ACE | WINNER | ERROR_NO_FORZADO

## 5.2 Torneo updates
- Add:
  - `deporte Deporte @default(PADEL)`
  - `formato Formato @default(AMERICANO)`
  - `config Json?` (sport/format specific settings)
- New relations:
  - `participantes Participante[]`
  - `jugadores Jugador[]`
  - `partidos Partido[]`
  - `eventos EventoPartido[]`
  - `fechas FechaCompetencia[]`
  - `categorias Categoria[]`
  - `rankingConfig RankingConfig?`

## 5.3 New core models
- `Participante`
  - Tournament-scoped participant entity (pair/team/individual)
  - Fields: id, torneoId, nombre, tipo, seed, grupoId?, categoriaId?, createdAt, updatedAt

- `Jugador`
  - Physical player entity
  - Fields: id, torneoId, participanteId?, nombre, apodo?, dorsal?, createdAt

- `Partido`
  - Unified match model for group/league/bracket/date
  - Fields include:
    - torneoId, fase, grupoId?, bracketId?, fechaId?, ronda?, orden?
    - localId, visitanteId, ganadorId?
    - score fields:
      - golesLocal?, golesVisitante?, penalesLocal?, penalesVisitante?
      - set1Local?, set1Visitante?, set2Local?, set2Visitante?, set3Local?, set3Visitante?
      - tiebreak3Local?, tiebreak3Visitante?
    - walkover, estado, completado, metadata Json?

- `EventoPartido`
  - FK to `Partido`, optional FK to `Jugador` and/or `Participante`
  - Fields: tipo, minuto?, descripcion?, createdAt

- `FechaCompetencia`
  - For long format / league scheduling
  - Fields: torneoId, numero, inicio?, fin?, estado

- `Categoria`
  - Division/tier support for league
  - Fields: torneoId, nombre, nivel

- `RankingConfig`
  - Per-tournament points table (champion/final/etc)
  - Fields: torneoId unique, points Json

## 5.4 Index strategy (query optimization)
- `Torneo`: `(userId, deporte, formato, estado, createdAt)`
- `Participante`: `(torneoId, tipo, seed)`, `(torneoId, categoriaId)`
- `Jugador`: `(torneoId, participanteId)`, `(torneoId, nombre)`
- `Partido`:
  - `(torneoId, estado, fase)`
  - `(torneoId, fechaId, ronda)`
  - `(localId)`, `(visitanteId)`, `(ganadorId)`
- `EventoPartido`:
  - `(torneoId, tipo, createdAt)`
  - `(partidoId, tipo)`
  - `(jugadorId, tipo)`
- `FechaCompetencia`: unique `(torneoId, numero)`
- `Categoria`: `(torneoId, nivel)`

## 6. Engine Design

Folder target:

`src/lib/tournament-engine/`
- `types.ts`
- `strategy-factory.ts`
- `sports/`
  - `sport-strategy.ts`
  - `padel.ts`
  - `futbol.ts`
  - `tenis.ts`
- `formats/`
  - `format-strategy.ts`
  - `americano.ts`
  - `largo.ts`
  - `liga.ts`
- `rankings/`
  - `ranking-calculator.ts`
  - `stats-aggregator.ts`
- `shared/`
  - `seeding.ts`, `groups.ts`, `bracket.ts`

Interfaces:
- `SportStrategy`: match rules, score validation, winner resolution, event catalog, ranking criteria, walkover outcome.
- `FormatStrategy`: stage/group creation, fixture generation, standings computation, tiebreak detection, playoff build, qualifiers.

Composition:
- `createTournamentEngine(deporte, formato)` returns bound API combining both strategies.

## 7. API Design (REST v1)

Resource-oriented endpoints:
- `POST /api/torneos`
- `GET /api/torneos`
- `GET /api/torneos/:id`
- `PATCH /api/torneos/:id`
- `POST /api/torneos/:id/participantes`
- `POST /api/torneos/:id/partidos/:partidoId/resultado`
- `POST /api/torneos/:id/partidos/:partidoId/eventos`
- `GET /api/rankings`
- `GET /api/rankings/goleadores`
- `GET /api/rankings/jugadores/:id/stats`
- `GET /api/rankings/participantes/:id/historial`

Filter support:
- deporte, formato, estado, periodo, pagination.

## 8. Error Handling Strategy

Principles:
- Expected domain validation errors -> typed `Result` style in engine.
- Unexpected failures -> exceptions with centralized API mapper.

Response envelope:
- Keep `{ success, data | error }`
- Add stable `errorCode` values:
  - VALIDATION_ERROR
  - NOT_FOUND
  - CONFLICT_STATE
  - FORBIDDEN
  - UNAUTHORIZED
  - INTERNAL_ERROR
  - UNSUPPORTED_COMBINATION
  - INVALID_SCORE

Operational rules:
- No silent catches.
- Preserve internal logs, return safe client messages.
- Retry hints only where meaningful.

## 9. UI Design Plan

## 9.1 Tournament creation wizard
- Step 1: choose sport (PADEL/FUTBOL/TENIS).
- Step 2: choose format (AMERICANO/LARGO/LIGA), with compatibility hints.
- Step 3: dynamic config form based on selected combination.

UI characteristics:
- Competition Ribbon at top.
- Desktop: sticky summary side panel.
- Mobile: sticky bottom summary.
- Per-step validation + global submit gate.

## 9.2 Football match result
- Required block: score + status (including penales / walkover).
- Optional expandable details:
  - goals
  - assists
  - cards
  - MVP

## 10. Implementation Phases and Gates

1. DB migration (additive)
2. Engine v2
3. Service/API adaptation with compatibility mode
4. Wizard UI
5. Football score + events UI/API
6. Ranking/stat endpoints and base views
7. Tennis enablement
8. Legacy cleanup

Gate after each phase:
- Build passes
- Tests pass
- PADEL + AMERICANO smoke flow passes end-to-end

## 11. Testing Strategy

- Unit:
  - sports strategies
  - format strategies
  - ranking aggregators
- Integration:
  - API contracts and error codes
  - tournament lifecycle per sport/format baseline
- Regression:
  - existing americano behavior parity

## 12. Risks and Mitigation

Risks:
- Migration complexity and temporary dual models.
- Hidden coupling in current service/UI layer.
- Ranking query performance degradation.

Mitigation:
- Additive migration and adapters.
- Incremental PR boundaries with strict smoke gates.
- Early index plan and query profiling.

## 13. Approval Record

Approved by user in chat:
- Multi-sport + multi-format direction
- DB reset freedom (no production constraints)
- Participant unification approach
- Sectioned design including API, error handling, UI, and phased rollout

## 14. Next Step

Move to implementation plan execution starting with Phase 1 (Prisma schema + migration files + compile/test gate).
