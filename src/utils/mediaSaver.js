import { Platform, PermissionsAndroid } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

async function ensureStoragePermission() {
    if (Platform.OS === 'android' && Platform.Version < 33) {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
}

export async function savePhoto(filePath) {
    await ensureStoragePermission();
    const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    return CameraRoll.saveAsset(uri, { type: 'photo' });
}

export async function saveVideo(filePath) {
    await ensureStoragePermission();
    const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    return CameraRoll.saveAsset(uri, { type: 'video' });
}
