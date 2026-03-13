import { StatusBar, StyleSheet, useColorScheme, View, AppState, Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import React, { useEffect, useState } from 'react';
import LoadingScreen from './src/components/LoadingScreen';
import OnBoardScreen from './src/components/OnBoardScreen';
import HomeNavigator from './src/navigation/HomeNavigator';
import { COLORS, FONTS } from './src/constants';
import ReactContextManager from './src/utils/ReactContextManager';
import NetworkLoadingModal from './src/components/NetworkLoadingModal';
import useNetworkConnection from './src/hooks/useNetworkConnection';

function App() {
  const [scene, setScene] = useState('loading'); // 'loading' | 'onboard' | 'home'
  const [showGlobalNetworkModal, setShowGlobalNetworkModal] = useState(false);

  const isDarkMode = useColorScheme() === 'light';

  // Use network connection hook
  const { isConnected, isChecking } = useNetworkConnection();

  useEffect(() => {
    // Set default font for all Text components
    Text.defaultProps = Text.defaultProps || {};
    Text.defaultProps.style = { fontFamily: FONTS.PRIMARY };
    
    console.log('🚀 App initialization started...');

    return () => {
      ReactContextManager.cleanup();
    };
  }, []);

  // Network state management
  useEffect(() => {
    if (!isConnected && !isChecking) {
      setShowGlobalNetworkModal(true);
    }
  }, [isConnected, isChecking]);

  const handleLoadingComplete = () => {
    console.log('✅ Loading complete, navigating to OnBoarding...');
    setScene('onboard');
  };

  const handleOnBoardNext = () => {
    console.log('🔄 OnBoard completed, navigating to Home...');
    setScene('home');
  };

  const handleGlobalNetworkRestored = () => {
    console.log('🎉 App: Global network connection restored');
    setShowGlobalNetworkModal(false);
  };


  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: 'white' }} edges={['top', 'bottom']}>
      <SafeAreaView style={{ flex: 1 }}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={COLORS.BACKGROUND}
      />
      {scene === 'loading' ? (
        <LoadingScreen onComplete={handleLoadingComplete} />
      ) : scene === 'onboard' ? (
        <OnBoardScreen onNext={handleOnBoardNext} />
      ) : (
        <NavigationContainer>
          <HomeNavigator />
        </NavigationContainer>
      )}
      
      {/* Global Network Loading Modal - Don't show on network-required scene */}
      <NetworkLoadingModal
        visible={showGlobalNetworkModal }
        onConnectionRestored={handleGlobalNetworkRestored}
      />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.js"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
});

export default App;
