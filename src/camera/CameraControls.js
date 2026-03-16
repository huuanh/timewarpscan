import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import ModeSelector from './ModeSelector';
import EFFECTS from '../effects/effectsConfig';

const CameraControls = ({
    mode,
    onModeChange,
    isRecording,
    onCapture,
    onSwitchCamera,
    onToggleEffects,
    selectedEffect,
    isScanning,
}) => {
    const effect = EFFECTS.find((e) => e.id === selectedEffect) || EFFECTS[0];

    return (
        <View style={styles.container}>
            <ModeSelector mode={mode} onModeChange={onModeChange} />

            <View style={styles.row}>
                {/* Effects button — shows selected effect icon */}
                <TouchableOpacity style={styles.sideBtn} onPress={onToggleEffects}>
                    <Image source={effect.image} style={styles.effectIcon} />
                </TouchableOpacity>

                {/* Capture button */}
                <TouchableOpacity
                    style={styles.captureOuter}
                    onPress={onCapture}
                    activeOpacity={0.7}
                >
                    {isScanning ? (
                        <Image
                            source={require('../../assets/home/pause.png')}
                            style={styles.pauseIcon}
                        />
                    ) : mode === 'video' ? (
                        <Image
                            source={require('../../assets/home/video.png')}
                            style={styles.pauseIcon}
                        />
                    ) : (
                        <Image
                            source={require('../../assets/home/camera.png')}
                            style={styles.pauseIcon}
                        />
                    )}
                </TouchableOpacity>

                {/* Switch camera */}
                <TouchableOpacity style={styles.sideBtn} onPress={onSwitchCamera}>
                    <Image
                        source={require('../../assets/home/rotate.png')}
                        style={styles.rotateIcon}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingBottom: 8,
        paddingTop: 8,
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        width: '100%',
        paddingHorizontal: 40,
    },
    sideBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        // backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        maxWidth: 48,
    },
    captureOuter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 32,
    },
    captureInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#fff',
    },
    captureRecording: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: '#E53935',
    },
    effectIcon: {
        width: 48,
        height: 48,
        borderRadius: 18,
    },
    pauseIcon: {
        width: 68,
        height: 68,
        // tintColor: '#D4A94B',
    },
    rotateIcon: {
        width: 48,
        height: 48,
        // tintColor: '#fff',
    },
});

export default React.memo(CameraControls);
