// services/FileStorageService.js
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');

/**
 * Comprehensive File Storage Service for Cloudflare R2
 * 
 * ARCHITECTURE DECISIONS:
 * 1. Store FILE KEYS in database, not full URLs
 * 2. Construct URLs dynamically using Cloudflare Worker endpoint
 * 3. Support both direct R2 access and Worker-based transformations
 * 
 * File Organization Structure:
 * /avatars/{userId}/{timestamp}-{hash}.jpg
 * /announcements/{announcementId}/{timestamp}-{hash}.{ext}
 * /modules/{moduleId}/{type}/{timestamp}-{hash}.{ext}
 * /badges/{badgeId}/{timestamp}-{hash}.png
 * /uploads/{userId}/{category}/{timestamp}-{hash}.{ext}
 */
class FileStorageService {
    constructor() {
        // ====== CONFIGURATION ======
        this.config = {
            // R2 Connection
            r2Endpoint: process.env.R2_ENDPOINT, // https://<account-id>.r2.cloudflarestorage.com
            bucketName: process.env.R2_BUCKET_NAME,
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,

            // Public URLs
            // Option 1: Direct R2 public bucket (if enabled)
            // Option 2: Cloudflare Worker URL (recommended for auth/transforms)
            publicUrl: process.env.R2_PUBLIC_URL || process.env.WORKER_URL, // e.g., https://files.protectED.com

            // File type whitelists
            allowedTypes: {
                images: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
                documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                spreadsheets: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                presentations: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
                videos: ['video/mp4', 'video/webm', 'video/quicktime'],
                audio: ['audio/mpeg', 'audio/wav', 'audio/ogg']
            },

            // Size limits (bytes)
            sizeLimits: {
                avatar: 5 * 1024 * 1024,        // 5MB
                image: 10 * 1024 * 1024,        // 10MB
                document: 25 * 1024 * 1024,     // 25MB
                video: 100 * 1024 * 1024,       // 100MB
                default: 50 * 1024 * 1024       // 50MB
            },

            // Image optimization settings
            imageOptimization: {
                avatar: {
                    width: 400,
                    height: 400,
                    quality: 85,
                    format: 'jpeg'
                },
                thumbnail: {
                    width: 800,
                    height: 600,
                    quality: 90,
                    format: 'jpeg'
                },
                content: {
                    maxWidth: 1920,
                    quality: 90,
                    preserveFormat: true
                },
                badge: {
                    width: 400,
                    height: 400,
                    quality: 90,
                    format: 'png',
                    preserveTransparency: true
                }
            },

            // Cache settings
            cacheControl: {
                immutable: 'public, max-age=31536000, immutable', // 1 year for hashed files
                avatar: 'public, max-age=86400',  // 24 hours for avatars (may change)
                default: 'public, max-age=3600'   // 1 hour default
            },

            // Security
            allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp4', 'webm', 'mp3', 'wav'],
            blockedExtensions: ['exe', 'bat', 'cmd', 'sh', 'php', 'asp', 'aspx', 'jsp', 'js', 'html', 'htm']
        };

        // Validate required config
        this._validateConfig();

        // Initialize Cloudflare R2 client
        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: this.config.r2Endpoint,
            credentials: {
                accessKeyId: this.config.accessKeyId,
                secretAccessKey: this.config.secretAccessKey
            }
        });
    }

    /**
     * Validate configuration on startup
     * @private
     */
    _validateConfig() {
        const required = ['r2Endpoint', 'bucketName', 'accessKeyId', 'secretAccessKey', 'publicUrl'];
        const missing = required.filter(key => !this.config[key]);

        if (missing.length > 0) {
            throw new Error(`Missing required R2 configuration: ${missing.join(', ')}`);
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Upload Avatar Image
     * @param {Buffer} fileBuffer - File buffer
     * @param {number} userId - User ID
     * @param {string|null} oldAvatarKey - Previous avatar KEY (not URL) to delete
     * @returns {Promise<Object>} - Upload result with KEY and URL
     */
    async uploadAvatar(fileBuffer, userId, oldAvatarKey = null) {
        try {
            // 1. Delete old avatar if provided
            if (oldAvatarKey) {
                await this.deleteFile(oldAvatarKey).catch(err => {
                    console.warn(`Failed to delete old avatar: ${oldAvatarKey}`, err);
                    // Don't fail upload if delete fails
                });
            }

            // 2. Validate and optimize image
            const processedImage = await this._processAvatar(fileBuffer);

            // 3. Generate unique key
            const key = this._generateKey('avatars', userId, 'jpg');

            // 4. Upload to R2
            await this._uploadToR2(
                processedImage,
                key,
                'image/jpeg',
                this.config.cacheControl.avatar
            );

            // 5. Return BOTH key and URL
            return {
                key: key,                              // Store THIS in database
                url: this._constructUrl(key),          // Use THIS for display
                size: processedImage.length,
                uploadedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Avatar upload error:', error);
            throw new Error(`Failed to upload avatar: ${error.message}`);
        }
    }

    /**
     * Upload Announcement File (images, PDFs, docs)
     */
    async uploadAnnouncementFile(fileBuffer, announcementId, mimetype, originalFilename, options = {}) {
        try {
            // Validate file
            const validation = this.validateFile({ buffer: fileBuffer, mimetype, originalFilename }, 'document');
            if (!validation.valid) {
                throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
            }

            const ext = this._extractExtension(originalFilename, mimetype);
            let processedBuffer = fileBuffer;

            // Optimize images
            if (this._isImage(mimetype)) {
                processedBuffer = await this._processContentImage(fileBuffer);
            }

            const key = this._generateKey(`announcements/${announcementId}`, null, ext);

            await this._uploadToR2(
                processedBuffer,
                key,
                mimetype,
                this.config.cacheControl.immutable,
                {
                    announcementId: String(announcementId),
                    originalFilename: originalFilename,
                    uploadedBy: options.uploadedBy ? String(options.uploadedBy) : undefined
                }
            );

            return {
                key: key,
                url: this._constructUrl(key),
                size: processedBuffer.length,
                contentType: mimetype,
                originalFilename: originalFilename,
                uploadedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Announcement file upload error:', error);
            throw error;
        }
    }

    /**
     * Upload Learning Module File
     */
    async uploadModuleFile(fileBuffer, moduleId, fileType, mimetype, originalFilename, options = {}) {
        try {
            // Validate file type based on purpose
            const allowedCategories = fileType === 'thumbnail' ? ['images'] : ['images', 'documents', 'videos'];
            this._validateFileType(mimetype, allowedCategories);

            const ext = this._extractExtension(originalFilename, mimetype);
            let processedBuffer = fileBuffer;

            // Process based on type
            if (this._isImage(mimetype)) {
                if (fileType === 'thumbnail') {
                    processedBuffer = await this._processThumbnail(fileBuffer);
                } else {
                    processedBuffer = await this._processContentImage(fileBuffer);
                }
            }

            const key = this._generateKey(`modules/${moduleId}/${fileType}`, null, ext);

            await this._uploadToR2(
                processedBuffer,
                key,
                mimetype,
                this.config.cacheControl.immutable,
                {
                    moduleId: String(moduleId),
                    fileType: fileType,
                    originalFilename: originalFilename
                }
            );

            return {
                key: key,
                url: this._constructUrl(key),
                size: processedBuffer.length,
                contentType: mimetype,
                uploadedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Module file upload error:', error);
            throw error;
        }
    }

    /**
     * Upload Badge/Achievement Image
     */
    async uploadBadgeImage(fileBuffer, badgeId, options = {}) {
        try {
            const processedImage = await this._processBadge(fileBuffer);
            const key = this._generateKey(`badges/${badgeId}`, null, 'png');

            await this._uploadToR2(
                processedImage,
                key,
                'image/png',
                this.config.cacheControl.immutable,
                {
                    badgeId: String(badgeId),
                    type: 'badge'
                }
            );

            return {
                key: key,
                url: this._constructUrl(key),
                size: processedImage.length,
                uploadedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Badge upload error:', error);
            throw new Error(`Failed to upload badge: ${error.message}`);
        }
    }

    /**
     * Delete File by KEY (not URL)
     * @param {string} keyOrUrl - File key OR full URL (will extract key)
     */
    async deleteFile(keyOrUrl) {
        try {
            // Extract key if URL provided
            const key = this._extractKeyFromUrlOrKey(keyOrUrl);

            if (!key) {
                throw new Error('Invalid file key or URL');
            }

            const command = new DeleteObjectCommand({
                Bucket: this.config.bucketName,
                Key: key
            });

            await this.r2Client.send(command);

            console.log(`Deleted file: ${key}`);
            return { deleted: true, key };

        } catch (error) {
            // Don't throw on 404 - file already deleted
            if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
                console.warn(`File not found (already deleted?): ${keyOrUrl}`);
                return { deleted: false, reason: 'not_found' };
            }

            console.error('Delete file error:', error);
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }

    /**
     * Delete Multiple Files
     */
    async deleteMultipleFiles(keysOrUrls) {
        const results = await Promise.allSettled(
            keysOrUrls.map(keyOrUrl => this.deleteFile(keyOrUrl))
        );

        return {
            successful: results.filter(r => r.status === 'fulfilled').length,
            failed: results.filter(r => r.status === 'rejected').length,
            details: results
        };
    }

    /**
     * List Files by Prefix
     */
    async listFiles(prefix, maxKeys = 1000) {
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.config.bucketName,
                Prefix: prefix,
                MaxKeys: maxKeys
            });

            const response = await this.r2Client.send(command);

            return (response.Contents || []).map(item => ({
                key: item.Key,
                url: this._constructUrl(item.Key),
                size: item.Size,
                lastModified: item.LastModified,
                etag: item.ETag
            }));

        } catch (error) {
            console.error('List files error:', error);
            throw new Error('Failed to list files');
        }
    }

    /**
     * Get File Metadata
     */
    async getFileMetadata(keyOrUrl) {
        try {
            const key = this._extractKeyFromUrlOrKey(keyOrUrl);

            const command = new GetObjectCommand({
                Bucket: this.config.bucketName,
                Key: key
            });

            const response = await this.r2Client.send(command);

            return {
                key,
                url: this._constructUrl(key),
                contentType: response.ContentType,
                contentLength: response.ContentLength,
                lastModified: response.LastModified,
                metadata: response.Metadata,
                etag: response.ETag,
                cacheControl: response.CacheControl
            };

        } catch (error) {
            console.error('Get metadata error:', error);
            throw new Error('Failed to get file metadata');
        }
    }

    /**
     * Comprehensive File Validation
     * @param {Object} file - File object with buffer, mimetype, originalFilename
     * @param {string} type - File type category ('avatar', 'image', 'document', etc.)
     * @returns {Object} - Validation result
     */
    validateFile(file, type = 'default') {
        const errors = [];

        // 1. Check if file exists
        if (!file || !file.buffer) {
            errors.push('No file provided');
            return { valid: false, errors };
        }

        // 2. Check file size
        const sizeLimit = this.config.sizeLimits[type] || this.config.sizeLimits.default;
        const fileSize = file.size || file.buffer.length;

        if (fileSize > sizeLimit) {
            errors.push(`File size (${this._formatBytes(fileSize)}) exceeds ${this._formatBytes(sizeLimit)} limit`);
        }

        if (fileSize === 0) {
            errors.push('File is empty');
        }

        // 3. Check MIME type
        if (!file.mimetype) {
            errors.push('File type cannot be determined');
        } else {
            const isValidType = Object.values(this.config.allowedTypes)
                .flat()
                .includes(file.mimetype);

            if (!isValidType) {
                errors.push(`File type "${file.mimetype}" is not allowed`);
            }
        }

        // 4. Check file extension
        if (file.originalFilename || file.originalname) {
            const filename = file.originalFilename || file.originalname;
            const ext = path.extname(filename).slice(1).toLowerCase();

            // Check for blocked extensions
            if (this.config.blockedExtensions.includes(ext)) {
                errors.push(`File extension ".${ext}" is not allowed for security reasons`);
            }

            // Check for double extensions (e.g., file.jpg.exe)
            const parts = filename.split('.');
            if (parts.length > 2) {
                const allExts = parts.slice(1).map(p => p.toLowerCase());
                const hasBlockedExt = allExts.some(e => this.config.blockedExtensions.includes(e));
                if (hasBlockedExt) {
                    errors.push('File contains suspicious double extension');
                }
            }

            // Check for path traversal
            if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                errors.push('Filename contains invalid characters');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Construct Public URL from Key
     * @param {string} key - File key in R2
     * @returns {string} - Public URL (via Worker or R2)
     */
    constructUrl(key) {
        return this._constructUrl(key);
    }

    /**
     * Extract Key from URL
     * @param {string} url - Full URL
     * @returns {string|null} - File key
     */
    extractKeyFromUrl(url) {
        return this._extractKeyFromUrlOrKey(url);
    }

    /**
     * Get Default Avatar URL
     */
    getDefaultAvatar(name = 'User', options = {}) {
        const {
            size = 400,
            background = 'random',
            color = 'ffffff',
            rounded = false,
            bold = true
        } = options;

        const params = new URLSearchParams({
            name: encodeURIComponent(name),
            background: background,
            color: color,
            size: size,
            rounded: rounded,
            bold: bold
        });

        return `https://ui-avatars.com/api/?${params.toString()}`;
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Upload to R2
     * @private
     */
    async _uploadToR2(buffer, key, contentType, cacheControl, metadata = {}) {
        try {
            const command = new PutObjectCommand({
                Bucket: this.config.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                CacheControl: cacheControl || this.config.cacheControl.default,
                Metadata: {
                    uploadedAt: new Date().toISOString(),
                    ...Object.entries(metadata)
                        .filter(([_, value]) => value !== undefined)
                        .reduce((acc, [key, value]) => {
                            acc[key] = String(value);
                            return acc;
                        }, {})
                }
            });

            await this.r2Client.send(command);

        } catch (error) {
            console.error('R2 upload error:', error);
            throw new Error(`Failed to upload to R2: ${error.message}`);
        }
    }

    /**
     * Generate Unique File Key
     * @private
     */
    _generateKey(basePath, identifier, extension) {
        const hash = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now();

        // Sanitize extension
        const safeExt = extension.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (identifier) {
            return `${basePath}/${timestamp}-${hash}.${safeExt}`;
        }

        return `${basePath}/${timestamp}-${hash}.${safeExt}`;
    }

    /**
     * Construct URL from Key
     * @private
     */
    _constructUrl(key) {
        // Ensure no double slashes
        const cleanKey = key.startsWith('/') ? key.slice(1) : key;
        const cleanBaseUrl = this.config.publicUrl.endsWith('/')
            ? this.config.publicUrl.slice(0, -1)
            : this.config.publicUrl;

        return `${cleanBaseUrl}/${cleanKey}`;
    }

    /**
     * Extract Key from URL or return Key if already a key
     * @private
     */
    _extractKeyFromUrlOrKey(urlOrKey) {
        if (!urlOrKey) return null;

        // If it's a URL, extract the key
        if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
            // Remove the public URL prefix
            const cleanBaseUrl = this.config.publicUrl.endsWith('/')
                ? this.config.publicUrl.slice(0, -1)
                : this.config.publicUrl;

            return urlOrKey.replace(`${cleanBaseUrl}/`, '');
        }

        // Otherwise, assume it's already a key
        return urlOrKey;
    }

    /**
     * Process Avatar Image
     * @private
     */
    async _processAvatar(buffer) {
        const opts = this.config.imageOptimization.avatar;

        try {
            const image = sharp(buffer);
            const metadata = await image.metadata();

            // Handle transparency
            let processedImage = image;
            if (metadata.hasAlpha) {
                processedImage = processedImage.flatten({ background: '#ffffff' });
            }

            return await processedImage
                .resize(opts.width, opts.height, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({
                    quality: opts.quality,
                    progressive: true,
                    mozjpeg: true
                })
                .toBuffer();

        } catch (error) {
            throw new Error(`Image processing failed: ${error.message}`);
        }
    }

    /**
     * Process Thumbnail Image
     * @private
     */
    async _processThumbnail(buffer) {
        const opts = this.config.imageOptimization.thumbnail;

        const image = sharp(buffer);
        const metadata = await image.metadata();

        if (metadata.hasAlpha) {
            image.flatten({ background: '#ffffff' });
        }

        return await image
            .resize(opts.width, opts.height, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({
                quality: opts.quality,
                progressive: true
            })
            .toBuffer();
    }

    /**
     * Process Content Image (larger, preserve quality)
     * @private
     */
    async _processContentImage(buffer) {
        const opts = this.config.imageOptimization.content;

        const image = sharp(buffer);
        const metadata = await image.metadata();

        // Only resize if larger than max
        if (metadata.width > opts.maxWidth) {
            image.resize(opts.maxWidth, null, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // Preserve format if PNG with transparency
        if (opts.preserveFormat && metadata.format === 'png' && metadata.hasAlpha) {
            return await image
                .png({ quality: opts.quality, compressionLevel: 9 })
                .toBuffer();
        }

        // Otherwise convert to JPEG
        return await image
            .jpeg({ quality: opts.quality, progressive: true })
            .toBuffer();
    }

    /**
     * Process Badge Image (preserve transparency)
     * @private
     */
    async _processBadge(buffer) {
        const opts = this.config.imageOptimization.badge;

        return await sharp(buffer)
            .resize(opts.width, opts.height, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png({
                quality: opts.quality,
                compressionLevel: 9
            })
            .toBuffer();
    }

    /**
     * Extract File Extension
     * @private
     */
    _extractExtension(filename, mimetype) {
        // Try to get from filename first
        let ext = path.extname(filename).slice(1).toLowerCase();

        // If no extension, derive from mimetype
        if (!ext) {
            ext = this._getExtFromMimetype(mimetype);
        }

        // Validate extension
        if (!this.config.allowedExtensions.includes(ext)) {
            throw new Error(`File extension "${ext}" is not allowed`);
        }

        return ext;
    }

    /**
     * Validate file type against allowed categories
     * @private
     */
    _validateFileType(mimetype, allowedCategories) {
        const allowed = allowedCategories
            .flatMap(category => this.config.allowedTypes[category] || []);

        if (!allowed.includes(mimetype)) {
            throw new Error(`File type ${mimetype} is not allowed. Allowed types: ${allowed.join(', ')}`);
        }
    }

    /**
     * Check if file is an image
     * @private
     */
    _isImage(mimetype) {
        return this.config.allowedTypes.images.includes(mimetype);
    }

    /**
     * Get file extension from mimetype
     * @private
     */
    _getExtFromMimetype(mimetype) {
        const map = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'video/mp4': 'mp4',
            'video/webm': 'webm'
        };
        return map[mimetype] || 'bin';
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

module.exports = new FileStorageService();