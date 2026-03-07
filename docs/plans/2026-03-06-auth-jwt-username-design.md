# Auth Design - Username + Password + JWT Hibrido

Fecha: 2026-03-06

## Objetivo
Implementar autenticacion segura por `username + password` (sin email), con aislamiento total de datos por usuario para torneos.

## Decisiones aprobadas
- Login por `username` y `password`.
- JWT con `HS256`.
- Esquema hibrido: access token corto + refresh token rotativo con sesion persistida en DB.
- Rutas nuevas: `/login`, `/dashboard`, `/torneos`, `/torneos/create`.
- Mantener rutas internas actuales `/torneo/*`.

## Arquitectura
- `User` + `AuthSession` en Prisma.
- `Torneo.userId` obligatorio.
- Cookies `httpOnly` para tokens.
- Middleware para proteger rutas privadas.
- API routes con verificacion de sesion y ownership en cada operacion.

## Seguridad
- Password hashing con argon2.
- JWT firmado con `JWT_SECRET` y `HS256`.
- Claims con `iss`, `aud`, `sub`, `iat`, `exp`, `jti` y `type`.
- Refresh token validado contra sesion en DB (hash + expiracion + revocacion).
- Rotacion de refresh en cada login/refresh.
- Logout revoca sesion y limpia cookies.

## Flujo
1. Login valida credenciales.
2. Crea sesion en DB.
3. Emite access+refresh.
4. Guarda tokens en cookies `httpOnly`.
5. Middleware protege acceso.
6. API de torneos filtra por `userId`.

## Rutas API nuevas
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`

## Manejo de errores
- Formato existente `{ success, data|error }`.
- `400` validacion
- `401` autenticacion
- `404` no encontrado / no owner
- `409` estado invalido

## Testing objetivo
- Login valido/invalido
- Rutas privadas protegidas
- Ownership de torneos
- Refresh rotation
- Logout con revocacion

## Entregables
- Schema + migracion prisma
- Seed usuario inicial `admin`
- Utilities auth/jwt/password/session
- Middleware auth
- Login UI
- Endpoints login/logout/refresh
- Aislamiento de datos en torneos
