// services/AvatarService.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const crypto = require('crypto');

class AvatarService {
    constructor() {
        // Initialize Cloudflare R2 client
        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT, // e.g., https://<account-id>.r2.cloudflarestorage.com
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
            }
        });

        this.bucketName = process.env.R2_BUCKET_NAME;
        this.publicUrl = process.env.R2_PUBLIC_URL; // e.g., https://avatars.yourdomain.com
    }

    /**
     * Upload avatar to Cloudflare R2
     * @param {Buffer} fileBuffer - The uploaded file buffer
     * @param {number} userId - User ID for folder organization
     * @returns {Promise<string>} - Public URL of uploaded avatar
     */
    async uploadAvatar(fileBuffer, userId) {
        try {
            // Process image: resize, optimize, and convert to JPEG
            const processedImage = await sharp(fileBuffer)
                .resize(400, 400, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({
                    quality: 85,
                    progressive: true
                })
                .toBuffer();

            // Generate unique filename
            const hash = crypto.randomBytes(16).toString('hex');
            const timestamp = Date.now();
            const filename = `avatars/${userId}/${timestamp}-${hash}.jpg`;

            // Upload to R2
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: filename,
                Body: processedImage,
                ContentType: 'image/jpeg',
                CacheControl: 'public, max-age=31536000', // 1 year cache
                Metadata: {
                    userId: userId.toString(),
                    uploadedAt: new Date().toISOString()
                }
            });

            await this.r2Client.send(command);

            // Return public URL
            const publicUrl = `${this.publicUrl}/${filename}`;
            return publicUrl;

        } catch (error) {
            console.error('Avatar upload error:', error);
            throw new Error('Failed to upload avatar');
        }
    }

    /**
     * Delete avatar from Cloudflare R2
     * @param {string} avatarUrl - The public URL of the avatar to delete
     * @returns {Promise<boolean>} - Success status
     */
    async deleteAvatar(avatarUrl) {
        try {
            if (!avatarUrl || !avatarUrl.includes(this.publicUrl)) {
                // Not a valid R2 URL, skip deletion
                return false;
            }

            // Extract the key (filename) from the URL
            const key = avatarUrl.replace(`${this.publicUrl}/`, '');

            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });

            await this.r2Client.send(command);
            return true;

        } catch (error) {
            console.error('Avatar deletion error:', error);
            // Don't throw error on deletion failure
            return false;
        }
    }

    /**
     * Validate image file
     * @param {Object} file - Multer file object
     * @returns {Object} - Validation result
     */
    validateImage(file) {
        const errors = [];

        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            errors.push('File size exceeds 5MB limit');
        }

        // Check file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.mimetype)) {
            errors.push('Invalid file type. Only JPEG and PNG are allowed');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get default avatar URL
     * @param {string} name - User's name
     * @returns {string} - Default avatar URL
     */
    getDefaultAvatar(name = 'User') {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=400`;
    }
}

module.exports = new AvatarService();