# Login Rate Limit Store Design

## Objetivo

Mover el rate limit de login desde memoria de proceso a un store compartido para que funcione de manera consistente en despliegues con multiples instancias, sin agregar infraestructura nueva.

## Decision

Se usa PostgreSQL a traves de Prisma como store compartido.

Se descartan estas alternativas:

- `Map` en memoria: no escala horizontalmente y se pierde en reinicios.
- Redis: resuelve bien el problema, pero agrega infraestructura y complejidad que hoy no se justifican.

## Modelo de datos

Se agrega `LoginRateLimit` con estas columnas:

- `keyHash`: hash HMAC de `ip + username normalizado`
- `attempts`: cantidad de intentos dentro de la ventana vigente
- `windowStartedAt`: inicio de la ventana actual
- `blockedUntil`: hasta cuando queda bloqueada la key
- `expiresAt`: momento en el que el registro deja de ser util y puede borrarse

Indices:

- `expiresAt`
- `blockedUntil`

## Semantica

- La key sigue siendo `ip + username.toLowerCase()`.
- El identificador no se persiste en claro; se guarda solo `keyHash`.
- Un login exitoso limpia el registro.
- Si el registro esta vencido, se reinicia desde cero.
- Si supera el maximo dentro de la ventana, devuelve `429`.

## Concurrencia

Las operaciones del rate limiter corren dentro de una transaccion `Serializable` con reintentos acotados ante conflictos.

No se usa SQL crudo con `UPSERT` condicional porque complica demasiado la legibilidad para un caso de auth que necesita ser facil de auditar.

## Limpieza

La limpieza de expirados se hace de forma oportunista desde la misma capa de rate limit, usando `expiresAt`.

No se agrega cron ni job dedicado.

## Impacto esperado

- Misma UX y mismo contrato HTTP para el usuario.
- Comportamiento consistente entre instancias.
- Mejor trazabilidad y menor riesgo operativo en produccion.
