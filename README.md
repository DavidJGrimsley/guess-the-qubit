# Guess the Qubit Monorepo

Unified monorepo for the **Guess the Qubit** interactive quantum educational applications, containing both the mobile AR application and the Unreal Engine desktop application.

## Repository Structure

```
guess-the-qubit/
├── apps/
│   ├── expo/          # Expo SDK 57 mobile application (iOS, Android)
│   └── unreal/        # Unreal Engine 5.8 interactive application (Windows, Mac, Linux)
├── patches/           # Committed pnpm dependency patches
├── scripts/           # Monorepo tooling and EAS ignore simulation scripts
├── package.json       # Monorepo root package descriptor (pnpm 11.0.8 & Turbo)
├── pnpm-workspace.yaml # Workspace definition and all pnpm settings: linker, narrow overrides, patch, build allowlist
├── turbo.json         # Turborepo task pipeline configuration
├── .easignore         # Root EAS ignore ensuring Unreal assets are excluded from mobile builds
└── .gitattributes     # Enforces LF line endings for patches and binary rules for Unreal assets
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
- **Editor-Only Developer Plugins**: Developer tooling plugins (`AllToolsets`, `AIModuleToolset`, `MCPClientToolset`, `ModelContextProtocol`) are configured with `"TargetAllowList": ["Editor"]` matching `ModelingToolsEditorMode`, ensuring they remain available in the editor without leaking into shipping game targets.

## Dependency Management & Workspace Security

- **Package Manager**: `pnpm@11.0.8`.
- **Single settings file**: All pnpm 11 workspace settings live in `pnpm-workspace.yaml` (`nodeLinker`, `overrides`, `patchedDependencies`, `allowBuilds`). There is no `.npmrc` and no `pnpm`/`overrides` block in any `package.json`.
- **Linker**: Hoisted linker (`nodeLinker: hoisted`) to maintain React Native / Metro module resolution compatibility.
- **Lifecycle Script Security**: Strict script allowlist (`allowBuilds: { unrs-resolver: true }`); `unrs-resolver`'s postinstall is the only third-party build script that runs.
- **Committed Decoder Patch**: `patches/decode-uri-component@0.5.0.patch` adapts `decode-uri-component@0.5.0` to support both CommonJS `require()` and ESM `import`, maintaining the reviewed decoding algorithm while eliminating unsafe runtime hardlink mutations. Protected by `.gitattributes` to enforce `eol=lf` across checkout environments.
- **Scoped compatibility overrides** (the only two overrides, mirroring the original `apps/expo` npm `overrides`):
  - `query-string@7.1.3>decode-uri-component`: `0.5.0`
  - `xcode@3.0.1>uuid`: `11.1.1`
- **Dependency baseline**: `pnpm-lock.yaml` was generated from the original `apps/expo/package-lock.json` with `pnpm import`, so locked versions are the original npm versions rather than fresh resolutions. A version-by-version comparison of the 877 packages in the npm baseline against the 883 in `pnpm-lock.yaml` finds no version differences for any shared package (direct and transitive). The remaining divergence is exactly:
  - `turbo@2.11.10` and its six `@turbo/*` platform binaries exist only in the monorepo lockfile (new workspace tooling).
  - `use-sync-external-store@1.7.0` exists only in the npm baseline. npm had installed it as the optional peer of `zustand`; pnpm does not install optional peers, and the app only imports `zustand/vanilla`, which does not use it.

  No version pins were added to force this: there are no broad `overrides`, so `pnpm update` and future Expo SDK upgrades are not blocked. Dependency upgrades are intentionally outside this migration.

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

# Unreal static structure (exact-case paths, editor-only plugins, empty ApiKey, GameFeatureData rule),
# orchestration script tests, EAS ignore simulation, and release matrix. These never run Unreal Engine.
pnpm run unreal:check
pnpm run unreal:test
pnpm run verify:eas-ignore
pnpm run unreal:matrix

# Host-dependent: detects an installed UE 5.8 for this OS. Exits non-zero (UNVERIFIED) when none is found.
# Detection only; it does not compile, cook, or run tests. Not part of hosted CI.
pnpm run unreal:check:host
```

Hosted CI (`.github/workflows/checks.yml`, Ubuntu) runs the frozen install, `unreal:check`, `unreal:matrix`, `unreal:test`, `verify:eas-ignore`, Expo lint/typecheck/tests, and the serial iOS and Android exports. CI never compiles Unreal and caches no native or host-specific results (Turbo marks `check:host`, `matrix`, and `test:automation` as uncacheable).

### Expo Native Exports
```bash
# Serial iOS and Android exports
pnpm run expo:build:ios
pnpm run expo:build:android
```

### Unreal Engine Compilation & Automation
These need an installed Unreal Engine 5.8 with its platform toolchain (MSVC on Windows). Run them from the repository root in PowerShell on Windows:
```powershell
# 1. Compile the editor binary (required once per clean checkout before automation can load the QuantumApi module)
& "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" UnrealEditor Win64 Development "-Project=$PWD\apps\unreal\GuessTheQubit.uproject" -WaitMutex

# 2. Run native automation tests (checks the engine's own "Test Completed. Result={...}" lines, not free-form Error: text)
pnpm run unreal:test:automation

# 3. Build, cook, stage, pak, and archive a Win64 Development package
& "C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun "-project=$PWD\apps\unreal\GuessTheQubit.uproject" -noP4 -platform=Win64 -clientconfig=Development -build -cook -stage -pak -archive "-archivedirectory=$PWD\apps\unreal\Builds" -utf8output -unattended -nosplash
```

If Unreal Engine is installed outside the standard location, set `UNREAL_ENGINE_PATH` (or `UE_5_8_PATH`) to the engine root, the folder that contains `Engine/`. The scripts then look under `Engine/Binaries/Win64`, `Engine/Binaries/Mac`, or `Engine/Binaries/Linux` for the current OS.

Validation status:
- **Windows (UE 5.8.3, MSVC)**: editor compile, `QuantumApi.Runtime.Transport` automation, and the Win64 BuildCookRun package plus a headless smoke launch of the packaged exe were run on a real Windows host while preparing this migration. Re-run them on your machine before a release.
- **macOS and Linux**: supported release targets, but **no native compile, automation, or packaging has been run on either**. The macOS and Linux editor paths and commands are unverified assumptions about the installed-engine layout, covered only by unit tests with injected paths. Treat them as unvalidated until run on a real Mac or Linux host with UE 5.8.
- **Mobile**: iOS and Android exports validate JavaScript and assets only. No signed native build, simulator, or physical-device run has been done.

## EAS Build Invocation & Archive Simulation

Mobile builds via Expo Application Services (EAS) should be invoked from the `apps/expo` directory. Root `.easignore` protects against leaking or uploading `apps/unreal` binaries, assets, maps, and local secrets.

> [!NOTE]
> Offline EAS ignore simulation:
> `eas build:inspect` requires an active EAS account login and prompts to link a project when `extra.eas.projectId` is not configured, so it cannot run offline. Instead, a local simulation checks the root `.easignore` rules against representative paths:
> ```bash
> pnpm run verify:eas-ignore
> ```
> This is an approximation of gitignore-style matching written for this repository. It is **not** the EAS CLI matcher and cannot prove exactly what `eas build` uploads. It guards that `apps/unreal`, local `.ini` files, Turbo caches, and private keys stay excluded while `apps/expo`, patches, and root workspace files are retained.
>
> If an authenticated EAS account and linked project are present, archive inspection can be run with:
> ```bash
> cd apps/expo
> npx eas-cli build:inspect -p ios -s archive -o ../../temp/eas-archive-ios
> ```

## License

All rights reserved. Specific license terms are pending.
