# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] - 11-06-2025
### Fixed
- Issue With ReadMe File


## [0.6.0] - 11-06-2025
### Added
- Universal Loader Support (Post files not included)

### Changed

- Moved Main CauldronLogger to Consola from Log4JS
- General Code Review
- Rework Of Plugin / Loader Support System 
- Moved Post Processors for plugins to separate folders
- Moved Back from ESM to EJS

### Removed

- Removed Session Management
- Individual Loader Support
- Library Patching on Launch
- Static File Server
- Custom Logger Finder

## [0.5.5] - 22-04-2025

### Changed

- Migrated From CommonJS To ESM

## [0.5.4] - 18-01-2025

### Added

- Added Main Controllers required for Minecraft Launching
- Added Tools to help in launches and management of files
- Restricted file server origins
- Started CHANGELOG.md for future changes

[unreleased]: https://github.com/jackcooperdev/CauldronEngine/compare/master...development
[0.6.1]: https://github.com/jackcooperdev/CauldronEngine/compare/0.6.0...0.6.1
[0.6.0]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.4...0.6.0
[0.5.4]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.3...0.5.4

[0.5.5]: https://github.com/jackcooperdev/CauldronEngine/compare/0.5.4...0.5.5
