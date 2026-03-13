import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Platform,
    PermissionsAndroid,
    FlatList,
    Dimensions,
} from 'react-native';
import useTranslation from '../hooks/useTranslation';
import IAPModal from './IAPModal';
import messaging from '@react-native-firebase/messaging';
import DEFAULT_HOME_VIDEOS from '../config/HomeVideosConfig';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');
const THUMB_WIDTH = (width - 52) / 3;
const THUMB_HEIGHT = THUMB_WIDTH * 1.4;

const VideoThumbnailItem = ({ item, onPress }) => (
    <TouchableOpacity style={thumbStyles.container} onPress={onPress} activeOpacity={0.8}>
        <Image source={{ uri: item.thumbnail }} style={thumbStyles.image} />
        <View style={thumbStyles.playOverlay}>
            <Icon name="play-circle-outline" size={32} color="#fff" />
        </View>
    </TouchableOpacity>
);

const thumbStyles = StyleSheet.create({
    container: {
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        borderRadius: 10,
        overflow: 'hidden',
        marginRight: 8,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
});

const HomeScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('home');
    const [showIAPModal, setShowIAPModal] = useState(false);
    const [videosConfig, setVideosConfig] = useState(DEFAULT_HOME_VIDEOS);

    const handleShowIAP = () => setShowIAPModal(true);

    const handleVideoPress = (videoUrl, title) => {
        navigation.navigate('VideoPlayer', { videoUrl, title });
    };

    async function requestPermission() {
        try {
            if (Platform.OS === 'android' && Platform.Version >= 33) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                );
                if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                    return false;
                }
            }
            const authStatus = await messaging().requestPermission();
            const enabled =
                authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                authStatus === messaging.AuthorizationStatus.PROVISIONAL;
            if (enabled) {
                const token = await messaging().getToken();
                console.log('FCM token:', token);
            }
            return enabled;
        } catch (error) {
            console.error('Permission error:', error);
            return false;
        }
    }

    useEffect(() => {
        const timer = setTimeout(() => requestPermission(), 500);
        return () => clearTimeout(timer);
    }, []);

    const renderCategory = ({ item: category }) => (
        <View style={styles.categorySection}>
            <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>
                    {category.title} {category.emoji}
                </Text>
                <TouchableOpacity>
                    <Text style={styles.viewAll}>View All {'>'}</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={category.videos}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(v) => v.id}
                renderItem={({ item }) => (
                    <VideoThumbnailItem
                        item={item}
                        onPress={() => handleVideoPress(item.videoUrl, item.title ?? category.title)}
                    />
                )}
                contentContainerStyle={styles.videoRow}
            />
        </View>
    );

    const renderHomeTab = () => (
        <FlatList
            data={videosConfig.categories}
            renderItem={renderCategory}
            keyExtractor={(cat) => cat.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.homeContent}
        />
    );

    const renderCollectionTab = () => (
        <View style={styles.emptyTab}>
            <Icon name="collections" size={48} color="#555" />
            <Text style={styles.emptyTabText}>{t('collectionEmpty', 'Your collection is empty')}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerIconBtn}>
                    <Image source={require('../../assets/home/setting.png')} style={styles.headerIcon} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Time Warp Scan</Text>
                <TouchableOpacity style={styles.headerIconBtn} onPress={handleShowIAP}>
                    <Image source={require('../../assets/home/vip.png')} style={styles.headerIcon} />
                </TouchableOpacity>
            </View>

            {/* Tab Content */}
            <View style={styles.content}>
                {activeTab === 'home' ? renderHomeTab() : renderCollectionTab()}
            </View>

            {/* Bottom Tab Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.bottomTab}
                    onPress={() => setActiveTab('home')}
                >
                    <Image
                        source={require('../../assets/home/home.png')}
                        style={[styles.bottomTabIcon, activeTab === 'home' && styles.bottomTabIconActive]}
                    />
                    <Text style={[styles.bottomTabText, activeTab === 'home' && styles.bottomTabTextActive]}>
                        Home
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cameraBtn}>
                    <Image source={require('../../assets/home/camera.png')} style={styles.cameraBtnIcon} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.bottomTab}
                    onPress={() => setActiveTab('collection')}
                >
                    <Image
                        source={require('../../assets/home/collection.png')}
                        style={[styles.bottomTabIcon, activeTab === 'collection' && styles.bottomTabIconActive]}
                    />
                    <Text style={[styles.bottomTabText, activeTab === 'collection' && styles.bottomTabTextActive]}>
                        Collection
                    </Text>
                </TouchableOpacity>
            </View>

            <IAPModal visible={showIAPModal} onClose={() => setShowIAPModal(false)} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        // backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerIcon: {
        width: 30,
        height: 30,
        resizeMode: 'contain',
    },
    content: {
        flex: 1,
    },
    homeContent: {
        paddingBottom: 16,
    },
    categorySection: {
        marginTop: 16,
        paddingHorizontal: 16,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    categoryTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
    },
    viewAll: {
        fontSize: 13,
        color: '#aaa',
    },
    videoRow: {
        paddingRight: 8,
    },
    emptyTab: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTabText: {
        color: '#777',
        marginTop: 12,
        fontSize: 15,
    },
    bottomBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 6,
        paddingBottom: 12,
        backgroundColor: '#111',
        borderTopWidth: 1,
        borderTopColor: '#222',
    },
    bottomTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
    },
    bottomTabIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        tintColor: '#666',
        marginBottom: 2,
    },
    bottomTabIconActive: {
        tintColor: '#fff',
    },
    bottomTabText: {
        fontSize: 11,
        color: '#666',
    },
    bottomTabTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    cameraBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -20,
    },
    cameraBtnIcon: {
        width: 56,
        height: 56,
        resizeMode: 'contain',
    },
});

export default HomeScreen;