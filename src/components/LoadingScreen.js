import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Text, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdManager, { ADS_UNIT } from '../AdManager.js';
import RemoteConfigManager from '../RemoteConfigManager';
import IAPManager from '../utils/IAPManager';
import VIPManager from '../utils/VIPManager';
import NetworkManager from '../utils/NetworkManager';
import useTranslation from '../hooks/useTranslation';

const LoadingScreen = ({ onComplete }) => {
    const { t } = useTranslation();
  // State for loading text and progress
  const [loadingText, setLoadingText] = useState(t('loading', 'Loading...'));
  const [remoteConfigLoaded, setRemoteConfigLoaded] = useState(false);
  const [adManagerLoaded, setAdManagerLoaded] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [iapManagerLoaded, setIapManagerLoaded] = useState(false);
  const [vipManagerLoaded, setVipManagerLoaded] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Animated value for smooth progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Preload ads only once
  const interstitialRef = useRef(null);
  const appOpenRef = useRef(null);

  useEffect(() => {
    let isCompleted = false;
    const initializeServices = async () => {
      try {
        // First check network connection
        console.log('🌐 Checking network connection...');
        setLoadingText('Checking network connection...');
        setProgress(5);
        
        const isConnected = await NetworkManager.checkConnection();
        if (!isConnected) {
          console.log('❌ No network connection detected - App.js will handle modal');
          setLoadingText('No internet connection - Please check your connection');
          
          // Wait for connection before continuing services initialization
          try {
            await NetworkManager.waitForConnection(60000); // Wait up to 60 seconds
            console.log('✅ Network connection restored');
            setLoadingText('Connection restored - Initializing services...');
          } catch (error) {
            console.log('⏰ Network wait timeout');
            setLoadingText('Connection timeout - Some features may not work properly');
            // Continue with limited functionality
          }
        }
        
        console.log('🔧 Initializing services...');
        setLoadingText('Initializing services...');
        setProgress(10);
        
        // Initialize IAP Manager
        console.log('🔧 Loading IAP Manager...');
        setLoadingText('Loading IAP Manager...');
        setProgress(60);
        await IAPManager.getInstance().initialize();
        console.log('✅ IAP Manager initialized successfully');
        
        if (!isCompleted) {
          setIapManagerLoaded(true);
          setProgress(75);
        }
        
        // Initialize VIP Manager
        console.log('🔧 Loading VIP Manager...');
        setLoadingText('Checking VIP status...');
        setProgress(85);
        await VIPManager.getInstance().initialize();
        console.log('✅ VIP Manager initialized successfully');
        
        if (!isCompleted) {
          setVipManagerLoaded(true);
          setProgress(90);
        }
        
        // Initialize AdManager
        console.log('🔧 Loading AdManager...');
        setLoadingText('Loading....');
        setProgress(92);
        await AdManager.initialize();
        await RemoteConfigManager.initialize();
        console.log('✅ AdManager initialized successfully');
        
        if (!isCompleted) {
          setAdManagerLoaded(true);
          setProgress(96);
        }
        
        // Log final VIP status
        const vipManager = VIPManager.getInstance();
        const vipInfo = vipManager.getVipInfo();
        console.log('🏁 Final VIP Info:', vipInfo);
        
        setLoadingText('Ready to start!');
        setProgress(100);
        
      } catch (error) {
        console.log('⚠️ Service initialization error:', error);
        setLoadingText('Loading Failed - Continuing...');
        setProgress(100);
        
        // Set all as loaded even if failed to allow app to continue
        if (!isCompleted) {
          setAdManagerLoaded(true);
          setIapManagerLoaded(true);
          setVipManagerLoaded(true);
        }
      }
    };
    // Initialize services with timeout
    const timeoutId = setTimeout(() => {
      console.log('⏰ Services loading timeout reached (10s)');
      setLoadingText('Loading Timeout - Continuing...');
      setProgress(100);
      
      if (!isCompleted) {
        setTimeoutReached(true);
        setAdManagerLoaded(true);
        setIapManagerLoaded(true);
        setVipManagerLoaded(true);
      }
    }, 10000);
    
    initializeServices();
     // Cleanup function
    return () => {
      isCompleted = true;
      clearTimeout(timeoutId);
    };
  }, []);

  // Add smooth progress animation
  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Notify parent when all services are loaded
  useEffect(() => {
    if (adManagerLoaded && iapManagerLoaded && vipManagerLoaded && onComplete) {
      const timer = setTimeout(() => onComplete(), 500);
      return () => clearTimeout(timer);
    }
  }, [adManagerLoaded, iapManagerLoaded, vipManagerLoaded, onComplete]);

  // Start with initial progress
  useEffect(() => {
    const initialProgress = setInterval(() => {
      setProgress(prev => {
        if (prev < 15) {
          return prev + 1;
        }
        clearInterval(initialProgress);
        return prev;
      });
    }, 100);

    return () => clearInterval(initialProgress);
  }, []);

  return (
    <SafeAreaView style={styles.loadingContainer}>
      <Text style={styles.title}>{t('appTitle', 'Time Warp Scan')}</Text>
      <View style={styles.progressBarContainer}>
        <Animated.View 
          style={[
            styles.progressBar, 
            { 
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              })
            }
          ]} 
        />
        <View style={styles.progressBarBg} />
      </View>
      <Text style={styles.loadingText}>{loadingText}</Text>
      <Text style={styles.adsText}>{t('adsDisclaimer', 'This action may contain ads')}</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.TERTIARY,
    marginBottom: 40,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.TERTIARY,
    opacity: 0.4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.TERTIARY,
    zIndex: 1,
  },
  adsText: {
    color: COLORS.TERTIARY,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.7,
  },
  loadingText: {
    color: COLORS.TERTIARY,
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default LoadingScreen;
