# Guess the Qubit

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

The committed config intentionally leaves `ApiKey=` blank. Do not commit personal API keys or IBM credentials.

## Repository Layout

- `Config/` - Unreal project configuration.
- `Content/` - Game Blueprints, UI, materials, and assets.
- `Plugins/QuantumAPI/` - Project-local copy of the Quantum API Unreal plugin.

Generated Unreal folders such as `Binaries/`, `DerivedDataCache/`, `Intermediate/`, and `Saved/` are intentionally ignored.

## Educational Direction

Planned learning beats:

- Qubit vs classical bit.
- The `|0>` and `|1>` basis states.
- Superposition and the equator states.
- Measurement randomness.
- Rotation gates and intuition for `RY(pi/2)`.
- Difference between simulation and queued hardware jobs.

## License

License is pending. Do not assume reuse rights until a license file is added.
