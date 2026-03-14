package com.timewarpscan

import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class FileWriterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FileWriter"

    @ReactMethod
    fun writeBase64ToFile(base64: String, filePath: String, promise: Promise) {
        try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            File(filePath).writeBytes(bytes)
            promise.resolve(filePath)
        } catch (e: Exception) {
            promise.reject("WRITE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getTempDir(promise: Promise) {
        promise.resolve(reactApplicationContext.cacheDir.absolutePath)
    }
}
