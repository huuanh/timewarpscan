import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import EFFECTS from '../effects/effectsConfig';

const WarpRenderer = ({ effectId, children }) => {
    const effect = useMemo(
        () => EFFECTS.find((e) => e.id === effectId),
        [effectId],
    );

    const transformStyle = useMemo(() => {
        if (!effect || !effect.transform || effect.transform.length === 0) {
            return {};
        }
        return { transform: effect.transform };
    }, [effect]);

    return (
        <View style={[styles.container, transformStyle]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
});

export default React.memo(WarpRenderer);
