import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Alert,
    Image,
    useWindowDimensions,
    NativeModules,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { Canvas, Fill, Shader, ImageShader, Skia, Image as SkiaImage, Group, Line as SkiaLine } from '@shopify/react-native-skia';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useCameraPermission from '../hooks/useCameraPermission';
import CameraControls from './CameraControls';
import EffectSelector from '../components/EffectSelector';
import EFFECTS from '../effects/effectsConfig';
import { savePhoto, saveVideo } from '../utils/mediaSaver';
import CAMERA_CONFIG from './cameraConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCAN_LINE_COLORS = ['#00FFFF', '#FF0000', '#00FF00', '#FFFF00', '#FF00FF', '#FFFFFF'];
const SPEED_OPTIONS = [1, 1.5, 2, 3];
const TIMER_OPTIONS = [0, 3, 5, 10];

const { FileWriter, VideoEncoder, FrameGrabber } = NativeModules;

/**
 * Apply a Skia shader effect to an SkImage on an offscreen surface.
 * Returns a processed SkImage.
 */
function applyShaderToImage(srcImage, effectId, time) {
    const effect = EFFECTS.find((e) => e.id === effectId);
    if (!effect?.shader) return srcImage;

    const rt = Skia.RuntimeEffect.Make(effect.shader);
    if (!rt) return srcImage;

    const w = srcImage.width();
    const h = srcImage.height();

    const surface = Skia.Surface.Make(w, h);
    if (!surface) return srcImage;

    const canvas = surface.getCanvas();
    const paint = Skia.Paint();

    const imageShader = srcImage.makeShaderOptions(0, 0, 0, 0);
    const uniforms = [w, h];
    if (effect.shader.includes('uniform float time')) {
        uniforms.push(time);
    }
    const shader = rt.makeShaderWithChildren(uniforms, [imageShader]);
    paint.setShader(shader);
    canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
    surface.flush();

    return surface.makeImageSnapshot();
}

const CameraScreen = ({ navigation }) => {
    const cameraRef = useRef(null);
    const { hasAllPermissions, requestPermissions } = useCameraPermission();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const [cameraPosition, setCameraPosition] = useState('front');
    const [mode, setMode] = useState('photo');
    const [isRecording, setIsRecording] = useState(false);
    const [selectedEffect, setSelectedEffect] = useState('normal');
    const [showEffects, setShowEffects] = useState(false);
    const [frameImage, setFrameImage] = useState(null);

    // Toolbar state
    const [scanDirection, setScanDirection] = useState('down'); // 'down' | 'up' for waterfall, 'right' | 'left' for single
    const [scanLineColor, setScanLineColor] = useState('#00FFFF');
    const [timerSeconds, setTimerSeconds] = useState(0); // 0 = no timer
    const [speedMultiplier, setSpeedMultiplier] = useState(1);
    const [timerCountdown, setTimerCountdown] = useState(0);

    const device = useCameraDevice(cameraPosition);
    const timeRef = useRef(0);
    const isEffectRecordingRef = useRef(false);

    // Waterfall scan state
    const [isWaterfallCapturing, setIsWaterfallCapturing] = useState(false);
    const [scanProgress, setScanProgress] = useState(0); // 0.0 → 1.0
    const [waterfallComposite, setWaterfallComposite] = useState(null);
    const waterfallCaptureRef = useRef(false); // true while scan is running

    // Compile current effect shader (null for 'normal')
    const runtimeEffect = useMemo(() => {
        if (selectedEffect === 'normal') return null;
        const effect = EFFECTS.find((e) => e.id === selectedEffect);
        if (!effect?.shader) return null;
        return Skia.RuntimeEffect.Make(effect.shader);
    }, [selectedEffect]);

    // Whether this effect needs a time uniform
    const needsTime = useMemo(() => {
        const effect = EFFECTS.find((e) => e.id === selectedEffect);
        return effect?.shader?.includes('uniform float time') ?? false;
    }, [selectedEffect]);

    // Snapshot capture loop — runs when a shader effect is active
    useEffect(() => {
        if (!runtimeEffect) {
            setFrameImage(null);
            timeRef.current = 0;
            return;
        }

        let active = true;

        const captureLoop = async () => {
            while (active) {
                // Pause while waterfall scan manages its own snapshots
                if (waterfallCaptureRef.current) {
                    await new Promise((r) => setTimeout(r, 50));
                    continue;
                }
                if (cameraRef.current) {
                    try {
                        const snapshot = await cameraRef.current.takeSnapshot({
                            quality: 40,
                        });
                        if (!active) break;

                        const data = await Skia.Data.fromURI(
                            `file://${snapshot.path}`,
                        );
                        if (!active) break;

                        const img = Skia.Image.MakeImageFromEncoded(data);
                        if (img && active) {
                            timeRef.current += 0.05;
                            setFrameImage(img);

                            // Feed processed frame to video encoder during recording
                            if (isEffectRecordingRef.current) {
                                try {
                                    const processed = applyShaderToImage(
                                        img,
                                        selectedEffect,
                                        timeRef.current,
                                    );
                                    const base64 = processed.encodeToBase64(0, 70);
                                    await VideoEncoder.addFrame(base64);
                                } catch (_e) {
                                    // Skip frame on encoding error
                                }
                            }
                        }
                    } catch (_) {
                        // Skip frame on error (camera busy, etc.)
                    }
                }
                await new Promise((r) => setTimeout(r, 40));
            }
        };

        captureLoop();
        return () => {
            active = false;
        };
    }, [runtimeEffect, selectedEffect]);

    // Request permissions on mount
    useEffect(() => {
        if (!hasAllPermissions) {
            requestPermissions();
        }
    }, [hasAllPermissions, requestPermissions]);

    // Hide Android navigation bar (immersive mode)
    useEffect(() => {
        StatusBar.setHidden(true);
        return () => StatusBar.setHidden(false);
    }, []);

    const handleBack = useCallback(() => {
        if (navigation?.canGoBack()) navigation.goBack();
    }, [navigation]);

    const handleSwitchCamera = useCallback(() => {
        setCameraPosition((p) => (p === 'front' ? 'back' : 'front'));
    }, []);

    // ══════════════════════════════════════════════════════════════════════
    // TimeWarp Scan — progressive composite, one thin strip per frame.
    //
    // Strategy: NO blending. Maximize capture fps so each strip is thin
    // enough (~1-3px) that transitions look natural.
    //
    // Performance pipeline:
    //   - Native: getBitmap + inline JPEG (no worker hop) → ~5-7ms
    //   - JS pipelining: grab N+1 overlaps with processing N
    //   - Downscale to 720px: 4× fewer pixels → faster encode/decode
    //   - JPEG quality 70: good enough for thin strips
    //   - Deferred flush: only when UI or video needs snapshot
    //   - Video encoder: back-pressure, skip if busy
    //   - Scan line: rAF-driven at 60fps, decoupled from capture rate
    //   - Expected: 50-80fps → strips ~1-2px → no visible seams
    // ══════════════════════════════════════════════════════════════════════
    const runWaterfallScan = useCallback(async (forVideo) => {
        if (!cameraRef.current || waterfallCaptureRef.current) return;

        const SCAN_DURATION_MS      = CAMERA_CONFIG.waterfallScanDurationMs;
        const UI_UPDATE_INTERVAL_MS = 33;
        const SNAPSHOT_QUALITY      = 95;
        const GRAB_MAX_W = 0; // 0 = no downscale, use native preview resolution

        waterfallCaptureRef.current = true;
        setIsWaterfallCapturing(true);
        setIsRecording(true);
        setScanProgress(0);
        setWaterfallComposite(null);

        const startTime = Date.now();
        let animFrameId = null;
        const animTick = () => {
            const p = Math.min((Date.now() - startTime) / SCAN_DURATION_MS, 1.0);
            setScanProgress(p);
            if (p < 1.0 && waterfallCaptureRef.current) {
                animFrameId = requestAnimationFrame(animTick);
            }
        };
        animFrameId = requestAnimationFrame(animTick);

        try {
            // Deferred: composite created from first grabbed frame dimensions
            // getBitmap() returns TextureView pixel size with VisionCamera's transform applied
            let OUTPUT_W = 0;
            let OUTPUT_H = 0;
            let compositeSurface = null;
            let compositeCanvas  = null;
            let outputRect       = null;
            let srcRect          = null;
            const stripPaint     = Skia.Paint();

            let videoOutPath  = null;
            let frameSurface  = null;
            let framePaint    = null;
            let scanLinePaint = null;

            let lastStripY       = 0;
            let lastUIUpdateTime = 0;
            let encoderBusy      = false;
            let frameCount       = 0;
            let lastImg          = null;

            // ── Main capture loop (pipelined: grab N+1 while processing N) ─
            let pendingGrab = FrameGrabber.grabFrameBase64(SNAPSHOT_QUALITY, GRAB_MAX_W);
            while (waterfallCaptureRef.current) {
                let img = null;
                let b64 = null;
                try { b64 = await pendingGrab; } catch (_) { /* grab failed */ }
                // Start next grab immediately — runs on native thread in parallel
                pendingGrab = FrameGrabber.grabFrameBase64(SNAPSHOT_QUALITY, GRAB_MAX_W);
                if (!waterfallCaptureRef.current) break;
                if (!b64) continue;
                try {
                    const data = Skia.Data.fromBase64(b64);
                    img = Skia.Image.MakeImageFromEncoded(data);
                } catch (_) { continue; }
                if (!img) continue;

                // First frame: create composite at grabbed frame dimensions
                // getBitmap() includes VisionCamera's center-crop transform
                if (!compositeSurface) {
                    const imgW = img.width();
                    const imgH = img.height();
                    // Use grabbed frame dimensions directly (already transformed by VisionCamera)
                    OUTPUT_W = Math.min(imgW, imgH);
                    OUTPUT_H = Math.max(imgW, imgH);
                    console.log(`Waterfall: frame ${imgW}x${imgH}, composite ${OUTPUT_W}x${OUTPUT_H}, screen ${screenWidth}x${screenHeight}`);

                    compositeSurface = Skia.Surface.Make(OUTPUT_W, OUTPUT_H);
                    if (!compositeSurface) throw new Error('Failed to create composite surface');
                    compositeCanvas = compositeSurface.getCanvas();

                    srcRect    = Skia.XYWHRect(0, 0, imgW, imgH);
                    outputRect = Skia.XYWHRect(0, 0, OUTPUT_W, OUTPUT_H);

                    if (forVideo) {
                        const tempDir = await FileWriter.getTempDir();
                        videoOutPath = `${tempDir}/waterfall_video_${Date.now()}.mp4`;
                        await VideoEncoder.start(OUTPUT_W, OUTPUT_H, 30, videoOutPath);
                    }
                }

                const elapsed  = Date.now() - startTime;
                const progress = Math.min(elapsed / SCAN_DURATION_MS, 1.0);
                const targetY  = Math.round(progress * OUTPUT_H);

                if (targetY <= lastStripY) continue;

                // Draw strip — 1:1 pixel mapping, no rescaling
                compositeCanvas.save();
                compositeCanvas.clipRect(
                    Skia.XYWHRect(0, lastStripY, OUTPUT_W, targetY - lastStripY),
                    1, false,
                );
                compositeCanvas.drawImageRect(img, srcRect, outputRect, stripPaint);
                compositeCanvas.restore();

                lastStripY = targetY;
                lastImg = img;
                frameCount++;

                // DEFERRED flush: only pay the cost when we actually need a snapshot
                const now = Date.now();
                const needsUI    = (now - lastUIUpdateTime >= UI_UPDATE_INTERVAL_MS);
                const needsVideo = forVideo && !encoderBusy;

                if (needsUI || needsVideo) {
                    compositeSurface.flush();
                    const compositeImg = compositeSurface.makeImageSnapshot();

                    if (needsUI) {
                        setWaterfallComposite(compositeImg);
                        lastUIUpdateTime = now;
                    }

                    if (needsVideo) {
                        if (!frameSurface) {
                            frameSurface  = Skia.Surface.Make(OUTPUT_W, OUTPUT_H);
                            framePaint    = Skia.Paint();
                            scanLinePaint = Skia.Paint();
                            scanLinePaint.setColor(Skia.Color('#00FFFF'));
                            scanLinePaint.setStrokeWidth(3);
                        }
                        try {
                            const fc = frameSurface.getCanvas();
                            fc.drawImageRect(img, srcRect, outputRect, framePaint);
                            fc.save();
                            fc.clipRect(
                                Skia.XYWHRect(0, 0, OUTPUT_W, lastStripY), 1, false,
                            );
                            fc.drawImageRect(
                                compositeImg, outputRect, outputRect, framePaint,
                            );
                            fc.restore();
                            fc.drawLine(
                                0, lastStripY, OUTPUT_W, lastStripY, scanLinePaint,
                            );
                            frameSurface.flush();

                            encoderBusy = true;
                            VideoEncoder.addFrame(
                                frameSurface.makeImageSnapshot().encodeToBase64(0, 70),
                            )
                                .catch(() => {})
                                .finally(() => { encoderBusy = false; });
                        } catch (_) {}
                    }
                }

                if (progress >= 1.0 || lastStripY >= OUTPUT_H) break;
            }

            // ── Finalize ─────────────────────────────────────────────────────
            const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
            const fps = (frameCount / parseFloat(durationSec)).toFixed(1);
            console.log(`Waterfall scan: ${frameCount} frames in ${durationSec}s (${fps} fps), strip ~${(OUTPUT_H / frameCount).toFixed(1)}px`);

            if (compositeSurface) {
                compositeSurface.flush();
                const finalImg = compositeSurface.makeImageSnapshot();
                setWaterfallComposite(finalImg);

                if (forVideo && videoOutPath) {
                    if (frameSurface && framePaint) {
                        try {
                            const fc = frameSurface.getCanvas();
                            fc.drawImageRect(
                                finalImg, outputRect, outputRect, framePaint,
                            );
                            frameSurface.flush();
                            const finalBase64 = frameSurface
                                .makeImageSnapshot()
                                .encodeToBase64(0, 70);
                            for (let i = 0; i < 30; i++) {
                                await VideoEncoder.addFrame(finalBase64);
                            }
                        } catch (_) {}
                    }
                    const outPath = await VideoEncoder.stop();
                    await saveVideo(outPath);
                    Alert.alert('Saved', 'Video saved to gallery');
                } else if (!forVideo) {
                    const base64 = finalImg.encodeToBase64(0, 95);
                    const tempDir = await FileWriter.getTempDir();
                    const outPath = `${tempDir}/waterfall_photo_${Date.now()}.jpg`;
                    await FileWriter.writeBase64ToFile(base64, outPath);
                    await savePhoto(outPath);
                    Alert.alert('Saved', 'Photo saved to gallery');
                }
            }
        } catch (e) {
            console.error('Waterfall scan error:', e);
        } finally {
            if (animFrameId) cancelAnimationFrame(animFrameId);
            waterfallCaptureRef.current = false;
            setIsWaterfallCapturing(false);
            setIsRecording(false);
            setScanProgress(0);
            setWaterfallComposite(null);
        }
    }, [screenWidth, screenHeight]);

    const handleCapture = useCallback(async () => {
        if (!cameraRef.current) return;

        // Waterfall: tap to start scan, tap again to stop early
        if (selectedEffect === 'waterfall') {
            if (isWaterfallCapturing) {
                waterfallCaptureRef.current = false;
                return;
            }
            runWaterfallScan(mode === 'video');
            return;
        }

        if (mode === 'photo') {
            try {
                if (selectedEffect === 'normal') {
                    const photo = await cameraRef.current.takePhoto({ flash: 'off' });
                    await savePhoto(photo.path);
                } else {
                    const snapshot = await cameraRef.current.takeSnapshot({ quality: 95 });
                    const data = await Skia.Data.fromURI(`file://${snapshot.path}`);
                    const srcImage = Skia.Image.MakeImageFromEncoded(data);
                    if (!srcImage) throw new Error('Failed to decode snapshot');

                    const processed = applyShaderToImage(srcImage, selectedEffect, timeRef.current);
                    const base64 = processed.encodeToBase64(0, 95);

                    const tempDir = await FileWriter.getTempDir();
                    const outPath = `${tempDir}/effect_photo_${Date.now()}.jpg`;
                    await FileWriter.writeBase64ToFile(base64, outPath);
                    await savePhoto(outPath);
                }
                Alert.alert('Saved', 'Photo saved to gallery');
            } catch (e) {
                console.error('Photo capture error:', e);
            }
        } else {
            // Video mode
            if (isRecording) {
                // Stop recording
                if (selectedEffect !== 'normal' && isEffectRecordingRef.current) {
                    // Stop effect video encoder
                    isEffectRecordingRef.current = false;
                    setIsRecording(false);
                    try {
                        const outputPath = await VideoEncoder.stop();
                        await saveVideo(outputPath);
                        Alert.alert('Saved', 'Video saved to gallery');
                    } catch (e) {
                        console.error('Effect video save error:', e);
                    }
                } else {
                    // Stop normal camera recording
                    await cameraRef.current.stopRecording();
                }
            } else {
                // Start recording
                setIsRecording(true);
                if (selectedEffect !== 'normal') {
                    // Start effect video encoder — frames fed by snapshot loop
                    try {
                        const tempDir = await FileWriter.getTempDir();
                        const outPath = `${tempDir}/effect_video_${Date.now()}.mp4`;
                        await VideoEncoder.start(720, 1280, 15, outPath);
                        isEffectRecordingRef.current = true;
                    } catch (e) {
                        setIsRecording(false);
                        console.error('Effect recording start error:', e);
                    }
                } else {
                    // Normal camera recording
                    cameraRef.current.startRecording({
                        flash: 'off',
                        onRecordingFinished: async (video) => {
                            setIsRecording(false);
                            try {
                                await saveVideo(video.path);
                                Alert.alert('Saved', 'Video saved to gallery');
                            } catch (e) {
                                console.error('Video save error:', e);
                            }
                        },
                        onRecordingError: (error) => {
                            setIsRecording(false);
                            console.error('Recording error:', error);
                        },
                    });
                }
            }
        }
    }, [mode, isRecording, selectedEffect, runWaterfallScan]);

    const handleToggleEffects = useCallback(() => {
        setShowEffects((v) => !v);
    }, []);

    const handleSelectEffect = useCallback((effectId) => {
        setSelectedEffect(effectId);
        setShowEffects(false);
    }, []);

    // Permission not granted yet
    if (!hasAllPermissions) {
        return (
            <View style={styles.permissionContainer}>
                <StatusBar barStyle="light-content" backgroundColor="#000" />
                <Icon name="camera-alt" size={48} color="#555" />
                <Text style={styles.permissionText}>
                    Camera & microphone permissions are required
                </Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermissions}>
                    <Text style={styles.permissionBtnText}>Grant Permissions</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // No device found
    if (!device) {
        return (
            <View style={styles.permissionContainer}>
                <StatusBar barStyle="light-content" backgroundColor="#000" />
                <Icon name="error-outline" size={48} color="#e55" />
                <Text style={styles.permissionText}>No camera device found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar hidden={true} />

            {/* Native camera preview (always visible) */}
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                photo={true}
                video={true}
                audio={true}
                androidPreviewViewType="texture-view"
            />

            {/* Skia shader overlay — non-waterfall effects, and waterfall preview (not scanning) */}
            {runtimeEffect && frameImage && !isWaterfallCapturing && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Canvas style={{ width: screenWidth, height: screenHeight }}>
                        <Fill>
                            <Shader
                                source={runtimeEffect}
                                uniforms={{
                                    resolution: [screenWidth, screenHeight],
                                    ...(needsTime ? { time: timeRef.current } : {}),
                                }}
                            >
                                <ImageShader
                                    image={frameImage}
                                    fit="cover"
                                    width={screenWidth}
                                    height={screenHeight}
                                    tx="clamp"
                                    ty="clamp"
                                />
                            </Shader>
                        </Fill>
                    </Canvas>
                </View>
            )}

            {/* Waterfall scan overlay — composite above scan line, native camera visible below */}
            {isWaterfallCapturing && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Canvas style={{ width: screenWidth, height: screenHeight }}>
                        {/* Composite frozen strips, clipped above scan line */}
                        {waterfallComposite && (
                            <Group
                                clip={Skia.XYWHRect(
                                    0, 0,
                                    screenWidth,
                                    scanProgress * screenHeight,
                                )}
                            >
                                <SkiaImage
                                    image={waterfallComposite}
                                    x={0}
                                    y={0}
                                    width={screenWidth}
                                    height={screenHeight}
                                    fit="cover"
                                />
                            </Group>
                        )}
                        <SkiaLine
                            p1={{ x: 0, y: scanProgress * screenHeight }}
                            p2={{ x: screenWidth, y: scanProgress * screenHeight }}
                            color="#00FFFF"
                            strokeWidth={3}
                        />
                    </Canvas>
                </View>
            )}

            {/* Back button */}
            <TouchableOpacity style={[styles.topBtn, { position: 'absolute', top: insets.top + 8, left: 12, zIndex: 11 }]} onPress={handleBack}>
                <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Top bar */}
            <View style={[styles.topBar, { top: insets.top + 8 }]}>
                <View style={styles.toolbar}>
                    {/* Scan direction */}
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => {
                            if (selectedEffect === 'waterfall') {
                                setScanDirection(d => d === 'down' ? 'up' : 'down');
                            } else {
                                setScanDirection(d => d === 'right' ? 'left' : 'right');
                            }
                        }}
                    >
                        <Image
                            source={
                                (selectedEffect === 'waterfall' || selectedEffect === 'normal')
                                    ? require('../../assets/home/top-bot.png')
                                    : require('../../assets/home/left-right.png')
                            }
                            style={[
                                styles.toolIcon,
                                (scanDirection === 'up' || scanDirection === 'left') && styles.toolIconFlipped,
                            ]}
                        />
                    </TouchableOpacity>
                    {/* Scan line color */}
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => {
                            const idx = SCAN_LINE_COLORS.indexOf(scanLineColor);
                            setScanLineColor(SCAN_LINE_COLORS[(idx + 1) % SCAN_LINE_COLORS.length]);
                        }}
                    >
                        <Image
                            source={require('../../assets/home/scan_color.png')}
                            style={[styles.toolIcon, { tintColor: scanLineColor }]}
                        />
                    </TouchableOpacity>
                    {/* Timer */}
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => {
                            const idx = TIMER_OPTIONS.indexOf(timerSeconds);
                            setTimerSeconds(TIMER_OPTIONS[(idx + 1) % TIMER_OPTIONS.length]);
                        }}
                    >
                        <Image
                            source={require('../../assets/home/countdown.png')}
                            style={styles.toolIcon}
                        />
                        {timerSeconds > 0 && (
                            <View style={styles.toolBadge}>
                                <Text style={styles.toolBadgeText}>{timerSeconds}s</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {/* Speed */}
                    <TouchableOpacity
                        style={styles.toolBtn}
                        onPress={() => {
                            const idx = SPEED_OPTIONS.indexOf(speedMultiplier);
                            setSpeedMultiplier(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
                        }}
                    >
                        <Image
                            source={require('../../assets/home/speeed.png')}
                            style={styles.toolIcon}
                        />
                        {speedMultiplier !== 1 && (
                            <View style={styles.toolBadge}>
                                <Text style={styles.toolBadgeText}>{speedMultiplier}x</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Timer countdown overlay */}
            {timerCountdown > 0 && (
                <View style={styles.timerOverlay} pointerEvents="none">
                    <Text style={styles.timerText}>{timerCountdown}</Text>
                </View>
            )}

            {/* Effect selector panel */}
            {showEffects && (
                <View style={styles.effectPanel}>
                    <EffectSelector
                        selectedEffect={selectedEffect}
                        onSelectEffect={handleSelectEffect}
                        onClose={handleToggleEffects}
                    />
                </View>
            )}

            {/* Bottom controls */}
            <View style={styles.bottomArea}>
                <CameraControls
                    mode={mode}
                    onModeChange={setMode}
                    isRecording={isRecording}
                    onCapture={handleCapture}
                    onSwitchCamera={handleSwitchCamera}
                    onToggleEffects={handleToggleEffects}
                    selectedEffect={selectedEffect}
                    isScanning={isWaterfallCapturing}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    topBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    topBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolbar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 20,
        paddingHorizontal: 4,
    },
    toolBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolIcon: {
        width: 22,
        height: 22,
        tintColor: '#fff',
    },
    toolIconFlipped: {
        transform: [{ rotate: '180deg' }],
    },
    toolBadge: {
        position: 'absolute',
        top: 2,
        right: 0,
        backgroundColor: '#D4A94B',
        borderRadius: 6,
        paddingHorizontal: 3,
        paddingVertical: 1,
    },
    toolBadgeText: {
        color: '#000',
        fontSize: 8,
        fontWeight: '700',
    },
    timerOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 30,
    },
    timerText: {
        fontSize: 80,
        fontWeight: '700',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    bottomArea: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    effectPanel: {
        position: 'absolute',
        bottom: 160,
        left: 0,
        right: 0,
        zIndex: 20,
    },
    permissionContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    permissionText: {
        color: '#aaa',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 24,
    },
    permissionBtn: {
        backgroundColor: '#D4A94B',
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 24,
    },
    permissionBtnText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '700',
    },
});

export default CameraScreen;
