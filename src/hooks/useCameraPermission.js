import { useCallback, useEffect, useState } from 'react';
import { Camera } from 'react-native-vision-camera';

const useCameraPermission = () => {
    const [cameraPermission, setCameraPermission] = useState('not-determined');
    const [micPermission, setMicPermission] = useState('not-determined');

    useEffect(() => {
        setCameraPermission(Camera.getCameraPermissionStatus());
        setMicPermission(Camera.getMicrophonePermissionStatus());
    }, []);

    const requestPermissions = useCallback(async () => {
        const camStatus = await Camera.requestCameraPermission();
        setCameraPermission(camStatus);

        const micStatus = await Camera.requestMicrophonePermission();
        setMicPermission(micStatus);

        return { camera: camStatus, microphone: micStatus };
    }, []);

    return {
        cameraPermission,
        micPermission,
        hasAllPermissions: cameraPermission === 'granted' && micPermission === 'granted',
        requestPermissions,
    };
};

export default useCameraPermission;
