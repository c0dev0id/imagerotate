# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Upgraded GitHub Actions to versions that natively target Node.js 24:
  `actions/checkout@v6`, `actions/configure-pages@v6`, `actions/deploy-pages@v5`.
- Replaced `actions/upload-pages-artifact@v4` with a manual tar step and
  `actions/upload-artifact@v7` (Node.js 24 native) to eliminate a transitive
  Node.js 20 dependency that had no upstream fix.
