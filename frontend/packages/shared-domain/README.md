# shared-domain

Pure Pokémon Go Nexus business rules shared by web and native clients.

Code in this package must not import React, React Native, browser globals,
storage implementations, route libraries, or UI components. It may consume
transport/domain types from `shared-contracts`.

Platform hosts remain responsible for rendering, navigation, persistence,
network transport, and user feedback.
