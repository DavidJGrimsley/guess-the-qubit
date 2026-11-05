# Guess the Qubit (Unreal Engine)

Guess the Qubit is an Unreal Engine 5.8 educational game and starter project for learning the basics of qubits, measurement, and quantum gates through a playable Bloch sphere experience.

The current prototype uses the Quantum API Unreal plugin to run a simple rotation gate, animate the qubit state, and ask the player to predict the measurement result. The goal is to grow this into a friendly interactive lesson path that starts with intuition and gradually introduces real quantum computing concepts.

## Goals

- Teach what a qubit is without starting from dense math.
- Show the Bloch sphere as a playable object, not just a static diagram.
- Let players experiment with gates, measurement, superposition, and hardware-backed jobs.
- Provide a clean Unreal starter project for developers using the Quantum API plugin.

## Current Status

This repo is an early playable prototype. It currently includes:

- A neon Bloch sphere Blueprint actor.
- A guess-the-measurement game loop.
- Simulated gate calls through the Quantum API plugin.
- Early hardware job wiring experiments.
- Starter visual labels for the standard Bloch basis states: `|0>`, `|1>`, `|+>`, `|->`, `|i>`, and `|-i>`.

## Setup

1. Open `GuessTheQubit.uproject` in Unreal Engine 5.8.
2. Enable or verify the `QuantumAPI` project plugin.
3. In Project Settings, configure your Quantum API key before running API-backed gameplay.

> [!WARNING]
> The committed config intentionally leaves `ApiKey=` blank. Do not commit personal API keys or IBM credentials.

## Repository Layout

- `Config/` - Unreal project configuration (`DefaultEngine.ini`, `DefaultInput.ini`, `DefaultGame.ini`).
- `Content/` - Game Blueprints, UI, materials, and maps (`Main_Level.umap`).
- `Plugins/QuantumAPI/` - Project-local copy of the Quantum API Unreal plugin (`Source/`, `Config/`, `contract/`). The directory is `QuantumAPI`; the plugin and descriptor are named `QuantumApi` (`QuantumApi.uplugin`). Capitalization matters on Linux and in CI.
- `scripts/` - Orchestration and verification scripts: `structural-check.cjs` (static project checks), `host-check.cjs` (engine detection for this OS), `release-matrix.cjs` (release policy), `run-automation.cjs` (native automation runner).
- `tests/` - Node tests for those scripts, including fixtures of real UE 5.8 automation output (`tests/fixtures/`).

Generated Unreal folders such as `Binaries/`, `DerivedDataCache/`, `Intermediate/`, `Saved/`, and `Builds/` are intentionally git-ignored.

## Project Configuration Notes

- **Editor-only developer plugins**: `AllToolsets`, `AIModuleToolset`, `MCPClientToolset`, and `ModelContextProtocol` are enabled with `"TargetAllowList": ["Editor"]` in `GuessTheQubit.uproject`, matching `ModelingToolsEditorMode`, so they stay out of game targets. Packaged builds do not include them.
- **GameFeatureData Asset Manager rule**: `Config/DefaultGame.ini` registers the `GameFeatureData` primary asset type under `[/Script/Engine.AssetManagerSettings]` with `bIsEditorOnly=True`. The editor-only plugin chain `AllToolsets` -> `GameFeaturesToolset` -> `GameFeatures` loads in the editor and the cook commandlet, and without this rule UE 5.8 logs `LogGameFeatures: Error` / `LoadErrors: Error`, which fails `RunUAT BuildCookRun` with `Error_UnknownCookFailure` (exit code 25). `bIsEditorOnly=True` keeps the entry out of the packaged game, where the GameFeatures module is not loaded. This project has no game feature plugins.
- **ApiKey**: `Config/DefaultGame.ini` must keep `ApiKey=` empty. `scripts/structural-check.cjs` fails if a key is committed.

## Building and Testing

From the monorepo root: `pnpm run unreal:check` (static, any OS), `pnpm run unreal:test` (script tests, any OS), `pnpm run unreal:check:host` (detects UE 5.8, never compiles), and `pnpm run unreal:test:automation` (runs the `QuantumApi.Runtime.Transport` automation test in the editor). Native compile and package commands, and what has and has not been validated per OS, are in the root `README.md`.

## Educational Direction

Planned learning beats:

- Qubit vs classical bit.
- The `|0>` and `|1>` basis states.
- Superposition and the equator states.
- Measurement randomness.
- Rotation gates and intuition for `RY(pi/2)`.
- Difference between simulation and queued hardware jobs.

## Supported Release Targets & Packaging Policy

- **Release Policy Targets**: **Windows (`Win64`)**, **macOS (`Mac`)**, and **Linux (`Linux`)**.
- This matrix represents supported release policy rather than a packaging ban.
- Native builds require appropriate platform toolchains and an installed Unreal Engine 5.8.

## License

License is pending. Do not assume reuse rights until a license file is added.
