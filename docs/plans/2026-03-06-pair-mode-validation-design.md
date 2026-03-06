# Diseño: Modo de Parejas (Genéricas/Personalizadas) + Validación de Nombres

Fecha: 2026-03-06
Estado: Aprobado
Contexto: App de torneos americanos (Next.js + Prisma)

## 1. Objetivo

Reintroducir la opción de crear/editar parejas en dos modos:

- `Personalizadas` (por defecto): carga manual de `Nombre 1` y `Nombre 2`.
- `Genéricas`: carga automática de `Pareja 1`, `Pareja 2`, etc.

Además, endurecer validación de strings para nombres manuales y mantener consistencia de guardado en DB con bajo costo de mantenimiento.

## 2. Decisiones aprobadas

1. El modo por defecto en creación será `Personalizadas`.
2. Debe existir opción explícita para `Genéricas`.
3. En modo `Genéricas` se guarda como antes:
   - `nombre = "Pareja N"`
   - `jugador1 = null`
   - `jugador2 = null`
4. En modo `Personalizadas` se mantiene:
   - `jugador1` obligatorio
   - `jugador2` obligatorio
   - `nombre` generado automáticamente (`jugador1 - jugador2`)
5. Validación de strings manuales (opción 2 elegida):
   - solo letras y espacios
   - número opcional solo al final con espacio (ej: `Perez 2`)
   - no iniciar con número
   - no caracteres especiales

## 3. UX / Interfaz (sin romper lenguaje visual actual)

Se conserva el diseño existente (tokens, superficies, bordes y escala).

### 3.1 Crear torneo (`NewTournamentForm`)

- Agregar selector de modo: `Personalizadas` / `Genéricas`.
- Estado inicial: `Personalizadas`.
- Si `Personalizadas`:
  - mostrar inputs `Nombre 1` + `Nombre 2` por pareja.
  - mostrar preview: `Nombre de pareja: X - Y`.
  - validar inline y bloquear submit si hay errores.
- Si `Genéricas`:
  - ocultar inputs manuales.
  - mostrar texto de confirmación: se guardará como `Pareja 1..N`.
  - permitir submit sin carga manual de nombres.

### 3.2 Editar torneo (`EditTournamentForm`)

- Mismo selector de modo.
- Detección inicial del modo:
  - `Genéricas` si todas las parejas están en patrón genérico (`jugador1/jugador2 null` y `nombre` tipo `Pareja N`).
  - caso contrario `Personalizadas`.
- Al cambiar a `Genéricas`: deshabilitar requisitos manuales y persistir patrón genérico.
- Al cambiar a `Personalizadas`: exigir nuevamente `Nombre 1` y `Nombre 2` por pareja.

## 4. Reglas de validación

Aplicar validación en frontend y backend.

### 4.1 Normalización

- `trim()` en extremos.
- colapsar espacios múltiples internos a un espacio.

### 4.2 Patrón permitido (modo personalizado)

Regex objetivo:

`^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*(?: [0-9]+)?$`

Implica:

- válido: `Perez`, `Juan Perez`, `Perez 2`
- inválido: `2Perez`, `Perez_2`, `Pérez#`, `Lopez-1`

### 4.3 Reglas de negocio adicionales

- `jugador1` y `jugador2` obligatorios en modo `Personalizadas`.
- `jugador1 !== jugador2` (comparación case-insensitive tras normalizar).

## 5. Contrato de API

### 5.1 `POST /api/torneo`

Agregar `pairMode: "CUSTOM" | "GENERIC"`.

- `CUSTOM`:
  - requiere `parejas[]` con `{ jugador1, jugador2 }` válidos.
  - persiste `jugador1`, `jugador2`, `nombre derivado`.
- `GENERIC`:
  - ignora/omite carga manual.
  - persiste `nombre = "Pareja N"`, `jugador1/jugador2 = null`.

### 5.2 `PUT /api/torneo/[id]`

También soporta `pairMode`.

- `CUSTOM`: actualiza `jugador1`, `jugador2`, `nombre derivado`.
- `GENERIC`: regenera todas las parejas a patrón genérico manteniendo IDs.

## 6. Compatibilidad con vistas

Para grupos, ranking, desempates y bracket:

- usar helper de display consistente:
  - si hay jugadores -> mostrar derivado
  - si no hay jugadores -> usar `nombre` (ej `Pareja N`)

No cambia la lógica de grupos, ranking ni fixture.

## 7. Errores y mensajes

- Errores inline por input en modo `Personalizadas`.
- Mensaje global de formulario cuando existan parejas inválidas.
- Botones de guardar/crear deshabilitados mientras haya invalidaciones.
- Backend devuelve mensajes explícitos de formato inválido, faltantes o jugadores iguales.

## 8. Testing

### 8.1 Unit

- tests de utilidades de nombre:
  - regex válido/inválido
  - normalización
  - jugadores iguales/diferentes

### 8.2 API

- `POST` y `PUT` con `pairMode=CUSTOM` y `pairMode=GENERIC`.
- rechazos por formato inválido, faltantes y nombres iguales.

### 8.3 UI smoke

- alternar modo en crear/editar.
- verificar bloqueo/desbloqueo de submit.
- verificar payload enviado acorde al modo.

## 9. Alcance y no alcance

### En alcance

- selector de modo en crear/editar
- validación estricta de nombres manuales
- persistencia dual (`CUSTOM` vs `GENERIC`)

### Fuera de alcance

- rediseño visual completo
- cambios de schema en DB
- cambios de reglas de ranking/bracket

## 10. Plan de implementación (resumen)

1. Extender utilidades de `pair-utils` con regex de nombres y helper de modo genérico.
2. Actualizar `POST/PUT` para soportar `pairMode` y validaciones.
3. Actualizar formularios `New/Edit` con selector de modo y comportamiento condicional.
4. Ajustar tests unitarios/API/UI smoke.
5. Validar con `lint`, `test`, `build`.
