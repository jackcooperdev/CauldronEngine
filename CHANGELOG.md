# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

## [0.14.0] - 2026-10-24

### Added

- Offline booting. Installed versions can be launched without an internet connection, including `release` and
  `snapshot` aliases
- `getCEObject` and `installGame` accept `release`, `latest` and `snapshot` as the Minecraft version for loaders as
  well as vanilla, and `release` as the loader version
- `whatIsThis` support for loaders. It now takes `(version, vanillaManifest, loaderManifest, lv)` and returns
  `{ v, lv }` when a loader manifest is passed
- Version and loader manifests are saved in the Cauldron folder (`version_manifest.json`,
  `<loader>_version_manifest.json`) for offline use
- New CE object verifier (`tools/ceManager.js`). `version.ce` files are encrypted (AES-256-GCM), compressed and checked
  against a schema when read. Invalid files are rebuilt automatically
- `ce.key` in the Cauldron folder, generated on first run and used to sign `version.ce` files
- `javaQueue` on the CE object, holding the JVM files separately from `installQueue`
- `grabCE` export in `manifest`
- Corrupted installation error when a file is missing and the client is offline
- Install and CE retrieval times in debug logs

### Changed

- **Breaking:** `whatIsThis` has a new signature (see Added)
- Post processing now runs during `installGame` instead of when the game boots
- The JVM is only verified and downloaded when its folder is missing, which speeds up installs
- `download` rejects when offline instead of resolving `true`

### Fixed

- Post processing reporting the wrong job number

### Removed

- Queue logging errors itself (errors are still rejected to the caller)
- Old compression-based (ZIP) `version.ce` format. Existing files are rebuilt automatically


## [0.13.1] - 2026-10-19

> Updated README and Small Dependencies

## [0.13.0] - 2026-10-19

> Version 0.12.0 was used during development but never released. Its changes are included here.

### Added

- `client` controller with `startGame` and `installGame`, replacing the `launcher` controller
- Install data for each version is now built into a single object and cached in `versions/<id>/version.ce`
- Platform patches (`files/patches.json`). Beta 1.7 to 1.2.5 now use the Ornithe loader on Apple Silicon Macs
- Natives are extracted into a temporary `.temp` folder that is removed when the game closes
- `fileTools` exports `createUUID`

### Changed

- **Breaking:** `launcher` export replaced by `client`
- **Breaking:** `manifest` now exports `getCEObject` and `whatIsThis`. `getManifests`, `checkManifest` and
  `getPackwizJVM` have been removed
- **Breaking:** Authentication data passed to the engine is now an account object (`{ token, accountData }`), a
  Minecraft access token string, or `{ demo: true }`
- Forge and NeoForge post processing merged into a single post processor (`tools/postProcessor.js`)
- JVM, asset and library downloads now run through the download queue as one install queue
- Launch script is written to `.temp/launch.sh` / `.temp/launch.bat`

### Removed

- `assets`, `jvm` and `libraries` controllers (handled by `installGame`)
- Separate Forge and NeoForge post processors

## [0.11.3] - 2026-10-12

### Fixed

- Legacy versions on Apple Silicon Macs can be forced to use the Intel JVM through Rosetta

### Removed

- `ora-classic` dependency (progress spinners)

## [0.11.2] - 2026-10-08

### Changed

- Removed leftover console logging
- Demo mode uses a fixed placeholder UUID

## [0.11.1] - 2026-10-05

### Changed

- Improved overrides system. Default JVM settings are now `ram: 8` and `ram_low: 4`, and `ram_low` can be overridden
- `launcher_version` passed to the game is now the engine's package version

## [0.11.0] - 2026-10-05

### Added

- Aikar's flags for dedicated servers

### Changed

- Replaced the unzip package with `jszip`

## [0.10.5] - 2026-08-03

### Fixed

- All servers being labelled as `serverlibs` when tracking installed libraries

## [0.10.4] - 2026-07-24

### Added

- Server software and resource server can be chosen when starting a server

## [0.10.3] - 2026-07-21

### Fixed

- Server launch scripts on Linux

## [0.10.2] - 2026-07-21

### Fixed

- Resource server restored to `https://resources.cauldronmc.com` (0.10.0 and 0.10.1 used a local development server)

## [0.10.1] - 2026-07-21

### Fixed

- Dependency issues

## [0.10.0] - 2026-07-21

### Added

- Dedicated server support (vanilla, Forge and NeoForge), including server launch scripts
- Server post processing for Forge and NeoForge

### Fixed

- Client post processing for Forge

### Known Issues

- The resource server is set to a local development server. Fixed in 0.10.2

## [0.9.4] - 2026-06-29

### Fixed

- Import error in the NeoForge post processor

## [0.9.3] - 2026-06-29

### Fixed

- npm publishing workflow

## [0.9.2] - 2026-06-29

> Tagged on the same commit as 0.9.1.

## [0.9.1] - 2026-06-29

### Fixed

- NeoForge bug on Windows

## [0.9.0] - 2026-06-27

### Added

- NeoForge support

## [0.8.0] - 2026-06-26

### Fixed

- Client file not being added to libraries on some Forge versions after post processing

### Changed

- Maximum file download retries increased from 10 to 50
- Updated dependencies

## [0.7.1] - 2026-06-01

### Fixed

- Forge post processing issues

## [0.7.0] - 2026-05-26

### Added

- `RESOURCE_SERVER` environment variable to change the resource server

### Changed

- ZIP files in the download queue are only extracted when marked `forceUnzip`
- Download queue now rejects with `File Not Found` when a file cannot be downloaded

## [0.6.6] - 2026-05-18

### Added

- Support for the new resource server format. Version specs are fetched directly instead of through loader manifests
- ZIP file handling in the download queue

### Changed

- Updated dependencies

### Fixed

- Forge support
- `client.jar` being excluded from libraries

## [0.6.5] - 2026-03-31

### Changed

- npm publishing workflow

## [0.6.4] - 2026-03-31

### Changed

- Consola fancy output feature
- npm publishing workflow

## [0.6.3] - 2025-07-12

### Added

- Mac compatibility (beta)

### Fixed

- Bug concerning 1.12 versions and LWJGL

## [0.6.2] - 2025-06-12

### Changed

- Updated documentation

## [0.6.1] - 2025-06-11

### Fixed

- Issue with the README file

## [0.6.0] - 2025-06-11

### Added

- Universal loader support (post files not included)

### Changed

- Main logger moved from Log4JS to Consola
- General code review
- Rework of the plugin / loader support system
- Moved post processors for loaders into separate folders
- Moved back from ES modules to CommonJS

### Removed

- Session management
- Individual loader support
- Library patching on launch
- Static file server
- Custom logger finder

## [0.5.9] - 2025-06-09

### Fixed

- Package version

## [0.5.8] - 2025-06-09

> Versions 0.5.6 and 0.5.7 were not released.

### Added

- Universal loader support (in progress)

### Changed

- Major restructure for loader support

### Fixed

- Logger issues
- JVM manifest bug

## [0.5.5] - 2025-04-22

### Changed

- Migrated from CommonJS to ES modules
- Log4JS configuration

## [0.5.4] - 2025-01-20

### Changed

- Code tidy up
- JVM output no longer shown

### Fixed

- Incorrect version
- GitHub Actions

## [0.5.3] - 2024-12-24

### Added

- Offline management
- Progress reporting
- Access control for the static file server

### Changed

- Download queue concurrency, and sessions are ended when an error occurs
- `getJVMManifest` renamed to `getPackwizJVM`
- Updated `axios` to 1.7.4
- Removed console logging and deprecated code

### Fixed

- Long-standing issues with Forge compatibility
- Bugs caused by optimisations

## [0.5.2] - 2024-10-10

### Changed

- Version bump

## [0.5.1] - 2024-10-10

### Added

- Linux compatibility (Java is made executable after download)

### Changed

- Logging configs moved to `files.cauldronmc.com`

### Fixed

- Install-only launches not resolving

## [0.5.0] - 2024-09-02

### Added

- Plugin system, with Forge moved into a plugin
- Forge post processing
- npm publishing workflow
- Documentation

### Changed

- Removed debug console logging

### Fixed

- General bug fixes

## [0.4.2] - 2024-07-31

> The `0.4.2` tag points at code still versioned 0.4.1. The release is tagged `0.4.2a`.

### Added

- Offline launching
- Manifest controller
- Mac and OS compatibility improvements

### Changed

- Rebuilt the launch process, download queue and session handling
- Faster JVM checks
- Logging changes

## [0.4.1] - 2024-07-14

### Changed

- Logging configs and the legacy Java fixer are downloaded from `files.jackcooper.me`

## [0.4.0] - 2024-06-25

### Removed

- Config template

## [0.3.8] - 2024-06-25

### Removed

- Microsoft authentication (moved out of the engine)

## [0.3.7] - 2024-06-21

### Changed

- Path relocation

## [0.3.6] - 2024-06-21

### Added

- `setConfig` to pass config data instead of reading `config.json`

## [0.3.5] - 2024-06-21

### Changed

- Downloader and version checker improvements
- Forge plugin updates

## [0.3.4] - 2024-06-18

### Fixed

- Config loading

## [0.3.3] - 2024-06-18

### Fixed

- Loader version lookups no longer throw when a version is not found

## [0.3.2] - 2024-06-18

### Added

- Config template

## [0.3.1] - 2024-06-16

### Added

- Initial release

[unreleased]: https://github.com/jackcooperdev/CauldronEngine/compare/0.14.0...HEAD
[0.14.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.13.1...0.14.0
[0.13.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.13.0...0.13.1
[0.13.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.11.3...0.13.0
[0.11.3]: https://github.com/jackcooperdev/CauldronEngine/compare/0.11.2...0.11.3
[0.11.2]: https://github.com/jackcooperdev/CauldronEngine/compare/0.11.1...0.11.2
[0.11.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.11.0...0.11.1
[0.11.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.10.5...0.11.0
[0.10.5]: https://github.com/jackcooperdev/CauldronEngine/compare/0.10.4...0.10.5
[0.10.4]: https://github.com/jackcooperdev/CauldronEngine/compare/0.10.3...0.10.4
[0.10.3]: https://github.com/jackcooperdev/CauldronEngine/compare/0.10.2...0.10.3
[0.10.2]: https://github.com/jackcooperdev/CauldronEngine/compare/0.10.1...0.10.2
[0.10.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.10.0...0.10.1
[0.10.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.9.4...0.10.0
[0.9.4]: https://github.com/jackcooperdev/CauldronEngine/compare/0.9.3...0.9.4
[0.9.3]: https://github.com/jackcooperdev/CauldronEngine/compare/0.9.2...0.9.3
[0.9.2]: https://github.com/jackcooperdev/CauldronEngine/compare/0.9.1...0.9.2
[0.9.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.9.0...0.9.1
[0.9.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.8.0...0.9.0
[0.8.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.7.1...0.8.0
[0.7.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.7.0...0.7.1
[0.7.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.6.6...0.7.0
[0.6.6]: https://github.com/jackcooperdev/CauldronEngine/compare/0.6.5...0.6.6
[0.6.5]: https://github.com/jackcooperdev/CauldronEngine/compare/0.6.4...0.6.5
[0.6.4]: https://github.com/jackcooperdev/CauldronEngine/compare/0.6.3...0.6.4
[0.6.3]: https://github.com/jackcooperdev/CauldronEngine/compare/0.6.2...0.6.3
[0.6.2]: https://github.com/jackcooperdev/CauldronEngine/compare/0.6.1...0.6.2
[0.6.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.6.0...0.6.1
[0.6.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.9...0.6.0
[0.5.9]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.8...0.5.9
[0.5.8]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.5...0.5.8
[0.5.5]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.4...0.5.5
[0.5.4]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.3...0.5.4
[0.5.3]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.2...0.5.3
[0.5.2]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.1...0.5.2
[0.5.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.0...0.5.1
[0.5.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.4.2a...0.5.0
[0.4.2]: https://github.com/jackcooperdev/CauldronEngine/compare/0.4.1...0.4.2a
[0.4.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.4.0...0.4.1
[0.4.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.3.8...0.4.0
[0.3.8]: https://github.com/jackcooperdev/CauldronEngine/compare/0.3.7...0.3.8
[0.3.7]: https://github.com/jackcooperdev/CauldronEngine/compare/0.3.6...0.3.7
[0.3.6]: https://github.com/jackcooperdev/CauldronEngine/compare/0.3.5...0.3.6
[0.3.5]: https://github.com/jackcooperdev/CauldronEngine/compare/0.3.4...0.3.5
[0.3.4]: https://github.com/jackcooperdev/CauldronEngine/compare/0.3.3...0.3.4
[0.3.3]: https://github.com/jackcooperdev/CauldronEngine/compare/0.3.2...0.3.3
[0.3.2]: https://github.com/jackcooperdev/CauldronEngine/compare/0.3.1...0.3.2
[0.3.1]: https://github.com/jackcooperdev/CauldronEngine/releases/tag/0.3.1
