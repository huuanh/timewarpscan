import { StatusBar, StyleSheet, useColorScheme, View, AppState, Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
// import { NavigationContainer } from '@react-navigation/native';

import React, { useEffect, useState } from 'react';
import LoadingScreen from './src/components/LoadingScreen';
import OnBoardScreen from './src/components/OnBoardScreen';
import HomeScreen from './src/components/HomeScreen';
import { COLORS, FONTS } from './src/constants';
import ReactContextManager from './src/utils/ReactContextManager';
import NetworkLoadingModal from './src/components/NetworkLoadingModal';
import useNetworkConnection from './src/hooks/useNetworkConnection';

function App() {
  const [loading, setLoading] = useState(true);
  const [showOnBoard, setShowOnBoard] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [showGlobalNetworkModal, setShowGlobalNetworkModal] = useState(false);

  const isDarkMode = useColorScheme() === 'light';

  // Use network connection hook
  const { isConnected, isChecking } = useNetworkConnection();

  useEffect(() => {
    // Set default font for all Text components
    Text.defaultProps = Text.defaultProps || {};
    Text.defaultProps.style = { fontFamily: FONTS.PRIMARY };
    
    // Simplified initialization using ReactContextManager
    console.log('🚀 App initialization started...');
    
    ReactContextManager.onReady( async () => {
      console.log('✅ App: React context ready, checking security...');
      setAppReady(true);
            
      // Check if authentication is required
      checkAuthenticationRequired();
    });

    // Cleanup on unmount
    return () => {
      ReactContextManager.cleanup();
      // IAPManager.cleanup();
    };
  }, []);

  // Network state management
  useEffect(() => {
    // Block loading screen if no network connection
    if (!isConnected && !isChecking) {
      // console.log('🌐 App: No network detected - blocking app access');
      
      // // Show network modal for other scenes (except network-required)
      // if (currentScene !== 'network-required') {
        setShowGlobalNetworkModal(true);
    //   }
    // } else if (isConnected && (showGlobalNetworkModal || currentScene === 'network-required')) {
    //   console.log('🎉 App: Network restored - allowing app access');
    //   setShowGlobalNetworkModal(false);
      
    //   // When network is restored from network-required screen, proceed to loading
    //   if (currentScene === 'network-required') {
    //     console.log('🔄 App: Network restored - proceeding to loading screen');
    //     setCurrentScene('loading');
    //   }
    }
  }, [isConnected, isChecking, showGlobalNetworkModal]);

  const startNormalFlow = () => {
    const timer = setTimeout(() => {
      setLoading(false);
      setShowOnBoard(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  };

  const handleOnBoardNext = () => {
    console.log('🔄 OnBoard completed, navigating to Permissions...');
    setShowOnBoard(false);
    setShowPermissions(true);
  };

  const handlePermissionsNext = () => {
    console.log('🔄 Permissions completed, navigating to Main App...');
    setShowPermissions(false);
  };

  const handlePermissionsSkip = () => {
    console.log('⏭️ Permissions skipped, navigating to Main App...');
    setShowPermissions(false);
  };

  const handleGlobalNetworkRestored = () => {
    console.log('🎉 App: Global network connection restored');
    setShowGlobalNetworkModal(false);
  };

  // Note: Mobile Ads initialization is handled by AdManager
  useEffect(() => {
    // const initializeMobileAds = async () => {
    //   try {
    //     // Try different ways to initialize
    //     if (GoogleMobileAds && typeof GoogleMobileAds.initialize === 'function') {
    //       await GoogleMobileAds.initialize();
    //       console.log('✅ Mobile Ads initialized via GoogleMobileAds.initialize');
    //     } else if (GoogleMobileAds && typeof GoogleMobileAds === 'function') {
    //       const adsInstance = GoogleMobileAds();
    //       if (adsInstance && typeof adsInstance.initialize === 'function') {
    //         await adsInstance.initialize();
    //         console.log('✅ Mobile Ads initialized via GoogleMobileAds().initialize');
    //       } else {
    //         console.log('⚠️ Mobile Ads initialize method not available, but components should work');
    //       }
    //     } else {
    //       console.log('⚠️ GoogleMobileAds not available as expected');
    //     }
    //   } catch (error) {
    //     console.log('⚠️ Mobile Ads initialization error (non-critical):', error);
    //   }
    // };
    
    // initializeMobileAds();
  }, []);


  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: 'white' }} edges={['top', 'bottom']}>
      <SafeAreaView style={{ flex: 1 }}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={COLORS.BACKGROUND}
      />
      {!appReady ? (
        <View style={styles.container}>
          <LoadingScreen />
        </View>
      ) : loading ? (
        <LoadingScreen />
      ) : showOnBoard ? (
        <OnBoardScreen onNext={handleOnBoardNext} />
      ) : (
        <HomeScreen />
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
