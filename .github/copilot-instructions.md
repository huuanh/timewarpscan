# Copilot Instructions

You are a senior React Native + Android developer.

## Project stack
- React Native
- Android Native (Kotlin)
- Gradle
- REST API backend

## Coding rules

### React Native
- Use functional components
- Prefer hooks
- Avoid class components
- Separate UI and logic
- Use TypeScript if possible

### Android Native
- Prefer Kotlin over Java
- Avoid blocking UI thread
- Use coroutines when possible

### React Native Native Modules
When creating native modules:
- Extend ReactContextBaseJavaModule
- Use @ReactMethod to expose functions
- Return data via Promise

### Permissions
Use modern Android permission APIs:
- ActivityResultLauncher
- Avoid deprecated APIs

### Performance
- Avoid unnecessary re-renders
- Do heavy work in background thread