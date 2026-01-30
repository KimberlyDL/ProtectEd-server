// services/AvatarService.js (Refined Version)
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const crypto = require('crypto');

/**
 * Specialized Avatar Service for User Profile Pictures
 * 
 * Features:
 * - Image optimization and resizing
 * - Format standardization (JPEG)
 * - Automatic deletion of old avatars
 * - Default avatar generation
 * - Validation
 */
class AvatarService {
    constructor() {
        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
            }
        });
        this.bucketName = process.env.R2_BUCKET_NAME;
        this.publicUrl = process.env.R2_PUBLIC_URL;
    }

    /**
     * Upload avatar to Cloudflare R2
     * @param {Buffer} fileBuffer - The uploaded file buffer
     * @param {number} userId - User ID for folder organization
     * @param {string} oldAvatarUrl - Previous avatar URL (to delete)
     * @returns {Promise<Object>} - Upload result with public URL
     */
    async uploadAvatar(fileBuffer, userId, oldAvatarUrl = null) {
        try {
            if (oldAvatarUrl) await this.deleteAvatar(oldAvatarUrl);

            const processedImage = await sharp(fileBuffer)
                .resize(400, 400, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toBuffer();

            const key = `avatars/${userId}/${Date.now()}.jpg`;

            await this.r2Client.send(new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: processedImage,
                ContentType: 'image/jpeg'
            }));

            return { url: `${this.publicUrl}/${key}`, key: key };
        } catch (error) {
            console.error("Avatar Service Error:", error);
            throw error;
        }
    }

    async deleteAvatar(avatarUrl) {
        if (!avatarUrl || !avatarUrl.includes(this.publicUrl)) return;
        const key = avatarUrl.replace(`${this.publicUrl}/`, '');
        try {
            await this.r2Client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
        } catch (e) { console.error("Delete Error", e); }
    }

    /**
     * Validate avatar file
     * @param {Object} file - Multer file object
     * @returns {Object} - Validation result
     */
    validateAvatar(file) {
        const errors = [];

        // Check if file exists
        if (!file) {
            errors.push('No file provided');
            return { valid: false, errors };
        }

        // Check file size
        if (file.size > this.config.maxFileSize) {
            errors.push(`File size exceeds ${this._formatBytes(this.config.maxFileSize)} limit`);
        }

        // Check file type
        if (!this.config.allowedTypes.includes(file.mimetype)) {
            errors.push('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed');
        }

        // Additional validation: check for minimum dimensions
        // (This would require reading the image, so we'll skip for now)

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get default avatar URL using external service
     * @param {string} name - User's name
     * @param {Object} options - Additional options
     * @returns {string} - Default avatar URL
     */
    getDefaultAvatar(name = 'User', options = {}) {
        const {
            size = 400,
            background = 'random',  // or specific color like '0D8ABC'
            color = 'ffffff',       // text color
            rounded = false,
            bold = true
        } = options;

        const params = new URLSearchParams({
            name: name,
            background: background,
            color: color,
            size: size,
            rounded: rounded,
            bold: bold
        });

        return `https://ui-avatars.com/api/?${params.toString()}`;
    }

    /**
     * Get avatar URL or default
     * @param {string|null} avatarUrl - User's avatar URL
     * @param {string} userName - User's name for default avatar
     * @returns {string} - Avatar URL
     */
    getAvatarOrDefault(avatarUrl, userName) {
        return avatarUrl || this.getDefaultAvatar(userName);
    }

    // ==================== PRIVATE HELPER METHODS ====================

    /**
     * Process image: resize, optimize, convert to JPEG
     * @private
     */
    async _processImage(buffer) {
        try {
            const image = sharp(buffer);
            const metadata = await image.metadata();

            // For images with transparency (like PNGs with alpha channel),
            // add a white background before converting to JPEG
            let processedImage = image;

            if (metadata.hasAlpha) {
                processedImage = processedImage.flatten({ background: '#ffffff' });
            }

            // Resize and optimize
            const result = await processedImage
                .resize(this.config.size, this.config.size, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({
                    quality: this.config.quality,
                    progressive: true,
                    mozjpeg: true  // Use mozjpeg for better compression
                })
                .toBuffer();

            return result;

        } catch (error) {
            console.error('Image processing error:', error);
            throw new Error('Failed to process image');
        }
    }

    /**
     * Upload processed image to R2
     * @private
     */
    async _uploadToR2(buffer, filename, userId) {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: filename,
                Body: buffer,
                ContentType: 'image/jpeg',
                CacheControl: 'public, max-age=31536000, immutable', // 1 year cache
                Metadata: {
                    userId: userId.toString(),
                    uploadedAt: new Date().toISOString(),
                    type: 'avatar'
                }
            });

            await this.r2Client.send(command);

            // Construct and return public URL
            const publicUrl = `${this.publicUrl}/${filename}`;

            return {
                url: publicUrl,
                key: filename,
                size: buffer.length,
                uploadedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('R2 upload error:', error);
            throw new Error('Failed to upload to R2');
        }
    }

    /**
     * Generate unique filename
     * @private
     */
    _generateFilename(userId) {
        const hash = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now();
        return `avatars/${userId}/${timestamp}-${hash}.jpg`;
    }

    /**
     * Check if URL is from R2
     * @private
     */
    _isR2Url(url) {
        return url && url.includes(this.publicUrl);
    }

    /**
     * Extract key from R2 URL
     * @private
     */
    _extractKeyFromUrl(url) {
        return url.replace(`${this.publicUrl}/`, '');
    }

    /**
     * Format bytes to human readable
     * @private
     */
    _formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new AvatarService();