# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-03-20

### Added

- Multi-chat sidebar with create, select, rename, and delete capabilities
- IndexedDB persistence for chat history and settings
- Context window gauge with approximate token tracking
- Thinking mode support for Qwen 2B and 4B models
- Editorial showcase layout with refined typography
- Comprehensive E2E test suite with mock runtime
- Telemetry panel with runtime metrics
- System prompt editor per chat
- Generation presets (Direct / Thinking modes)
- `robots.txt` for SEO

### Changed

- Refactored UI into single-page showcase layout
- Improved state management with reducer pattern
- Enhanced error handling and recovery flows

### Removed

- Legacy numbered prototype routes (`/1`, `/2`, etc.)
- Old section-based component structure

## [0.1.0] - 2026-03-14

### Added

- Initial release
- WebGPU capability probing
- Qwen 3.5 model support (0.8B, 2B, 4B)
- Streaming text generation with interruption
- Basic chat interface
- Model selection with tier indicators
- Generation settings panel
- CI/CD pipeline with GitHub Actions

[Unreleased]: https://github.com/YOUR_USERNAME/llmshowcase/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/YOUR_USERNAME/llmshowcase/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/YOUR_USERNAME/llmshowcase/releases/tag/v0.1.0