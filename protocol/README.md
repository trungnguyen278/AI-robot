# protocol/ — what crosses a component boundary

The **single source of truth** for each protocol between the robot's components. Both sides generate their code from these definitions, or test against them; never hand-copy them (the previous generation had to keep two copies of `StateTypes` in sync by hand).

| Protocol | Between | Status |
|---|---|---|
| [Body link](body/README.md) | The Pi 5 and the body controller | Not decided yet |
| [Screen](screen/README.md) | The Pi software (`software/`) and the screen renderer (`ui/`) | Version 1, proposed in [ADR-0006](../docs/decisions/0006-screen-renderer.md) |
| [Cloud link](cloud/README.md) | The robot (`software/`) and `ai-robot-server` | Version 1.0, built on [ADR-0007](../docs/decisions/0007-cloud-link-transport.md) and [ADR-0008](../docs/decisions/0008-cloud-link-messages.md) (proposed); turns and audio not implemented yet |

A protocol change goes here first, then to both sides, in the same pull request ([CONTRIBUTING.md](../CONTRIBUTING.md#documentation-travels-with-the-change)).
