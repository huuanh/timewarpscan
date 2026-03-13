import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../components/HomeScreen';
import VideoPlayerScreen from '../components/VideoPlayerScreen';

const Stack = createNativeStackNavigator();

const HomeNavigator = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
            name="VideoPlayer"
            component={VideoPlayerScreen}
            options={{ animation: 'slide_from_right' }}
        />
    </Stack.Navigator>
);

export default HomeNavigator;
