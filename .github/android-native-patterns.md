# Android Native Patterns

## Permissions

Use ActivityResultLauncher instead of deprecated APIs.

Example:

private val cameraPermissionLauncher =
  registerForActivityResult(
    ActivityResultContracts.RequestPermission()
  ) { granted ->
    if (granted) {
      openCamera()
    }
  }

## Camera

Prefer CameraX instead of old Camera API.

## Threading

Use coroutine for background tasks.

GlobalScope.launch(Dispatchers.IO) {
}