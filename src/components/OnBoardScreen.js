import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants';
import AdManager, { ADS_UNIT } from '../AdManager.js';
import { NativeAdComponent } from './NativeAdComponent';
import useTranslation from '../hooks/useTranslation';
import ChangeLanguageModal from './ChangeLanguageModal';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: '1',
    image: require('../../assets/onboard/1.png'),
    title: 'Trend the Moment',
    subtitle: 'Create viral effects in one scan.',
  },
  {
    key: '2',
    image: require('../../assets/onboard/2.png'),
    title: 'Warp Your Face',
    subtitle: 'Freeze lines. Shape your look.',
  },
  {
    key: '3',
    image: require('../../assets/onboard/3.png'),
    title: 'Share the Fun',
    subtitle: 'Save fast. Impress instantly.',
  },
];

const OnBoardScreen = ({ onNext }) => {
  const { t, languageManager } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [adShown, setAdShown] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    const checkFirstTimeUser = async () => {
      try {
        const isFirstTime = await languageManager.isFirstTimeUser();
        if (isFirstTime) {
          setTimeout(() => setShowLanguageModal(true), 1000);
        }
      } catch (error) {
        console.log('Error checking first time user:', error);
      }
    };

    const showAd = async () => {
      if (!adShown) {
        try {
          await AdManager.showAppOpenAd();
          setAdShown(true);
        } catch (error) {
          setAdShown(true);
        }
      }
    };

    checkFirstTimeUser();
    const timer = setTimeout(showAd, 500);
    return () => clearTimeout(timer);
  }, [adShown, languageManager]);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      onNext();
    }
  };

  const isLastSlide = activeIndex === SLIDES.length - 1;

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.imageContainer}>
        <Image source={item.image} style={styles.slideImage} resizeMode="cover" />
      </View>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Slides */}
      <View style={styles.slidesWrapper}>
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          bounces={false}
        />
      </View>

      {/* Pagination + Next */}
      <View style={styles.paginationRow}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
        <TouchableOpacity onPress={handleNext} style={styles.nextBtn}>
          <Text style={styles.nextText}>
            {isLastSlide ? t('getStarted', 'Get Started') : t('next', 'Next')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Native Ad */}
      <View style={styles.adContainer}>
        <NativeAdComponent adUnitId={ADS_UNIT.NATIVE_ONBOARDING} hasMedia={false} />
      </View>

      <ChangeLanguageModal
        visible={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  slidesWrapper: {
    flex: 1,
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  imageContainer: {
    width: width - 40,
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  slideSubtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 6,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#555',
    marginRight: 6,
  },
  dotActive: {
    backgroundColor: '#D4A94B',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nextBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  nextText: {
    color: '#D4A94B',
    fontWeight: '600',
    fontSize: 16,
  },
  adContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
});

export default OnBoardScreen;
