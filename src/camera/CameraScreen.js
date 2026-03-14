import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Alert,
    useWindowDimensions,
    NativeModules,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { Canvas, Fill, Shader, ImageShader, Skia } from '@shopify/react-native-skia';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useCameraPermission from '../hooks/useCameraPermission';
import CameraControls from './CameraControls';
import EffectSelector from '../components/EffectSelector';
import EFFECTS from '../effects/effectsConfig';
import { savePhoto, saveVideo } from '../utils/mediaSaver';

const { FileWriter, VideoEncoder } = NativeModules;

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

    const [cameraPosition, setCameraPosition] = useState('front');
    const [mode, setMode] = useState('photo');
    const [isRecording, setIsRecording] = useState(false);
    const [selectedEffect, setSelectedEffect] = useState('normal');
    const [showEffects, setShowEffects] = useState(false);
    const [frameImage, setFrameImage] = useState(null);

    const device = useCameraDevice(cameraPosition);
    const timeRef = useRef(0);
    const isEffectRecordingRef = useRef(false);

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



    const handleBack = useCallback(() => {
        if (navigation?.canGoBack()) navigation.goBack();
    }, [navigation]);

    const handleSwitchCamera = useCallback(() => {
        setCameraPosition((p) => (p === 'front' ? 'back' : 'front'));
    }, []);

    const handleCapture = useCallback(async () => {
        if (!cameraRef.current) return;

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
    }, [mode, isRecording, selectedEffect]);

    const handleToggleEffects = useCallback(() => {
        setShowEffects((v) => !v);
    }, []);

    const handleSelectEffect = useCallback((effectId) => {
        setSelectedEffect(effectId);
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
            <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

            {/* Native camera preview (always visible) */}
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                photo={true}
                video={true}
                audio={true}
            />

            {/* Skia shader overlay — covers camera when effect is active */}
            {runtimeEffect && frameImage && (
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

            {/* Top bar */}
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.topBtn} onPress={handleBack}>
                    <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

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
        top: 16,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
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
