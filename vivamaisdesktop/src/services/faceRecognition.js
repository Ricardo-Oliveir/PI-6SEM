import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

export const loadModels = async () => {
    if (modelsLoaded) return;
    const MODEL_URL = '/models';
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        console.log("✅ Modelos de IA prontos para uso");
    } catch (error) {
        console.error("❌ Erro ao carregar modelos:", error);
    }
};

export const isModelsLoaded = () => modelsLoaded;

export const getFaceDescriptor = async (imageElement) => {
    if (!modelsLoaded) {
        await loadModels();
    }
    const detection = await faceapi
        .detectSingleFace(imageElement)
        .withFaceLandmarks()
        .withFaceDescriptor();
    
    return detection ? Array.from(detection.descriptor) : null;
};