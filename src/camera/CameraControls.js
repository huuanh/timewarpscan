import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ModeSelector from './ModeSelector';

const CameraControls = ({
    mode,
    onModeChange,
    isRecording,
    onCapture,
    onSwitchCamera,
    onToggleEffects,
}) => (
    <View style={styles.container}>
        <ModeSelector mode={mode} onModeChange={onModeChange} />

        <View style={styles.row}>
            {/* Effects button */}
            <TouchableOpacity style={styles.sideBtn} onPress={onToggleEffects}>
                <Icon name="auto-awesome" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Capture button */}
            <TouchableOpacity
                style={styles.captureOuter}
                onPress={onCapture}
                activeOpacity={0.7}
            >
                <View
                    style={[
                        styles.captureInner,
                        mode === 'video' && isRecording && styles.captureRecording,
                    ]}
                />
            </TouchableOpacity>

            {/* Switch camera */}
            <TouchableOpacity style={styles.sideBtn} onPress={onSwitchCamera}>
                <Icon name="flip-camera-android" size={28} color="#fff" />
            </TouchableOpacity>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: {
        paddingBottom: 24,
        paddingTop: 12,
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
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        maxWidth: 48,
    },
    captureOuter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: '#fff',
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
});

export default React.memo(CameraControls);
