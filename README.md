# RoverLab

A browser-based planetary rover sandbox for experimenting with autonomous decisions using TypeSafe AI.

Give a rover a mission, change its environment, and inspect how its choices affect exploration, energy use, and discoveries.

## Project status

Project initialized. Application code and dependencies have not been added yet.

## First complete demo

One rover, a small planetary terrain, a charging base, three discoverable samples, and a changing environmental hazard. The rover explores, inspects, collects, delivers, and recharges. Changing a mission should produce observable differences in its decisions.

## Planned stack

- React, TypeScript, and Vite for the browser application.
- Three.js through React Three Fiber for the world and rover.
- An independent TypeScript simulation with fixed time steps and grid navigation.
- A small Node.js backend using the official TypeSafe JavaScript SDK.

## Design principles

- Code owns movement, pathfinding, resource accounting, action validity, and execution.
- TypeSafe selects bounded actions using observations, memory, mission instructions, and available options.
- The rover sees only what its sensors have discovered; observations carry timestamps.
- Rendering is separate from simulation and decision making.
- Record actual decisions and actions for faithful replay.
- Keep API credentials on the server.

See [the build plan](docs/build-plan.md) for milestones and validation.

## TypeSafe access

Live AI decisions will require a TypeSafe API key. The first simulation milestone uses a rule-based controller and can be developed without that key. The environment example is a placeholder for the planned backend; configuration loading will be implemented with it.

## References

- [TypeSafe concepts](https://docs.typesafe.ai/concepts/system-one)
- [TypeSafe JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)
- [TypeSafe Choice primitive](https://docs.typesafe.ai/primitives/choice)
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
