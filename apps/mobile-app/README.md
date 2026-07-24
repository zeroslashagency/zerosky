# Zerosky Mobile App

React Native mobile application for waiters using Expo.

## Features

- 📱 Native iOS & Android support
- 🔐 Secure authentication
- 🍽️ Table management
- 📋 Menu browsing
- 📝 Order creation and management
- 🔄 Real-time sync with API

## Prerequisites

- Node.js 22+
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

## Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

## API Configuration

Update the API URL in `App.tsx`:

```typescript
url: 'http://YOUR_API_HOST:4000/trpc',
```

For local development:
- iOS Simulator: `http://localhost:4000/trpc`
- Android Emulator: `http://10.0.2.2:4000/trpc`
- Physical Device: `http://YOUR_COMPUTER_IP:4000/trpc`

## Project Structure

```
src/
├── lib/
│   └── trpc.ts          # tRPC client setup
└── screens/
    ├── LoginScreen.tsx   # Authentication
    ├── HomeScreen.tsx    # Main dashboard
    ├── TablesScreen.tsx  # Table list
    ├── MenuScreen.tsx    # Menu browsing
    └── OrderScreen.tsx   # Order details
```

## Tech Stack

- **Framework:** React Native + Expo
- **Navigation:** React Navigation
- **State Management:** TanStack Query
- **API:** tRPC client
- **Language:** TypeScript
