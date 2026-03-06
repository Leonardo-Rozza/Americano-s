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

2. Crear archivo `.env.local` con la conexion a PostgreSQL:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/torneos_americanos?schema=public"
```

3. Sincronizar schema de Prisma con la base de datos:

```bash
npx prisma generate
npx prisma db push
```

4. Levantar entorno de desarrollo:

```bash
npm run dev
```

5. Abrir:

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

## Flujo funcional de la app

1. Crear torneo (`/torneo/nuevo`):

- define nombre, cantidad de parejas, formato de grupos y metodo de desempate.
- permite elegir modo de parejas:
  - `Personalizadas`: `Nombre 1` + `Nombre 2`.
  - `Genericas`: `Pareja 1`, `Pareja 2`, etc.

2. Fase de grupos (`/torneo/[id]/grupos`):

- cargar resultados con formato `6-x` (x entre `0` y `5`).
- en grupos de 4, la ronda 2 se genera automaticamente al completar ronda 1.

3. Ranking (`/torneo/[id]/ranking`):

- orden por `diff` (GF-GC) y luego `GF`.
- deteccion de empates solo cuando afectan el corte de BYEs.

4. Desempate (`/torneo/[id]/desempate`):

- resolucion por `MONEDA` o `TIEBREAK` segun configuracion.
- cuando no quedan desempates pendientes, vuelve a estado `RANKING`.

5. Bracket (`/torneo/[id]/bracket`):

- genera cuadro (potencia de 2) con seedings.
- evita cruces de rivales de grupo en primera ronda cuando hay swap valido.
- progresion automatica entre rondas.

6. Finalizacion:

- cuando se completa la final, el torneo pasa a `FINALIZADO` (solo lectura).

## Reglas de negocio importantes

- UI de creacion: entre `6` y `30` parejas.
- API de creacion: valida entre `6` y `30` parejas.
- Partidos validos: solo resultados cerrados `6-x` con `x <= 5`.
- No se permite editar torneos en estado `FINALIZADO`.
- Vista publica de bracket en solo lectura: `/torneo/[id]/bracket?view=public`.

## API (resumen)

Todas las rutas responden en formato:

- exito: `{ success: true, data: ... }`
- error: `{ success: false, error: string }`

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
