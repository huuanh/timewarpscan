package com.timewarpscan

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.PorterDuff
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.util.Log
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.util.Base64
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

/**
 * Grabs the current camera preview frame directly from the TextureView or
 * SurfaceView, bypassing VisionCamera's takeSnapshot() pipeline.
 *
 * Performance comparison:
 *   takeSnapshot(): camera HAL → rotation → JPEG → unique file → ~120ms
 *   grabFrame():    getBitmap/PixelCopy → downscale → JPEG → fixed file → ~15-25ms
 */
class FrameGrabberModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "FrameGrabber"

    private val mainHandler = Handler(Looper.getMainLooper())
    private val workerThread = HandlerThread("FrameGrabWorker").also { it.start() }
    private val workerHandler = Handler(workerThread.looper)

    // Single reusable file — OS page cache keeps it hot
    private val outputFile by lazy {
        File(reactApplicationContext.cacheDir, "fg_frame.jpg")
    }

    // Pre-allocated bitmaps — avoids ~8MB allocation per frame at 30fps
    private var captureBitmap: Bitmap? = null
    private var scaledBitmap: Bitmap? = null
    private var scaleCanvas: Canvas? = null

    // Reusable buffer for base64 encoding — avoids allocation per frame
    private val reusableBaos = ByteArrayOutputStream(131_072)

    // Cached TextureView — avoids full view hierarchy traversal per frame
    private var cachedTextureView: TextureView? = null

    private fun <T : View> findView(root: View, clazz: Class<T>): T? {
        if (clazz.isInstance(root)) return clazz.cast(root)
        if (root is ViewGroup) {
            for (i in 0 until root.childCount) {
                findView(root.getChildAt(i), clazz)?.let { return it }
            }
        }
        return null
    }

    private fun ensureCaptureBitmap(w: Int, h: Int): Bitmap {
        val existing = captureBitmap
        if (existing != null && existing.width == w && existing.height == h && !existing.isRecycled) {
            return existing
        }
        existing?.recycle()
        return Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also { captureBitmap = it }
    }

    private fun downscaleIfNeeded(src: Bitmap, maxWidth: Int): Bitmap {
        if (maxWidth <= 0 || src.width <= maxWidth) return src

        val scale = maxWidth.toFloat() / src.width
        val dstW = maxWidth
        val dstH = (src.height * scale).toInt()

        var dst = scaledBitmap
        if (dst == null || dst.width != dstW || dst.height != dstH || dst.isRecycled) {
            dst?.recycle()
            dst = Bitmap.createBitmap(dstW, dstH, Bitmap.Config.ARGB_8888)
            scaledBitmap = dst
            scaleCanvas = Canvas(dst)
        }

        val canvas = scaleCanvas!!
        canvas.drawColor(0, PorterDuff.Mode.CLEAR)
        canvas.drawBitmap(src, Matrix().apply { setScale(scale, scale) }, null)
        return dst
    }

    private fun compressAndResolve(bitmap: Bitmap, quality: Int, maxWidth: Int, promise: Promise) {
        workerHandler.post {
            try {
                val bmp = downscaleIfNeeded(bitmap, maxWidth)
                BufferedOutputStream(FileOutputStream(outputFile)).use { out ->
                    bmp.compress(Bitmap.CompressFormat.JPEG, quality, out)
                }
                promise.resolve(outputFile.absolutePath)
            } catch (e: Exception) {
                promise.reject("E_PROCESS", e.message)
            }
        }
    }

    private fun compressAndResolveBase64(bitmap: Bitmap, quality: Int, maxWidth: Int, promise: Promise) {
        workerHandler.post {
            try {
                val bmp = downscaleIfNeeded(bitmap, maxWidth)
                val baos = ByteArrayOutputStream(32_768)
                bmp.compress(Bitmap.CompressFormat.JPEG, quality, baos)
                val b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
                promise.resolve(b64)
            } catch (e: Exception) {
                promise.reject("E_PROCESS", e.message)
            }
        }
    }

    /**
     * Inline compression on the calling thread using reusable buffer.
     * Saves ~3-5ms per frame by avoiding worker thread hop.
     */
    private fun compressBase64Inline(bitmap: Bitmap, quality: Int, maxWidth: Int): String {
        val bmp = downscaleIfNeeded(bitmap, maxWidth)
        reusableBaos.reset()
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, reusableBaos)
        return Base64.encodeToString(reusableBaos.toByteArray(), Base64.NO_WRAP)
    }

    private fun getTextureView(): TextureView? {
        cachedTextureView?.let { tv ->
            if (tv.isAvailable && tv.isAttachedToWindow) return tv
        }
        val activity = reactApplicationContext.currentActivity ?: return null
        val root = activity.window.decorView.rootView
        val tv = findView(root, TextureView::class.java)
        cachedTextureView = tv
        return tv
    }

    /**
     * Grabs the current camera preview frame.
     *
     * @param quality JPEG quality (1-100)
     * @param maxWidth Downscale to this width if larger (0 = no downscale)
     * @param promise Resolves with the file path of the JPEG
     */
    @ReactMethod
    fun grabFrame(quality: Int, maxWidth: Int, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No current activity")
            return
        }

        mainHandler.post {
            try {
                val root = activity.window.decorView.rootView

                // TextureView: getBitmap() includes the transform matrix (center-crop)
                val tv = findView(root, TextureView::class.java)
                if (tv != null && tv.isAvailable) {
                    Log.d("FrameGrabber", "TextureView found ${tv.width}x${tv.height}")
                    val bmp = ensureCaptureBitmap(tv.width, tv.height)
                    if (tv.getBitmap(bmp) != null) {
                        Log.d("FrameGrabber", "getBitmap result: ${bmp.width}x${bmp.height}")
                        compressAndResolve(bmp, quality, maxWidth, promise)
                        return@post
                    }
                } else {
                    Log.d("FrameGrabber", "No TextureView found, trying SurfaceView")
                }

                // SurfaceView: async PixelCopy (fallback for VisionCamera default)
                val sv = findView(root, SurfaceView::class.java)
                if (sv != null && sv.holder.surface.isValid && sv.width > 0 && sv.height > 0) {
                    val bmp = ensureCaptureBitmap(sv.width, sv.height)
                    PixelCopy.request(sv, bmp, { result ->
                        if (result == PixelCopy.SUCCESS) {
                            compressAndResolve(bmp, quality, maxWidth, promise)
                        } else {
                            promise.reject("E_PIXEL_COPY", "PixelCopy failed: $result")
                        }
                    }, workerHandler)
                    return@post
                }

                promise.reject("E_NO_VIEW", "No TextureView or SurfaceView found")
            } catch (e: Exception) {
                promise.reject("E_GRAB", e.message)
            }
        }
    }

    /**
     * Grabs the current frame and returns it as a base64-encoded JPEG string.
     * Faster than grabFrame() because it skips file write + file read.
     */
    @ReactMethod
    fun grabFrameBase64(quality: Int, maxWidth: Int, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No current activity")
            return
        }

        mainHandler.post {
            try {
                val tv = getTextureView()
                if (tv != null && tv.isAvailable) {
                    val bmp = ensureCaptureBitmap(tv.width, tv.height)
                    if (tv.getBitmap(bmp) != null) {
                        // Inline compression: saves one thread hop (~3-5ms)
                        promise.resolve(compressBase64Inline(bmp, quality, maxWidth))
                        return@post
                    }
                }

                val root = activity.window.decorView.rootView
                val sv = findView(root, SurfaceView::class.java)
                if (sv != null && sv.holder.surface.isValid && sv.width > 0 && sv.height > 0) {
                    val bmp = ensureCaptureBitmap(sv.width, sv.height)
                    PixelCopy.request(sv, bmp, { result ->
                        if (result == PixelCopy.SUCCESS) {
                            compressAndResolveBase64(bmp, quality, maxWidth, promise)
                        } else {
                            promise.reject("E_PIXEL_COPY", "PixelCopy failed: $result")
                        }
                    }, workerHandler)
                    return@post
                }

                promise.reject("E_NO_VIEW", "No TextureView or SurfaceView found")
            } catch (e: Exception) {
                promise.reject("E_GRAB", e.message)
            }
        }
    }
}
