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
- `Plugins/QuantumAPI/` - Project-local copy of the Quantum API Unreal plugin (`Source/`, `Config/`, `contract/`).
- `scripts/` - Orchestration and verification scripts (`host-check.cjs`, `release-matrix.cjs`, `run-automation.cjs`, `build-unreal.cjs`).

Generated Unreal folders such as `Binaries/`, `DerivedDataCache/`, `Intermediate/`, `Saved/`, and `Builds/` are intentionally git-ignored.

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
