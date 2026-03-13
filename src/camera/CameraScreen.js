import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Alert,
} from 'react-native';
import { Camera, useCameraDevice, useSkiaFrameProcessor } from 'react-native-vision-camera';
import { Skia } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-worklets-core';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useCameraPermission from '../hooks/useCameraPermission';
import CameraControls from './CameraControls';
import EffectSelector from '../components/EffectSelector';
import EFFECTS from '../effects/effectsConfig';
import { savePhoto, saveVideo } from '../utils/mediaSaver';

// Pre-compile all RuntimeEffects at module level for perf
const COMPILED_EFFECTS = {};
EFFECTS.forEach((e) => {
    try {
        COMPILED_EFFECTS[e.id] = Skia.RuntimeEffect.Make(e.shader);
    } catch (err) {
        console.warn(`Shader compile error for ${e.id}:`, err);
    }
});

const CameraScreen = ({ navigation }) => {
    const cameraRef = useRef(null);
    const { hasAllPermissions, requestPermissions } = useCameraPermission();

    const [cameraPosition, setCameraPosition] = useState('front');
    const [mode, setMode] = useState('photo');
    const [isRecording, setIsRecording] = useState(false);
    const [selectedEffect, setSelectedEffect] = useState('normal');
    const [showEffects, setShowEffects] = useState(false);

    const device = useCameraDevice(cameraPosition);

    // Shared values for worklet access
    const effectId = useSharedValue('normal');
    const timeValue = useSharedValue(0);

    // Sync React state → shared value
    useEffect(() => {
        effectId.value = selectedEffect;
    }, [selectedEffect, effectId]);

    // Time animation for effects that use `time` uniform
    useEffect(() => {
        const hasTimeUniform = EFFECTS.find(
            (e) => e.id === selectedEffect,
        )?.shader?.includes('uniform float time');
        if (!hasTimeUniform) return;

        let frame;
        const start = Date.now();
        const tick = () => {
            timeValue.value = (Date.now() - start) / 1000;
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [selectedEffect, timeValue]);

    // Skia Frame Processor
    const frameProcessor = useSkiaFrameProcessor(
        (frame) => {
            'worklet';
            const eid = effectId.value;

            if (eid === 'normal' || !COMPILED_EFFECTS[eid]) {
                // No effect — just render the frame
                frame.render();
                return;
            }

            const rt = COMPILED_EFFECTS[eid];
            const paint = Skia.Paint();

            // Build uniforms
            const uniforms = [frame.width, frame.height]; // resolution
            const effect = EFFECTS.find((e) => e.id === eid);
            if (effect?.shader?.includes('uniform float time')) {
                uniforms.push(timeValue.value);
            }

            // Shader with camera image as child
            const imageShader = frame.__skImage.makeShaderOptions(
                0, // TileMode.Clamp
                0, // TileMode.Clamp
                0, // FilterMode.Nearest
                0, // MipmapMode.None
            );
            const shader = rt.makeShaderWithChildren(uniforms, [imageShader]);
            paint.setShader(shader);

            // Draw a full-screen rect with the shader
            const rect = Skia.XYWHRect(0, 0, frame.width, frame.height);
            frame.drawRect(rect, paint);
        },
        [effectId, timeValue],
    );

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
                const photo = await cameraRef.current.takePhoto({
                    flash: 'off',
                });
                await savePhoto(photo.path);
                Alert.alert('Saved', 'Photo saved to gallery');
            } catch (e) {
                console.error('Photo capture error:', e);
            }
        } else {
            // Video mode
            if (isRecording) {
                await cameraRef.current.stopRecording();
            } else {
                setIsRecording(true);
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
    }, [mode, isRecording]);

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

            {/* Camera Preview with Skia Frame Processor */}
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                photo={true}
                video={true}
                audio={true}
                frameProcessor={frameProcessor}
            />

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
