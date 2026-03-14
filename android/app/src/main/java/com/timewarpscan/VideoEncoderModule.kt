package com.timewarpscan

import android.graphics.BitmapFactory
import android.graphics.Rect
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Base64
import android.view.Surface
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VideoEncoderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VideoEncoder"

    private var codec: MediaCodec? = null
    private var muxer: MediaMuxer? = null
    private var inputSurface: Surface? = null
    private var trackIndex = -1
    private var muxerStarted = false
    private var outPath: String? = null
    private val bufferInfo = MediaCodec.BufferInfo()

    @ReactMethod
    fun start(width: Int, height: Int, fps: Int, outputPath: String, promise: Promise) {
        try {
            outPath = outputPath
            trackIndex = -1
            muxerStarted = false

            val format = MediaFormat.createVideoFormat(
                MediaFormat.MIMETYPE_VIDEO_AVC, width, height
            ).apply {
                setInteger(MediaFormat.KEY_BIT_RATE, 4_000_000)
                setInteger(MediaFormat.KEY_FRAME_RATE, fps)
                setInteger(
                    MediaFormat.KEY_COLOR_FORMAT,
                    MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface
                )
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
            }

            val c = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
            c.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            inputSurface = c.createInputSurface()
            c.start()
            codec = c

            muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            promise.resolve(true)
        } catch (e: Exception) {
            cleanup()
            promise.reject("START_ERR", e.message, e)
        }
    }

    @ReactMethod
    fun addFrame(base64Jpeg: String, promise: Promise) {
        try {
            val surface = inputSurface ?: throw IllegalStateException("Encoder not started")
            val bytes = Base64.decode(base64Jpeg, Base64.DEFAULT)
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                ?: throw IllegalStateException("Failed to decode frame bitmap")

            val canvas = surface.lockHardwareCanvas()
            val src = Rect(0, 0, bitmap.width, bitmap.height)
            val dst = Rect(0, 0, canvas.width, canvas.height)
            canvas.drawBitmap(bitmap, src, dst, null)
            surface.unlockCanvasAndPost(canvas)
            bitmap.recycle()

            drainEncoder(false)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("FRAME_ERR", e.message, e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            codec?.signalEndOfInputStream()
            drainEncoder(true)

            muxer?.stop()
            muxer?.release()
            codec?.stop()
            codec?.release()
            inputSurface?.release()

            val path = outPath
            cleanup()
            promise.resolve(path)
        } catch (e: Exception) {
            cleanup()
            promise.reject("STOP_ERR", e.message, e)
        }
    }

    private fun cleanup() {
        codec = null
        muxer = null
        inputSurface = null
        outPath = null
        trackIndex = -1
        muxerStarted = false
    }

    private fun drainEncoder(endOfStream: Boolean) {
        val c = codec ?: return
        val m = muxer ?: return

        while (true) {
            val index = c.dequeueOutputBuffer(bufferInfo, if (endOfStream) 10_000L else 0L)
            when {
                index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    trackIndex = m.addTrack(c.outputFormat)
                    m.start()
                    muxerStarted = true
                }
                index >= 0 -> {
                    val buffer = c.getOutputBuffer(index)
                    if (buffer != null && bufferInfo.size > 0 && muxerStarted &&
                        (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0
                    ) {
                        buffer.position(bufferInfo.offset)
                        buffer.limit(bufferInfo.offset + bufferInfo.size)
                        m.writeSampleData(trackIndex, buffer, bufferInfo)
                    }
                    c.releaseOutputBuffer(index, false)
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return
                }
                else -> {
                    if (!endOfStream) return
                }
            }
        }
    }
}
