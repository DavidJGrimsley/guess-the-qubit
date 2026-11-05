# Guess the Qubit

Guess quantum measurements with simulator and asynchronous hardware modes in AR.

Standalone app extracted from local source commit `5523f52` on November 4, 2026; see [source details](SOURCE.md). Its published feature baseline is [XR Showcase at `e69ddae`](https://github.com/DavidJGrimsley/xr-showcase/commit/e69ddae38ca6602ca5cd7ca844b9ae75b16767e2). The original repository retains the full development history. This repository begins with an attributed snapshot, includes only this app's feature/assets, and owns its local copy of shared AR/UI code. It has no sibling-repository or workspace dependency. Asset provenance and license files remain with the assets; this extraction does not grant new rights.

## Development

Use Node 22.13 or newer, npm, and the pinned lockfile. Expo SDK 57 / React Native 0.86 and Viro require a native development client. Expo Go cannot run this app.

```sh
npm ci
npm start
```

Copy `.env.example` to ignored `.env` and supply your existing Quantum API demo configuration. The private demo architecture bundles `EXPO_PUBLIC_*` values in the binary; use a server proxy before public binary distribution. No credentials are included. The original Unreal game remains in [guess-the-qubit](https://github.com/DavidJGrimsley/guess-the-qubit).

## Validation

```sh
npm test
npm run build:ios
npm run build:android
```

Exports validate JavaScript and assets, not a signed native build. Physical-device AR, camera permissions, lifecycle behavior, and live external services require device testing. Existing upstream dependency advisories and renderer limitations are not resolved by the repository split. Expo compatibility checks currently recommend six newer SDK 57 patch versions, identically in the source app and these snapshots; dependency upgrades are a separate task.

The URI-decoder postinstall bridge and scoped UUID override preserve the source project's dependency compatibility fixes. Keep install scripts enabled; `tests/dependency-compat.test.cjs` verifies them.

## Native app identity

- Expo slug / URI scheme: `guess-the-qubit-ar`
- iOS bundle ID / Android package: `com.djleg.guessthequbitar`

EAS build profiles are templates. The source EAS project ID and App Store Connect ID are removed. Link a separate EAS project and configure signing/store records before a cloud build or submission. Private environment values and credentials are never copied. The repository split creates no cloud build, EAS project, or store submission.
