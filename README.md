# Guess the Qubit Monorepo

Unified monorepo for the **Guess the Qubit** interactive quantum educational applications, containing both the mobile AR application and the Unreal Engine desktop application.

## Repository Structure

```
guess-the-qubit/
├── apps/
│   ├── expo/      # Expo SDK 57 mobile application (iOS, Android)
│   └── unreal/    # Unreal Engine 5.8 interactive application (Windows, Mac, Linux)
├── patches/       # Committed pnpm dependency patches
├── package.json   # Monorepo root package descriptor (pnpm 11.0.8 & Turbo)
├── pnpm-workspace.yaml # Workspace definitions, overrides, and patch registrations
├── turbo.json     # Turborepo task pipeline configuration
└── .easignore     # Root EAS ignore ensuring Unreal assets are excluded from mobile builds
```

## Applications & Supported Release Policy

### `apps/expo` (Mobile AR Application)
- **Framework**: Expo SDK 57, React Native 0.86, React 19, React Viro AR.
- **Naming**: Named `expo` under `apps/` to allow future platforms while maintaining platform neutrality.
- **Release Targets**: **iOS** and **Android** are the supported release platforms.
- **Web Policy**: Expo web dependencies (`react-native-web`) are preserved for developer tooling and compatibility; future web support is not claimed or released under current release policy.
- **Identifier**: `com.djleg.guessthequbitar`, scheme `guess-the-qubit-ar`.

### `apps/unreal` (Unreal Engine 5.8 Application)
- **Engine**: Unreal Engine 5.8.
- **Release Targets**: **Windows (`Win64`)**, **macOS (`Mac`)**, and **Linux (`Linux`)** form the supported release matrix under release policy.
- **Packaging Policy**: Supported release policy rather than a packaging ban. Native builds require matching platform toolchains and an installed Unreal Engine 5.8 editor/UAT.
- **Orchestration**: Represented by `@guess-the-qubit/unreal`. JS orchestration scripts verify descriptors, configuration, and host readiness; JS checks do not claim to compile or validate native UE builds.

## Dependency Management & Workspace Security

- **Package Manager**: `pnpm@11.0.8`.
- **Linker**: Hoisted linker (`nodeLinker: hoisted`) configured in `pnpm-workspace.yaml` and `.npmrc` to maintain React Native / Metro module resolution compatibility.
- **Lifecycle Script Security**: Strict script allowlist (`onlyBuiltDependencies: ['unrs-resolver']`) configured to ensure third-party package lifecycle security.
- **Committed Decoder Patch**: `patches/decode-uri-component@0.5.0.patch` adapts `decode-uri-component@0.5.0` to support both CommonJS `require()` and ESM `import`, maintaining the reviewed decoding algorithm while eliminating unsafe runtime hardlink mutations.
- **Scoped Overrides**:
  - `query-string@7.1.3>decode-uri-component`: `0.5.0`
  - `xcode`: `3.0.1`
  - `xcode@3.0.1>uuid`: `11.1.1`

## Development & Verification

### Install Dependencies
```bash
pnpm install --frozen-lockfile
```

### Run Checks & Tests
```bash
# Run all workspace checks
pnpm run ci:verify

# Or run individual checks
pnpm run lint
pnpm run typecheck
pnpm run test

# Unreal host check & release matrix
pnpm run unreal:check
pnpm run unreal:matrix
```

### Expo Native Exports
```bash
# Serial iOS and Android exports
pnpm run expo:build:ios
pnpm run expo:build:android
```

## EAS Build Invocation & Archive Inspection

Mobile builds via Expo Application Services (EAS) should be invoked from the `apps/expo` directory. Root `.easignore` protects against leaking or uploading `apps/unreal` binaries, assets, maps, and local secrets.

To inspect the build archive locally without making cloud service calls:
```bash
cd apps/expo
npx eas-cli build:inspect -p ios -s archive -o ../../temp/eas-archive-ios --force
```

## License

All rights reserved. Specific license terms are pending.
