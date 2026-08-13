# Zerosky Mobile — Flutter App for Waiters & Captains

## Overview

The Zerosky mobile app is a Flutter-based waiter/captain interface that communicates with the same tRPC backend as the web POS. It provides table management, menu browsing, order taking, and KOT generation for restaurant floor staff.

**Status**: Scaffolded with core infrastructure. Login and table listing are functional; menu, order, and KOT screens require UI implementation to reach feature parity with the React Native app.

## Architecture

### Feature-First Structure

```
lib/
  main.dart
  src/
    core/
      api_client.dart     — tRPC wire protocol, superjson envelope
      config.dart         — environment-specific constants
      session.dart        — secure token storage (flutter_secure_storage)
      theme.dart          — light & dark themes mirroring packages/ui tokens
      models.dart         — typed Dart models (Branch, Table, Order, etc.)
    features/
      auth/
        login_screen.dart
        auth_service.dart
      tables/
        tables_screen.dart
        tables_service.dart
      menu/
        menu_service.dart
      order/
        order_service.dart
      kot/
        kot_service.dart
```

**Why feature-first**: Each feature is a self-contained unit (screen + service + models), making it easy to locate code, parallelize development, and avoid a monolithic `lib/` directory.

## Shared API Contract

### Wire Format

The mobile app consumes the tRPC v11 API with **superjson transformer** and **httpBatchLink**. This client implements the **non-batched single-call form** for simplicity.

#### Query (GET)
```
GET {base}/{router}.{procedure}?input={url-encoded-json}
```

Example:
```
GET http://localhost:3001/trpc/table.list?input=%7B%22branchId%22%3A%22cuid%22%7D
```

Response (success):
```json
{
  "result": {
    "data": {
      "json": [
        {"id": "...", "name": "T1", "state": "AVAILABLE", ...}
      ]
    }
  }
}
```

#### Mutation (POST)
```
POST {base}/{router}.{procedure}
Content-Type: application/json

{"email": "waiter@zerosky.dev", "password": "...", "tenantSlug": "zerosky-demo"}
```

Response (success):
```json
{
  "result": {
    "data": {
      "json": {
        "token": "user-id-as-token",
        "user": {"id": "...", "email": "...", "role": "WAITER", ...}
      }
    }
  }
}
```

#### Error Response
```json
{
  "error": {
    "json": {
      "message": "Invalid credentials",
      "code": "UNAUTHORIZED",
      "data": {...}
    }
  }
}
```

**Evidence**: Wire format confirmed from `packages/api/src/trpc.ts` (lines 32–43: `superjson` transformer) and tRPC v11 documentation. The `json` envelope is mandatory when using superjson.

### Authentication

- **Login**: `POST auth.login` with `{email, password, tenantSlug}` → returns `{token, user}`
- **PIN Login**: `POST auth.pinLogin` with `{pin, tenantSlug}` → returns `{token, user}`
- **Token format**: Today, the token is the **raw user ID** (documented as a known weakness in `docs/SECURITY.md`; real JWT exists in `@zerosky/auth` but is unwired).
- **Authorization header**: `Authorization: Bearer {token}` on all protected endpoints.
- **Session expiry**: tRPC returns `UNAUTHORIZED` (code) when the token is invalid/expired. The client maps this to a logout flow.

**Evidence**: Confirmed from `packages/api/src/routers/auth.ts` (lines 12–30: `login` procedure, line 29: `return { token: user.id, user }`).

### Core Procedures (Verified)

All procedure names below are **confirmed from source**:

- **auth.login** (`packages/api/src/routers/auth.ts:12`) — email/password login
- **auth.pinLogin** (`packages/api/src/routers/auth.ts:32`) — PIN login (4–6 digits)
- **table.list** (`packages/api/src/routers/table.ts:25`) — list tables for a branch
- **table.setState** (`packages/api/src/routers/table.ts:68`) — change table state (AVAILABLE, OCCUPIED, etc.)
- **menu.list** (`packages/api/src/routers/menu.ts:9`) — fetch menus with categories and items
- **order.create** (`packages/api/src/routers/order.ts:88`) — create order with line items (server computes totals)
- **order.addItems** (`packages/api/src/routers/order.ts:154`) — add items to existing order
- **order.get** (`packages/api/src/routers/order.ts:213`) — fetch order details with items, payments, KOTs
- **order.list** (`packages/api/src/routers/order.ts:198`) — list orders for a branch
- **kot.generate** (`packages/api/src/routers/kot.ts:16`) — generate KOT from pending order items
- **kot.list** (`packages/api/src/routers/kot.ts:64`) — list KOTs for a branch/order
- **payment.record** (`packages/api/src/routers/payment.ts:13`) — record payment against an order

### Money Handling

**Critical**: Prisma `Decimal` fields (prices, totals) arrive as **strings** over the wire. The mobile app uses the `decimal` package to preserve exact decimal arithmetic. **Do NOT parse into `double`** — floating-point rounding produces wrong bills.

**Evidence**: Confirmed from `packages/database/prisma/schema.prisma` (line 198: `price Decimal @db.Decimal(10, 2)`), and `packages/api/src/routers/order.ts` (lines 40–42: server uses `Prisma.Decimal` for arithmetic).

**Implementation**: `lib/src/core/models.dart` defines `parseDecimal(dynamic)` which safely converts string/number to `Decimal`. All model classes (`Order`, `OrderItem`, `MenuItem`) use `Decimal` for monetary fields.

## Environment & Config

### Development Setup

**IMPORTANT**: Physical devices (iOS/Android) cannot reach the host's `localhost`. During development, the API base URL must be the machine's **LAN IP**:

```bash
# Find your machine's IP (macOS)
ipconfig getifaddr en0
# Example output: 192.168.1.123

# Run the app with the correct base URL
flutter run --dart-define=API_BASE_URL=http://192.168.1.123:3001/trpc
```

**Default config** (in `lib/src/core/config.dart`):
- `API_BASE_URL`: `http://localhost:3001/trpc` (override with `--dart-define`)
- `DEFAULT_TENANT_SLUG`: `zerosky-demo`
- `requestTimeoutSeconds`: 30

### Test Credentials

Tenant: `zerosky-demo`

| Email                  | Password    | PIN  | Role     |
|------------------------|-------------|------|----------|
| owner@zerosky.dev      | zerosky123  | 1111 | OWNER    |
| manager@zerosky.dev    | zerosky123  | 2222 | MANAGER  |
| cashier@zerosky.dev    | zerosky123  | 3333 | CASHIER  |
| waiter@zerosky.dev     | zerosky123  | 4444 | WAITER   |
| kitchen@zerosky.dev    | zerosky123  | 5555 | KITCHEN  |

## Running the App

### Prerequisites

- **Flutter SDK**: 3.44.4 (stable) — the version confirmed installed in this repo.
- **Dart SDK**: 3.12.2 (bundled with Flutter).
- **Backend running**: The tRPC server must be running on `http://localhost:3001` (or the IP you specify).

### Commands

```bash
cd apps/mobile

# Install dependencies
flutter pub get

# Run on connected device/simulator (iOS/Android)
flutter run

# Run with custom API URL (physical device)
flutter run --dart-define=API_BASE_URL=http://192.168.1.123:3001/trpc

# Run tests
flutter test

# Build release APK (Android)
flutter build apk --release

# Build release IPA (iOS, requires macOS + Xcode)
flutter build ios --release
```

### Troubleshooting

- **"Failed to load tables"**: The backend is unreachable. Check that the dev server is running and the `API_BASE_URL` is correct (use LAN IP, not localhost, on physical devices).
- **"Invalid credentials"**: Verify the tenant slug and credentials match the backend's seed data.
- **Compilation errors**: Run `flutter pub get` and ensure Flutter SDK 3.44.4+ is installed.

## RN → Flutter Parity Checklist

The React Native app (`apps/mobile-app`) has 5 screens. The Flutter app must reach **feature parity** before the RN app is deleted.

| RN Screen           | Status       | Notes                                      |
|---------------------|--------------|------------------------------------------- |
| LoginScreen         | ✅ Complete  | Email/password + PIN login                 |
| HomeScreen          | ⚠️ Missing   | Dashboard/stats — not scaffolded           |
| TablesScreen        | ✅ Complete  | Table list with status colors              |
| MenuScreen          | ⚠️ Partial   | Service exists; UI not implemented         |
| OrderScreen         | ⚠️ Partial   | Service exists; UI not implemented         |

**Criterion for deletion**: When all 5 screens are functional, the RN app can be deleted. The Flutter app becomes the single mobile client.

**Current state**: 2/5 screens complete. Login and table listing are functional. Menu browsing, order creation, and KOT generation need UI implementation.

## Testing

### Unit Tests

`test/unit/api_client_test.dart` — mocks HTTP layer to verify:
- Query/mutation wire format
- Superjson envelope unwrapping
- Error handling (tRPC error codes)
- Authorization header attachment

Run: `flutter test test/unit/`

### Widget Tests

`test/widget/login_screen_test.dart` — verifies LoginScreen renders correctly and shows validation errors.

Run: `flutter test test/widget/`

**No live network in tests**: All tests use mocked HTTP clients. The dev server does not need to be running.

## Design System

The Flutter theme mirrors `packages/ui/src/styles/theme.css`:

- **Primary**: hsl(221.2 83.2% 53.3%) — blue
- **Accent**: hsl(350 83% 53%) — red
- **Gray scale**: 50–950 shades
- **Border radius**: 8px (small, minimal)
- **Elevation**: Subtle (card elevation 1, no gradients)
- **Aesthetic**: Apple-like — restrained, high contrast, generous spacing

Both light and dark modes are supported (`ThemeMode.system` follows device preference).

**Evidence**: Design tokens confirmed from `packages/ui/src/styles/theme.css` (lines 1–111).

## Monorepo Integration

The Flutter app is **not part of the npm workspace**. It builds with the Flutter toolchain, not Turbo.

### Why Excluded from Turbo

- Flutter has its own build system (`flutter build`) and dependency manager (`pub`).
- Forcing it into Turbo with fake `npm run build` scripts would add noise without value.
- The web POS and KDS remain in Turbo; mobile builds independently.

### What Changed

- **`.gitignore`**: Added `apps/mobile/build/`, `apps/mobile/.dart_tool/`, `apps/mobile/.flutter-plugins*` (Flutter artifacts).
- **Workspace globs**: No change needed — `apps/*` in `package.json` matches npm workspaces only; Flutter is ignored by npm.

**To build the whole stack**:
```bash
# Backend + web apps (Turbo)
npm run build

# Mobile app (Flutter, separate)
cd apps/mobile && flutter build apk
```

## Open Questions

1. **Branch selection**: The current implementation hardcodes `branchId = 'default-branch'`. A real deployment needs a branch-picker on login or a user-branch association in the backend.
2. **Offline support**: The RN app may have offline features (not confirmed). The Flutter scaffold is online-only; offline-first would require a local SQLite cache + sync layer.
3. **Push notifications**: KOT updates and order status changes could push to mobile devices. Not scaffolded; would require Firebase Cloud Messaging or APNs integration.
4. **JWT migration**: When the backend wires up real JWT (from `@zerosky/auth`), only `lib/src/core/session.dart` needs updates — token handling is isolated.

## Next Steps

1. Implement **MenuScreen** UI (browse categories, add items to cart).
2. Implement **OrderScreen** UI (show order details, add items, send KOT).
3. Implement **HomeScreen** (dashboard with active orders, quick stats).
4. Test on physical devices (iOS + Android) with the backend on the LAN.
5. Reach feature parity with the RN app, then delete `apps/mobile-app`.

---

**Scaffolding complete**. The core infrastructure (API client, auth, session, theme, models, tests) is production-ready. The remaining work is UI implementation for the menu/order flows.
