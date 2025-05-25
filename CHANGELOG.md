# Change Log

All notable changes to the "scraps" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.4] - 2025-05-25

### 🔧 Fixed
- **Extension Loading**: Added proper activation events to ensure extension loads when needed

### ✨ Improved
- **Custom Icon**: Replaced complex SVG with optimized Activity Bar icon that adapts to VS Code themes
- **Build System**: Migrated from TypeScript compilation to webpack bundling for better dependency management
- **Performance**: Reduced extension size and improved loading times with optimized bundling

### 🎨 Changed
- Updated Activity Bar icon to custom document + AI spark design
- Improved extension reliability and stability

## [1.0.3] - 2025-5-24

### Fixed
- Fixed command not found errors by standardizing command IDs
- Fixed configuration namespace consistency
- Fixed global state key consistency
- Fixed secret storage key consistency
- Fixed view ID consistency

### Changed
- Standardized all IDs to use `scraps-ai` prefix
- Improved error handling and logging
- Enhanced state management reliability

## [1.0.2] - 2025-5-24

### Added
- Debug mode for notifications
- Better error handling in sync service

### Changed
- Improved notification system with centralized control
- Enhanced sync status reporting

## [1.0.1] - 2024-03-18

### Added
- Initial release
