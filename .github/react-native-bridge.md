# React Native Android Bridge Pattern

Example:

class DeviceModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "DeviceModule"
  }

  @ReactMethod
  fun getDeviceName(promise: Promise) {
    try {
      val deviceName = android.os.Build.MODEL
      promise.resolve(deviceName)
    } catch (e: Exception) {
      promise.reject("ERROR", e)
    }
  }
}