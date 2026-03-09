# Multi-Deporte / Multi-Formato Refactor Simplification Design

Date: 2026-03-09
Status: Approved by user (section by section)
Scope: Simplificar arquitectura sin romper PADEL + AMERICANO

## 1. Objetivo

Reducir la complejidad actual del refactor multi-deporte/multi-formato manteniendo el flujo productivo vigente:

- login
- creacion de torneo
- PADEL + AMERICANO
- grupos, ranking, desempate, bracket

Direccion acordada:

- mantener posibilidad futura de FUTBOL/TENIS y formatos LARGO/LIGA
- evitar sobreingenieria ahora
- base limpia para rankings/stats calculados (no persistidos)

## 2. Auditoria de Implementacion Actual

### 2.1 Lo que esta bien y se conserva

- Engine legacy de americano (groups/ranking/bracket) estable y entendible.
- Flujo API actual por estados de torneo funciona end-to-end.
- Manejo base de errores con `ApiError` + `fromUnknownError`.
- Validaciones de entrada con `zod`.

### 2.2 Problemas detectados

1. Duplicacion de dominio en DB:
- Conviven modelos legacy y v2 para mismas responsabilidades.
- Se incrementa costo de mantenimiento y riesgo de inconsistencia.

2. Doble escritura sin consumo real:
- Se escribe en `Participante/Jugador/Partido` pero casi todo runtime lee legacy (`Pareja/PartidoGrupo/BracketMatch`).

3. Abstraccion prematura:
- `SportStrategy + FormatStrategy + Factory` con stubs no implementados.
- Stub files (`Largo`, `Liga`) agregan ruido y warnings.

4. Mezcla de tipos:
- `types.ts` une contratos legacy y v2, dificultando saber el camino productivo real.

5. Modelo `Partido` sobredimensionado:
- muchas columnas nullable por deportes/formatos no habilitados.

6. Codigo “futuro” no usado en runtime:
- `rankings/*`, parte de `shared/*`, `useTournament` no integrados de forma efectiva hoy.

## 3. Arquitectura Simplificada Objetivo

## 3.1 Principio rector

Nucleo minimo real hoy + extension clara manana.

- Sin clases abstractas o factories formales con un solo caso real.
- Abstraccion solo cuando haya duplicacion real entre implementaciones productivas.

## 3.2 Modelo de datos de dominio objetivo (6 modelos)

Sin contar auth (`User`, `AuthSession`), objetivo final:

1. `Torneo`
2. `Participante`
3. `Jugador`
4. `ParticipanteJugador` (tabla puente)
5. `Partido`
6. `EventoPartido`

Con esto se cumple objetivo `< 8` modelos de dominio.

## 3.3 Modelos a eliminar/fusionar

- Eliminar: `Pareja`, `Grupo`, `PartidoGrupo`, `Bracket`, `BracketMatch`, `Desempate`, `FechaCompetencia`, `Categoria`, `RankingConfig`.
- Fusionar:
  - Pareja/Equipo/Individual -> `Participante.tipo`
  - Grupo/Bracket/Desempate -> `Partido.fase` + `groupKey` + `ronda` + `orden`
  - puntos de ranking -> `Torneo.config.puntosInstancia`

## 3.4 Score simplificado

En `Partido`:

- `score Json?` (estructura validada por aplicacion)
- no “cajon de sastre”; schemas por combinacion `deporte+formato`

Ejemplos acordados:

- Padel americano:
`{ "sets": [{ "p1": 6, "p2": 3 }] }`

- Futbol:
`{ "goles": { "local": 2, "visitante": 1 } }`

- Futbol con penales:
`{ "goles": { "local": 1, "visitante": 1 }, "penales": { "local": 4, "visitante": 3 } }`

## 3.5 Rankings y stats

- No tabla de ranking persistida.
- Ranking calculado on-demand desde:
  - resultados en `Partido`
  - eventos en `EventoPartido`
- Solo se persiste configuracion de puntaje en `Torneo.config`.

## 4. Engine, API, UI (simplificados)

## 4.1 Engine

Estructura propuesta:

- `src/lib/competition/americano-padel.ts` (implementacion productiva)
- `src/lib/competition/scoring/padel-americano.ts`
- `src/lib/competition/scoring/futbol.ts` (cuando se habilite)
- `src/lib/competition/common/{groups,seeding,bracket}.ts`

Sin `Strategy` formal por ahora.
Resolver por mapa simple de combinaciones habilitadas.

## 4.2 API

- Mantener rutas actuales para no romper frontend.
- Uniformar errores:
`{ success:false, error, errorCode }`
- `errorCode` estable:
`VALIDATION_ERROR`, `UNSUPPORTED_COMBINATION`, `CONFLICT_STATE`, `NOT_FOUND`, `INTERNAL_ERROR`.

## 4.3 UI

- Mantener wizard deporte/formato visible.
- Soporte real: solo combinaciones habilitadas.
- Mensaje claro para combinaciones futuras.
- Flujo de americano no cambia.

## 5. Alcance Futuro (NO implementar ahora)

- `FechaCompetencia`
- `Categoria`
- Implementacion de `LIGA`
- Implementacion de TENIS completa
- Eventos avanzados (`ACE`, `WINNER`, `ERROR_NO_FORZADO`)
- Pantallas complejas de rankings

## 6. Plan Incremental (opcion 2, reversible)

### Etapa 1: Consolidar engine real

- eliminar stubs y capas no usadas en runtime
- dejar modulos concretos de americano
- validar build/tests

### Etapa 2: Eliminar doble escritura

- en creacion de torneo, usar un solo camino de persistencia
- conservar comportamiento funcional identico
- validar create torneo (6, 12, 30; CUSTOM/GENERIC)

### Etapa 3: Migracion de modelo a nucleo de 6 modelos

- aplicar schema simplificado
- adaptar services/routes al nuevo modelo
- gates de regresion por flujo completo

### Etapa 4: Introducir `score Json` validado

- migrar carga de resultados a contrato JSON
- mantener reglas de americano actuales

### Etapa 5: Ranking calculado

- mover puntos de instancia a `Torneo.config`
- calcular on-demand desde `Partido` y `EventoPartido`

### Etapa 6: Normalizar API errors y cleanup final

- error envelope y codigos consistentes
- remover codigo muerto y archivos no usados

## 7. Criterios de Exito

- flujo PADEL + AMERICANO funcional sin regresiones
- menos de 8 modelos de dominio Prisma
- cero stubs vacios
- cero abstracciones formales innecesarias
- arquitectura explicable en pocos modulos concretos

## 8. Riesgos y mitigaciones

Riesgo principal:
- romper flujo vigente al migrar de modelos legacy a modelo unico.

Mitigacion:
- etapas cortas + verificacion build/test por etapa
- pruebas manuales de smoke por estado de torneo
- commits atomicos con rollback facil

