function getCloudinaryConfig() {
    return {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    };
}
module.exports = { getCloudinaryConfig };