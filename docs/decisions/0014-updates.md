# 0014 — Updates: whole signed images in two slots, with RAUC

- **Status:** Accepted
- **Date:** 2026-10-24
- **Revised:**
  - 2026-10-27, for Ubuntu ([ADR-0017](0017-ros-2.md)): the image, its builder and the data partition's contents;
  - 2026-10-28: where updates come from, as Home Assistant OS does it (decision 7).
- **Amended by:** [ai-platform ADR-0001](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0001-repositories.md): the channel file's format is defined in ai-platform, with a version of its own ([ai-platform ADR-0003](https://github.com/trungnguyen278/ai-platform/blob/main/docs/decisions/0003-compatibility.md))

## Context

- This is decision 6 of the [requirements](https://github.com/trungnguyen278/ai-platform/blob/main/protocols/cloud/requirements.md): how the robot's software is updated.
- What the requirements ask:
  - updates signed, verified on the robot before they are installed, and fetched over TLS. Installation must be able to roll back, and must not accept an older version unless the owner says so (SEC-11);
  - the cloud announces updates (IO-13), and the robot installs them only in safe states (SEC-8, system class);
  - the server sees each robot's update state (OPS-1).
- A robot in a home loses power, mid-update included. An update that leaves it half-installed can leave it unable to start, far from anyone who can repair it.
- What the Raspberry Pi offers:
  - its bootloader can boot another partition **once**, on trial ("tryboot"), and comes back to the previous one at the next normal boot. With `tryboot_a_b`, the switch is made between whole partitions;
  - `rpi-image-gen` builds custom Raspberry Pi OS images from the distribution's packages, and `rpi-sb-provisioner` sets up signed boot.
- What Ubuntu offers, now that [ADR-0017](0017-ros-2.md) proposes it in place of Raspberry Pi OS:
  - Canonical's `ubuntu-image` builds classic Ubuntu images for the Raspberry Pi from an image definition: the series, the kernel (`linux-image-raspi`), the packages;
  - Ubuntu's own A/B fallback on the Pi, from 25.10, covers only the boot assets (kernel, initramfs, device trees), not the root file system.
- How others do it:

| System | How it updates |
|---|---|
| Home Assistant OS | RAUC: images signed with X.509, installed into the slot not running, A/B. CI builds the bundles, which are published on GitHub Releases and signed with the project's release CA. Its Supervisor fetches them and hands them to RAUC. |
| Mender | A/B root file systems. The new system must commit itself at its first boot, or the next boot rolls back. `mender-convert` turns a Raspberry Pi OS image into one. |
| Ubuntu on the Raspberry Pi | From 25.10, an A/B fallback built on the bootloader's tryboot. |
| Raspberry Pi OS, as shipped | apt packages, upgraded in place. |
| balenaOS | Containers on a host system updated in two slots. |

- RAUC on the Pi 5:
  - RAUC has no official backend for the Raspberry Pi firmware yet. The established pattern is a custom backend that reads and writes `autoboot.txt` and arms tryboot through the firmware's mailbox (Bootlin); a Compute Module 5 project runs it on hardware.
  - RAUC can stream bundles over HTTPS, and its adaptive updates download only the 4 KiB blocks that changed.
    - Streaming needs bundles in RAUC's verity format, and a server that answers HTTP range requests.
    - Ubuntu 26.04's kernel has what streaming needs: NBD and dm-verity.
  - Software drives RAUC through its D-Bus interface: it installs a bundle and reports progress and completion.
- What GitHub offers:
  - each file of a release must be under 2 GiB, with no limit on a release's total size or on downloads;
  - release downloads answer HTTP range requests, after a redirect (checked 2026-10-28);
  - a protected environment gives its secrets only to the jobs a required reviewer has approved;
  - the REST API allows 60 requests an hour to clients without a token, per IP address.

## Decision

1. **An update replaces the whole system:** one image, with Ubuntu 26.04 LTS, ROS 2 and the robot's software ([ADR-0017](0017-ros-2.md)), built in CI with `ubuntu-image` from the project's image definition. The robot never upgrades package by package.
   - The snaps in the image (Ubuntu Frame, Chromium) are held from refreshing, so they too change only with the image.
   - The image sets NetworkManager as netplan's renderer, and starts PipeWire before the robot's nodes.
2. **Two system slots, A and B.**
   - The update is written into the slot that is not running, then booted once on trial, through the bootloader's tryboot.
   - The new system commits itself only once it has proved healthy: it started, and its modules run. Otherwise, the next boot returns to the previous slot.
3. **RAUC installs the updates**:
   - bundles signed with the project's key, and verified before anything is written;
   - streamed over HTTPS, with adaptive updates to download only what changed;
   - switching slots through the Raspberry Pi firmware's tryboot, with RAUC's interface for custom bootloaders, as Bootlin and a Compute Module 5 project do. Ubuntu's own fallback for boot assets is turned off: RAUC switches whole slots, boot assets included.
4. **A data partition outlives the slots.** It holds the owner's settings and the robot's local configuration, its logs, its PipeWire setup, and the IMX500's firmware, fetched from Raspberry Pi's archive during set-up ([ADR-0017](0017-ros-2.md)); the kernel searches it for firmware. The robot's identity lives in the TPM, not on disk (ADR-0010).
5. **A factory reset** wipes the data partition and clears the TPM.
6. **The software installs an update only when told**: the cloud announces it (IO-13), or the owner asks, either at the time or by allowing automatic updates (decision 7). It installs only in a safe state (SEC-8), never moving, and reports its progress (IO-8, OPS-1).
7. **Releases are built, signed and published on GitHub, as Home Assistant OS's are.**
   - **Built:** for each release tag, a GitHub Actions workflow builds the image and its RAUC bundle, in the verity format.
   - **Signed:** a release job of its own signs the bundle with the project's key. The key is a secret of a protected environment, so only a release a maintainer approves can use it, and the build jobs never see it. The image carries the matching certificate.
   - **Published:** the bundle is an asset of the GitHub release. CI fails a bundle over its size budget, which stays below GitHub's 2 GiB per file.
   - **Announced:** each channel (`stable`, `beta`) has a channel file, published on GitHub Pages. It names the newest version, its bundle's address, its size and its SHA-256. Its format is defined once, in `protocol/`.
   - **On the robot**, an `updates` node:
     - reads its channel's file once a day, and whenever the owner asks in the settings. The file's address, the channel and the period are settings, so ai-robot-server can serve the channel later with no change to the robot's code;
     - shows an update that is available in the settings;
     - trusts the bundle, not the channel file: RAUC checks its signature, and the node refuses a version older than the one running unless the owner chooses it (SEC-11);
     - follows GitHub's redirect to the bundle's current address, hands that address to RAUC over D-Bus, and reports the progress on the screen and to the cloud;
     - installs when the owner says so in the settings, or by itself when the robot is idle on its charger, if the owner allows automatic updates. That setting is on as shipped, so that a robot left alone stays patched.
   - **The server, once it exists**, announces through the same channel (IO-13). It can hold a release back, or roll it out to a few robots first. The robot still checks the signature and the version of what it is told to install.

## Alternatives considered

| Alternative | Why not |
|---|---|
| apt packages, upgraded in place (as Raspberry Pi OS and Ubuntu ship) | Not atomic: a power cut mid-upgrade can leave a mix of versions, and there is no way back to the previous system (SEC-11). |
| The robot's software in a container, the system upgraded with apt | Rolls the software back, but not the system under it, which keeps apt's weaknesses. It also adds a container runtime to the robot. |
| Mender | Proven A/B updates, but tied to its own server, hosted or run by us, while updates are announced by ai-robot-server (IO-13). Its conversion of Raspberry Pi OS images trails the newest releases. |
| SWUpdate | Comparable to RAUC. RAUC has Home Assistant OS as a large precedent, and its streaming and adaptive updates. |
| Ubuntu Core | Transactional updates built in, but they arrive as snaps from a snap store, while the robot's updates are announced by ai-robot-server (IO-13). Each node would also be a confined snap, given an interface for every device it uses. |
| balenaOS | Containers on a host system updated in two slots; each node would run in a container, passed its devices. |
| Raspberry Pi OS, built with `rpi-image-gen` | What this decision first proposed. [ADR-0017](0017-ros-2.md) moves the robot to Ubuntu, where ROS 2 is supported at Tier 1. |
| The robot pulls its code with git and restarts | Nothing checks a signature, so whoever takes the repository runs code on every robot. A power cut mid-update leaves a mix. The system under the code cannot roll back, and the robot needs build tools. |
| The GitHub API's latest release as the robot's channel | Tied to GitHub's API, and limited to 60 requests an hour per address without a token. A static channel file can later be served by ai-robot-server by changing an address. |
| Bundles on ai-robot-server from the start | The server does not exist yet. GitHub hosts releases with no limit on downloads, and the channel's address lets the server take over without a change to the robot. |

## Consequences

- Positive:
  - a robot always boots a whole, tested system, and a failed update undoes itself;
  - every robot runs exactly what CI built and tested;
  - signed images, and signed boot later with the Raspberry Pi's secure boot;
  - the same image is what is flashed at the factory;
  - a release is made where the code is: a tag, CI's build, an approval, then the channel moves;
  - robots update without ai-robot-server, which adds staged rollouts when it exists.
- Negative / accepted trade-offs:
  - two system slots take twice the space of one system on the storage;
  - building images in CI, and keeping the signing key, become part of the project;
  - the backend for the Raspberry Pi firmware is a script of ours, unless the one proposed to RAUC is merged;
  - a change of one line ships as an image, made cheap by adaptive updates;
  - GitHub's 2 GiB per file bounds the image, so its size has a budget;
  - the signing key lives in a GitHub environment, behind a maintainer's approval.
- Follow-up:
  - the image's layout: boot and system partitions for A and B, and the data partition;
  - the image's build in CI, and the signing key's rotation;
  - the channel file's format, in `protocol/`;
  - the update messages of the cloud protocol (IO-13), and the update state in health reports;
  - signed boot, with the TPM's other secrets.

## References

Retrieved 2026-10-24:

- [config.txt: `autoboot.txt`, `tryboot_a_b` and the `[tryboot]` filter](https://www.raspberrypi.com/documentation/computers/config_txt.html) — Raspberry Pi documentation.
- [Introducing rpi-image-gen](https://www.raspberrypi.com/news/introducing-rpi-image-gen-build-highly-customised-raspberry-pi-software-images/) — Raspberry Pi, 2025.
- [Home Assistant OS update system](https://developers.home-assistant.io/docs/operating-system/update-system).
- [Safe updates using RAUC on Raspberry Pi 5](https://bootlin.com/?p=19769) — Bootlin; [RAUC A/B OTA for the CM5 via firmware tryboot](https://codeberg.org/buildacubesat-project/bac-software/pulls/84).
- RAUC: [changes](https://rauc.readthedocs.io/en/stable/changes.html) (streaming in 1.7, adaptive updates in 1.8) and [RAUC v1.8 released](https://www.pengutronix.de/en/blog/2022-10-06-rauc-v1-8-released.html).
- [Mender 1.7: Raspbian support with mender-convert](https://mender.io/blog/mender-1-7-released-raspbian-and-broader-linux-support); [mender](https://github.com/mendersoftware/mender).
- [A/B boot on Ubuntu for Raspberry Pi](https://ubuntu.com/hardware/docs/boards/explanations/piboot-ab/) (boot assets only; retrieved 2026-10-27).
- [`ubuntu-image` classic examples](https://canonical-subiquity.readthedocs-hosted.com/en/latest/_sources/howto/ubuntu-image-classic-examples.rst.txt), including a Raspberry Pi image (retrieved 2026-10-27).
- Retrieved 2026-10-28:
  - RAUC: [HTTP streaming and adaptive updates](https://rauc.readthedocs.io/en/latest/advanced.html) (range requests, the verity format), and [its D-Bus API](https://rauc.readthedocs.io/en/latest/reference.html#d-bus-api);
  - GitHub: [about large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) (2 GiB per release file), [the REST API's rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) (required reviewers, secrets after approval);
  - [Ubuntu 26.04's kernel configuration](https://git.launchpad.net/~ubuntu-kernel/ubuntu/+source/linux-raspi/+git/resolute/plain/debian.master/config/annotations?h=Ubuntu-raspi-7.0.0-1022.22) (NBD and dm-verity as modules).
