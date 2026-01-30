// models/File.js
module.exports = (sequelize, DataTypes) => {
    const File = sequelize.define('File', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        // === POLYMORPHIC ASSOCIATION ===
        entity_type: {
            type: DataTypes.ENUM('user', 'announcement', 'module', 'badge', 'submission'),
            allowNull: false,
            comment: 'Type of entity this file belongs to'
        },
        entity_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'ID of the entity this file belongs to'
        },

        // === FILE IDENTIFICATION ===
        file_category: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Category: avatar, thumbnail, resource, content, etc.'
        },

        // === STORAGE (CRITICAL) ===
        // Store ONLY the key, construct URLs dynamically
        file_key: {
            type: DataTypes.STRING(500),
            allowNull: false,
            unique: true,
            comment: 'R2 file key (e.g., avatars/123/file.jpg) - primary identifier'
        },

        // Deprecated: Keep for backward compatibility
        file_url: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'DEPRECATED: Full URL. Use file_key instead.'
        },

        // === METADATA ===
        original_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Original filename when uploaded'
        },
        mime_type: {
            type: DataTypes.STRING(100),
            allowNull: true,
            comment: 'MIME type (e.g., image/jpeg, application/pdf)'
        },
        file_size: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'File size in bytes'
        },
        file_hash: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: 'SHA-256 hash for duplicate detection'
        },

        // === OWNERSHIP & TRACKING ===
        uploaded_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: 'User ID who uploaded this file'
        },

        // === SOFT DELETE ===
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Soft delete timestamp'
        }
    }, {
        tableName: 'files',
        underscored: true,
        timestamps: true,
        paranoid: true, // Enables soft deletes
        indexes: [
            // Fast lookup by entity
            { fields: ['entity_type', 'entity_id'] },

            // Fast lookup by uploader
            { fields: ['uploaded_by'] },

            // Fast lookup by key (for existence checks)
            { unique: true, fields: ['file_key'] },

            // Fast lookup by hash (for duplicate detection)
            { fields: ['file_hash'] },

            // Cleanup queries
            { fields: ['created_at'] },
            { fields: ['deleted_at'] }
        ]
    });

    // ==================== ASSOCIATIONS ====================
    File.associate = function (models) {
        // Belongs to uploader
        File.belongsTo(models.User, {
            foreignKey: 'uploaded_by',
            as: 'uploader'
        });

        // NOTE: Polymorphic associations are handled in queries
        // Example:
        // if (file.entity_type === 'user') {
        //     const user = await User.findByPk(file.entity_id);
        // }
    };

    // ==================== INSTANCE METHODS ====================

    /**
     * Get public URL for this file
     */
    File.prototype.getUrl = function () {
        const fileStorageService = require('../services/FileStorageService');
        return fileStorageService.constructUrl(this.file_key);
    };

    /**
     * Check if file is an image
     */
    File.prototype.isImage = function () {
        const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        return this.mime_type && imageTypes.includes(this.mime_type);
    };

    /**
     * Check if file is a document
     */
    File.prototype.isDocument = function () {
        const docTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        return this.mime_type && docTypes.includes(this.mime_type);
    };

    /**
     * Check if file is a video
     */
    File.prototype.isVideo = function () {
        return this.mime_type && this.mime_type.startsWith('video/');
    };

    /**
     * Get formatted file size
     */
    File.prototype.getFormattedSize = function () {
        if (!this.file_size) return 'Unknown';

        const bytes = this.file_size;
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    /**
     * Safe JSON representation
     */
    File.prototype.toJSON = function () {
        const values = Object.assign({}, this.get());
        return {
            id: values.id,
            entity_type: values.entity_type,
            entity_id: values.entity_id,
            file_category: values.file_category,
            url: this.getUrl(), // Dynamically constructed
            original_name: values.original_name,
            mime_type: values.mime_type,
            file_size: values.file_size,
            formatted_size: this.getFormattedSize(),
            uploaded_by: values.uploaded_by,
            created_at: values.created_at,
            updated_at: values.updated_at
        };
    };

    // ==================== CLASS METHODS ====================

    /**
     * Find files by entity
     */
    File.findByEntity = async function (entityType, entityId, options = {}) {
        return await this.findAll({
            where: {
                entity_type: entityType,
                entity_id: entityId
            },
            order: [['created_at', 'DESC']],
            ...options
        });
    };

    /**
     * Find files by uploader
     */
    File.findByUploader = async function (userId, options = {}) {
        return await this.findAll({
            where: { uploaded_by: userId },
            order: [['created_at', 'DESC']],
            ...options
        });
    };

    /**
     * Find file by key
     */
    File.findByKey = async function (fileKey) {
        return await this.findOne({
            where: { file_key: fileKey }
        });
    };

    /**
     * Find duplicate by hash
     */
    File.findDuplicateByHash = async function (hash) {
        return await this.findOne({
            where: { file_hash: hash }
        });
    };

    /**
     * Get storage statistics
     */
    File.getStorageStats = async function (userId = null) {
        const where = userId ? { uploaded_by: userId } : {};

        const result = await this.findOne({
            where,
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_files'],
                [sequelize.fn('SUM', sequelize.col('file_size')), 'total_size'],
                [sequelize.fn('AVG', sequelize.col('file_size')), 'average_size']
            ],
            raw: true
        });

        return {
            total_files: parseInt(result.total_files) || 0,
            total_size: parseInt(result.total_size) || 0,
            average_size: parseInt(result.average_size) || 0,
            formatted_total: this._formatBytes(result.total_size || 0)
        };
    };

    /**
     * Find orphaned files (entity no longer exists)
     * Useful for cleanup jobs
     */
    File.findOrphaned = async function (entityType, limit = 100) {
        const models = require('./index');
        const files = await this.findAll({
            where: { entity_type: entityType },
            limit: limit
        });

        const orphaned = [];

        for (const file of files) {
            let exists = false;

            switch (entityType) {
                case 'user':
                    exists = await models.User.count({ where: { id: file.entity_id } }) > 0;
                    break;
                // Add other entity types as needed
                default:
                    continue;
            }

            if (!exists) {
                orphaned.push(file);
            }
        }

        return orphaned;
    };

    // ==================== HOOKS ====================

    /**
     * After destroy: cleanup file from R2
     */
    File.afterDestroy(async (file, options) => {
        if (file.file_key) {
            try {
                const fileStorageService = require('../services/FileStorageService');
                await fileStorageService.deleteFile(file.file_key);
                console.log(`Deleted file from R2: ${file.file_key}`);
            } catch (error) {
                console.error(`Failed to delete file from R2: ${file.file_key}`, error);
            }
        }
    });

    // ==================== PRIVATE HELPERS ====================

    File._formatBytes = function (bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return File;
};