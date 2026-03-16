import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import EFFECTS from '../effects/effectsConfig';
import EffectButton from './EffectButton';

const EffectSelector = ({ selectedEffect, onSelectEffect, onClose }) => (
    <View style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Warp Effects</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
        <FlatList
            data={EFFECTS}
            numColumns={4}
            showsVerticalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
                <EffectButton
                    effect={item}
                    selected={selectedEffect === item.id}
                    onPress={() => onSelectEffect(item.id)}
                />
            )}
            contentContainerStyle={styles.list}
            columnWrapperStyle={styles.row}
        />
    </View>
);

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(0,0,0,0.75)',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingTop: 14,
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    list: {
        paddingHorizontal: 8,
    },
    row: {
        justifyContent: 'flex-start',
        marginBottom: 8,
    },
});

export default React.memo(EffectSelector);
