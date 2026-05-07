module.exports = {
    getCloudinaryConfig: () => ({
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    })
};