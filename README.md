# Torneos Americanos

Aplicacion web para organizar torneos de padel tipo "americano" con:

- fase de grupos,
- ranking por diferencia de games,
- desempates para BYEs,
- cuadro eliminatorio con progresion automatica.

## Stack tecnico

- `Next.js 16` (App Router) + `React 19` + `TypeScript`
- `Prisma` + `PostgreSQL`
- `Tailwind CSS 4`
- `Vitest` para tests unitarios

## Requisitos

- Node.js `>= 20`
- npm
- PostgreSQL en ejecucion

## Configuracion local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env.local` (podés partir de `.env.example`) con conexion a PostgreSQL y secretos de auth:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/torneos_americanos?schema=public"
JWT_SECRET="cambia-esto-por-un-secreto-largo-de-32-caracteres-o-mas"
JWT_ISSUER="torneos-americanos"
JWT_AUDIENCE="torneos-americanos-app"
```

3. Sincronizar schema de Prisma con la base de datos (sin pelearte con variables de entorno):

```bash
npm run prisma:generate
npm run prisma:db:push
```

Si queres aplicar historial de migraciones en lugar de `db push`, usa:

```bash
npm run prisma:migrate:deploy
```

4. Crear usuario inicial:

```bash
npm run seed:user
```

5. Levantar entorno de desarrollo:

```bash
npm run dev
```

6. Abrir:

```text
http://localhost:3000
```

## Scripts disponibles

- `npm run dev`: entorno local
- `npm run build`: build de produccion
- `npm run start`: correr build de produccion
- `npm run lint`: linter (`eslint`)
- `npm test`: tests unitarios
- `npm run test:watch`: tests en modo watch
- `npm run prisma:generate`: genera cliente de Prisma usando `.env.local`
- `npm run prisma:db:push`: sincroniza schema a la DB usando `.env.local`
- `npm run prisma:migrate:deploy`: aplica migraciones existentes usando `.env.local`
- `npm run prisma:studio`: abre Prisma Studio usando `.env.local`
- `npm run seed:user`: crea/actualiza usuario inicial `admin`
- `npm run user:create -- --username=<usuario> --password=<password>`: crea o actualiza un usuario manual

Los scripts de Prisma (`seed:user`, `user:create`, `backfill:parejas`) cargan automaticamente `.env.local`.

## Flujo funcional de la app

1. Login (`/login`):

- acceso con `username` + `password`.
- la sesion usa JWT en cookies `httpOnly` (sin localStorage).

2. Dashboard (`/dashboard`) y listado privado (`/torneos`):

- cada usuario ve solo sus torneos.
- acceso rapido para crear torneo en `/torneos/create`.

3. Crear torneo (`/torneo/nuevo`):

- define nombre, cantidad de parejas, formato de grupos y metodo de desempate.
- permite elegir modo de parejas:
  - `Personalizadas`: `Nombre 1` + `Nombre 2`.
  - `Genericas`: `Pareja 1`, `Pareja 2`, etc.

4. Fase de grupos (`/torneo/[id]/grupos`):

- cargar resultados con formato `6-x` (x entre `0` y `5`).
- en grupos de 4, la ronda 2 se genera automaticamente al completar ronda 1.

5. Ranking (`/torneo/[id]/ranking`):

- orden por `diff` (GF-GC) y luego `GF`.
- deteccion de empates solo cuando afectan el corte de BYEs.

6. Desempate (`/torneo/[id]/desempate`):

- resolucion por `MONEDA` o `TIEBREAK` segun configuracion.
- en empates multiples del corte de BYE, usa eliminacion progresiva: cada duelo elimina 1 pareja.
- el backend controla el cierre del desempate (el cliente no puede forzar finalizacion).
- cuando quedan exactamente los BYEs en disputa, vuelve a estado `RANKING`.

7. Bracket (`/torneo/[id]/bracket`):

- genera cuadro (potencia de 2) con seedings.
- evita cruces de rivales de grupo en primera ronda cuando hay swap valido.
- progresion automatica entre rondas.

8. Finalizacion:

- cuando se completa la final, el torneo pasa a `FINALIZADO` (solo lectura).

## Reglas de negocio importantes

- UI de creacion: entre `6` y `30` parejas.
- API de creacion: valida entre `6` y `30` parejas.
- Partidos validos: solo resultados cerrados `6-x` con `x <= 5`.
- No se permite editar torneos en estado `FINALIZADO`.
- Vista publica de bracket en solo lectura: `/torneo/[id]/bracket?view=public`.
- Todas las operaciones privadas validan ownership por `userId`.

## API (resumen)

Todas las rutas responden en formato:

- exito: `{ success: true, data: ... }`
- error: `{ success: false, error: string }`

- `POST /api/auth/login`: valida credenciales y setea cookies JWT.
- `POST /api/auth/refresh`: rota refresh token y renueva access token.
- `POST /api/auth/logout`: revoca sesion y limpia cookies.
- `POST /api/torneo`: crear torneo y grupos iniciales (recibe `pairMode` y opcionalmente `parejas[]`).
- `GET /api/torneo/[id]`: obtener torneo completo.
- `PUT /api/torneo/[id]`: editar nombre, metodo y modo/estructura de parejas.
- `DELETE /api/torneo/[id]`: eliminar torneo completo.
- `PUT /api/torneo/[id]/resultado-grupo`: guardar score de partido de grupos.
- `POST /api/torneo/[id]/ranking`: calcular ranking y generar desempates pendientes.
- `POST /api/torneo/[id]/desempate`: resolver desempate.
- `POST /api/torneo/[id]/bracket`: generar/re-generar cuadro eliminatorio.
- `PUT /api/torneo/[id]/resultado-bracket`: guardar resultado de match eliminatorio.

## Estructura principal

- `src/app`: paginas UI y rutas API (App Router)
- `src/lib/auth`: utilidades de password, JWT, sesiones y guards
- `src/components/tournament`: componentes de torneo (grupos, ranking, desempate, bracket)
- `src/lib/tournament-engine`: logica de grupos, ranking, seedings y bracket
- `src/lib/tournament-service.ts`: orquestacion de casos de uso con DB
- `src/lib/bracket-progression.ts`: sincronizacion de avance de cuadro
- `prisma/schema.prisma`: modelo de datos

## Compatibilidad de datos legacy

Si tenes registros viejos con solo `nombre` y `jugador1/jugador2` en `NULL`, podes ejecutar:

```bash
npm run backfill:parejas
```

El script intenta parsear `nombre` con separadores `" - "` y `" / "`. Si no puede resolver un registro, lo deja sin romper nada y lo lista para revision manual.

## Crear usuarios manualmente

Tenes dos caminos:

1. Script recomendado (actualiza o crea `admin`):

```bash
npm run seed:user
```

Credenciales iniciales del script:

- `username`: `admin`
- `password`: `admin123`
