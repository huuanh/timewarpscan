import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const MODES = ['video', 'photo'];

const ModeSelector = ({ mode, onModeChange }) => (
    <View style={styles.container}>
        {MODES.map((m) => (
            <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => onModeChange(m)}
                activeOpacity={0.7}
            >
                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
            </TouchableOpacity>
        ))}
    </View>
);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        padding: 3,
        alignSelf: 'center',
    },
    modeBtn: {
        paddingHorizontal: 18,
        paddingVertical: 6,
        borderRadius: 17,
    },
    modeBtnActive: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    modeText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        fontWeight: '600',
    },
    modeTextActive: {
        color: '#fff',
    },
});

export default React.memo(ModeSelector);
