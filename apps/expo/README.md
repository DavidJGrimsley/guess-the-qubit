# Guess the Qubit (Mobile AR)

Guess quantum measurements with simulator and asynchronous hardware modes in AR.

This app is the mobile AR client within the unified [Guess the Qubit](https://github.com/DavidJGrimsley/guess-the-qubit) monorepo, located under `apps/expo/`. Its published feature baseline originated from XR Showcase at `e69ddae` and was unified into the monorepo preserving commit history.

## Development

The monorepo uses Node 22.13 or newer and pnpm 11.0.8 with a pinned root `pnpm-lock.yaml`. Expo SDK 57 / React Native 0.86 and Viro require a native development client. Expo Go cannot run this app.

From the repository root:
```sh
pnpm install --frozen-lockfile
pnpm --filter guess-the-qubit-ar start
```

Or from `apps/expo`:
```sh
pnpm start
```

Copy `.env.example` to ignored `.env` and supply your existing Quantum API demo configuration. The private demo architecture bundles `EXPO_PUBLIC_*` values in the binary; use a server proxy before public binary distribution. No credentials are included. The desktop/VR Unreal game lives alongside this app under `apps/unreal/`.

## Validation

From the monorepo root:
```sh
pnpm --filter guess-the-qubit-ar lint
pnpm --filter guess-the-qubit-ar typecheck
pnpm --filter guess-the-qubit-ar test
pnpm --filter guess-the-qubit-ar build:ios
pnpm --filter guess-the-qubit-ar build:android
```

Or run the full monorepo verification:
```sh
pnpm run ci:verify
```

Exports validate JavaScript and assets, not a signed native build. Physical-device AR, camera permissions, lifecycle behavior, and live external services require device testing.

The URI-decoder pnpm patch (`patches/decode-uri-component@0.5.0.patch`) and scoped UUID override preserve dependency compatibility in hoisted workspaces. `apps/expo/tools/compat/prepare-uri-decoder.cjs` performs non-mutating verification during postinstall, and `apps/expo/tests/dependency-compat.test.cjs` verifies active resolution.

## Native App Identity

- Expo slug / URI scheme: `guess-the-qubit-ar`
- iOS bundle ID / Android package: `com.djleg.guessthequbitar`

EAS build profiles are templates. The source EAS project ID and App Store Connect ID are removed. Link a separate EAS project and configure signing/store records before a cloud build or submission. Private environment values and credentials are never copied.
