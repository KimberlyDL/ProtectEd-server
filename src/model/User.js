// models/User.js
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: {
                    msg: 'Please provide a valid email address'
                }
            }
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: true // Nullable for OAuth users
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        role: {
            type: DataTypes.STRING(50),
            defaultValue: 'player',
            allowNull: false,
            validate: {
                isIn: {
                    args: [['player', 'admin', 'moderator', 'educator']],
                    msg: 'Invalid role'
                }
            }
        },
        // === NEW: Store FILE KEY instead of full URL ===
        avatar_key: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'R2 file key (e.g., avatars/123/file.jpg) - NOT full URL'
        },
        // === DEPRECATED: Keep for migration, but prefer avatar_key ===
        avatar_url: {
            type: DataTypes.STRING(500),
            allowNull: true,
            comment: 'DEPRECATED: Use avatar_key instead. Kept for backward compatibility.'
        },
        provider: {
            type: DataTypes.STRING(50),
            allowNull: true,
            validate: {
                isIn: {
                    args: [['local', 'google', 'facebook', null]],
                    msg: 'Invalid provider'
                }
            }
        },
        provider_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true
        },
        email_verified_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        password_changed_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Track password changes to invalidate old tokens'
        },
        is_profile_public: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
            comment: 'Whether profile is visible to other users'
        },
        account_status: {
            type: DataTypes.ENUM('active', 'deactivated', 'pending_deletion', 'deleted'),
            defaultValue: 'active',
            allowNull: false
        },
        last_login_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'Users',
        indexes: [
            { fields: ['email'] },
            { fields: ['provider_id'] },
            { fields: ['account_status'] }
        ]
    });

    // ==================== ASSOCIATIONS ====================
    User.associate = function (models) {
        // Sessions
        User.hasMany(models.Session, {
            foreignKey: 'user_id',
            as: 'sessions',
            onDelete: 'CASCADE'
        });

        // Token Blacklist
        User.hasMany(models.TokenBlacklist, {
            foreignKey: 'user_id',
            as: 'blacklistedTokens',
            onDelete: 'CASCADE'
        });

        // Profile (One-to-One)
        User.hasOne(models.UserProfile, {
            foreignKey: 'user_id',
            as: 'profile',
            onDelete: 'CASCADE'
        });

        // Guardians (One-to-Many)
        User.hasMany(models.UserGuardian, {
            foreignKey: 'user_id',
            as: 'guardians',
            onDelete: 'CASCADE'
        });

        // Privacy Settings (One-to-One)
        User.hasOne(models.UserPrivacySettings, {
            foreignKey: 'user_id',
            as: 'privacySettings',
            onDelete: 'CASCADE'
        });

        // Notification Preferences (One-to-One)
        User.hasOne(models.UserNotificationPreferences, {
            foreignKey: 'user_id',
            as: 'notificationPreferences',
            onDelete: 'CASCADE'
        });

        // Account Deletion Request (One-to-One)
        User.hasOne(models.AccountDeletionRequest, {
            foreignKey: 'user_id',
            as: 'deletionRequest',
            onDelete: 'CASCADE'
        });
    };

    // ==================== INSTANCE METHODS ====================

    /**
     * Get Avatar URL - Constructs URL from key or returns default
     * 
     * CRITICAL METHOD: This ensures URLs are ALWAYS current even if
     * your Cloudflare Worker domain changes
     */
    User.prototype.getAvatarUrl = function () {
        // Priority 1: Use avatar_key (RECOMMENDED)
        if (this.avatar_key) {
            const fileStorageService = require('../services/FileStorageService');
            return fileStorageService.constructUrl(this.avatar_key);
        }

        // Priority 2: Use deprecated avatar_url (for backward compatibility)
        if (this.avatar_url) {
            // Check if it's an old R2 URL that needs migration
            const oldR2Domain = process.env.OLD_R2_PUBLIC_URL;
            if (oldR2Domain && this.avatar_url.includes(oldR2Domain)) {
                // Extract key from old URL and construct new URL
                const key = this.avatar_url.replace(`${oldR2Domain}/`, '');
                const fileStorageService = require('../services/FileStorageService');
                return fileStorageService.constructUrl(key);
            }

            // Otherwise return as-is
            return this.avatar_url;
        }

        // Priority 3: Return default avatar
        const fileStorageService = require('../services/FileStorageService');
        return fileStorageService.getDefaultAvatar(this.name || this.email);
    };

    /**
     * Check if user is authenticated via OAuth
     */
    User.prototype.isOAuthUser = function () {
        return this.provider && this.provider !== 'local';
    };

    /**
     * Check if user is admin
     */
    User.prototype.isAdmin = function () {
        return this.role === 'admin';
    };

    /**
     * Check if user is educator
     */
    User.prototype.isEducator = function () {
        return this.role === 'educator' || this.role === 'admin';
    };

    /**
     * Check if account is active
     */
    User.prototype.isActive = function () {
        return this.account_status === 'active';
    };

    /**
     * Check if password can be changed (not OAuth user)
     */
    User.prototype.canChangePassword = function () {
        return !this.isOAuthUser();
    };

    /**
     * Update last login timestamp
     */
    User.prototype.updateLastLogin = async function () {
        this.last_login_at = new Date();
        await this.save({ fields: ['last_login_at'] });
    };

    /**
     * Safe JSON representation (exclude sensitive fields)
     */
    User.prototype.toSafeJSON = function () {
        return {
            id: this.id,
            email: this.email,
            name: this.name,
            role: this.role,
            avatar_url: this.getAvatarUrl(),
            is_profile_public: this.is_profile_public,
            account_status: this.account_status,
            provider: this.provider,
            email_verified: !!this.email_verified_at,
            created_at: this.created_at
        };
    };

    /**
     * Public JSON (for other users viewing this profile)
     */
    User.prototype.toPublicJSON = function () {
        return {
            id: this.id,
            name: this.name,
            avatar_url: this.getAvatarUrl(),
            is_profile_public: this.is_profile_public
        };
    };

    // ==================== CLASS METHODS ====================

    /**
     * Find user by email
     */
    User.findByEmail = async function (email) {
        return await this.findOne({ where: { email: email.toLowerCase() } });
    };

    /**
     * Find active users only
     */
    User.findActive = async function (options = {}) {
        return await this.findAll({
            where: { account_status: 'active' },
            ...options
        });
    };

    /**
     * Find users by role
     */
    User.findByRole = async function (role, options = {}) {
        return await this.findAll({
            where: {
                role: role,
                account_status: 'active'
            },
            ...options
        });
    };

    // ==================== HOOKS ====================

    /**
     * Before save: lowercase email
     */
    User.beforeSave(async (user) => {
        if (user.changed('email')) {
            user.email = user.email.toLowerCase().trim();
        }
    });

    /**
     * Before destroy: cleanup associated files
     */
    User.beforeDestroy(async (user, options) => {
        // Delete avatar from R2
        if (user.avatar_key) {
            try {
                const fileStorageService = require('../services/FileStorageService');
                await fileStorageService.deleteFile(user.avatar_key);
                console.log(`Deleted avatar for user ${user.id}: ${user.avatar_key}`);
            } catch (error) {
                console.error(`Failed to delete avatar for user ${user.id}:`, error);
                // Continue anyway - don't block user deletion
            }
        }

        // Delete all files uploaded by this user
        try {
            const { File } = require('./index');
            const userFiles = await File.findAll({
                where: { uploaded_by: user.id },
                transaction: options.transaction
            });

            if (userFiles.length > 0) {
                const fileStorageService = require('../services/FileStorageService');
                const deletePromises = userFiles.map(file =>
                    fileStorageService.deleteFile(file.file_key).catch(err => {
                        console.error(`Failed to delete file ${file.file_key}:`, err);
                    })
                );
                await Promise.all(deletePromises);
                console.log(`Deleted ${userFiles.length} files for user ${user.id}`);
            }
        } catch (error) {
            console.error(`Error during user file cleanup for user ${user.id}:`, error);
        }
    });

    return User;
};