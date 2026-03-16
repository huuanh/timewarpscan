import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Image } from 'react-native';

const EffectButton = ({ effect, selected, onPress }) => (
    <TouchableOpacity
        style={[styles.container, selected && styles.selected]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
            <Image source={effect.image} style={styles.effectImage} />
        </View>
        <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
            {effect.name}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginHorizontal: 8,
        width: 64,
    },
    selected: {},
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    iconWrapSelected: {
        borderColor: '#D4A94B',
        backgroundColor: 'rgba(212,169,75,0.15)',
    },
    effectImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    label: {
        color: '#ccc',
        fontSize: 10,
        marginTop: 4,
        textAlign: 'center',
    },
    labelSelected: {
        color: '#D4A94B',
        fontWeight: '600',
    },
});

export default React.memo(EffectButton);
