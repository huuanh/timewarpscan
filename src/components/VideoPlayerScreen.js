import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    ActivityIndicator,
    Platform,
} from 'react-native';
import Video from 'react-native-video';
import YoutubeIframe from 'react-native-youtube-iframe';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');
const PLAYER_HEIGHT = width * (9 / 16);

/**
 * Extracts YouTube video ID from various URL formats:
 *  - https://youtu.be/VIDEO_ID
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://www.youtube.com/embed/VIDEO_ID
 */
function extractYoutubeId(url) {
    const match = url.match(
        /(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/,
    );
    return match ? match[1] : null;
}

function isYoutubeUrl(url) {
    return url.includes('youtu.be') || url.includes('youtube.com');
}

/**
 * VideoPlayerScreen
 *
 * Route params:
 *   - videoUrl  {string}  YouTube URL or local file URI (required)
 *   - title     {string}  Title shown in the header (optional)
 *
 * Usage (via React Navigation):
 *   navigation.navigate('VideoPlayer', { videoUrl: '...', title: 'My Video' })
 */
const VideoPlayerScreen = ({ navigation, route }) => {
    const { videoUrl = '', title = '' } = route?.params ?? {};

    const [videoReady, setVideoReady] = useState(false);
    const [videoError, setVideoError] = useState(null);
    const videoRef = useRef(null);

    const youtube = isYoutubeUrl(videoUrl);
    const youtubeId = youtube ? extractYoutubeId(videoUrl) : null;

    const handleBack = () => {
        if (navigation?.canGoBack()) {
            navigation.goBack();
        }
    };

    const renderPlayer = () => {
        if (youtube) {
            if (!youtubeId) {
                return (
                    <View style={styles.errorBox}>
                        <Icon name="error-outline" size={40} color="#e55" />
                        <Text style={styles.errorText}>Invalid YouTube URL</Text>
                    </View>
                );
            }
            return (
                <View style={styles.playerWrapper}>
                    {!videoReady && (
                        <View style={styles.loaderOverlay}>
                            <ActivityIndicator size="large" color="#D4A94B" />
                        </View>
                    )}
                    <YoutubeIframe
                        videoId={youtubeId}
                        width={width}
                        height={PLAYER_HEIGHT}
                        play={true}
                        onReady={() => setVideoReady(true)}
                        onError={(e) => setVideoError(String(e))}
                        webViewProps={{
                            androidLayerType: Platform.OS === 'android' ? 'hardware' : undefined,
                        }}
                    />
                </View>
            );
        }

        // Local / remote MP4
        return (
            <View style={styles.playerWrapper}>
                {!videoReady && (
                    <View style={styles.loaderOverlay}>
                        <ActivityIndicator size="large" color="#D4A94B" />
                    </View>
                )}
                {videoError ? (
                    <View style={styles.errorBox}>
                        <Icon name="error-outline" size={40} color="#e55" />
                        <Text style={styles.errorText}>{videoError}</Text>
                    </View>
                ) : (
                    <Video
                        ref={videoRef}
                        source={{ uri: videoUrl }}
                        style={styles.videoPlayer}
                        controls={true}
                        resizeMode="contain"
                        paused={false}
                        onReadyForDisplay={() => setVideoReady(true)}
                        onError={(e) => {
                            setVideoError(e?.error?.localizedDescription ?? 'Playback error');
                        }}
                    />
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                    <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                {!!title && (
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                )}
            </View>

            {/* Player */}
            {renderPlayer()}

            {/* Bottom spacer / future info area */}
            <View style={styles.infoArea} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#000',
    },
    backBtn: {
        padding: 4,
        marginRight: 8,
    },
    headerTitle: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    playerWrapper: {
        width,
        height: PLAYER_HEIGHT,
        backgroundColor: '#000',
    },
    videoPlayer: {
        width: '100%',
        height: '100%',
    },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        zIndex: 10,
    },
    errorBox: {
        width: '100%',
        height: PLAYER_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    errorText: {
        color: '#e55',
        marginTop: 8,
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    infoArea: {
        flex: 1,
        backgroundColor: '#111',
    },
});

export default VideoPlayerScreen;
