// models/User.js (Updated with new associations)
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
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
            allowNull: false
        },
        avatar_url: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        provider: {
            type: DataTypes.STRING(50),
            allowNull: true
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
            allowNull: true
        },
        is_profile_public: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        account_status: {
            type: DataTypes.ENUM('active', 'deactivated', 'deleted'),
            defaultValue: 'active',
            allowNull: false
        },
        deactivated_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'Users',
        defaultScope: {
            attributes: { exclude: ['password'] }
        },
        scopes: {
            withPassword: {
                attributes: { include: ['password'] }
            }
        }
    });

    // Associations
    User.associate = function (models) {
        // Existing associations
        User.hasMany(models.Session, {
            foreignKey: 'user_id',
            as: 'sessions'
        });
        User.hasMany(models.TokenBlacklist, {
            foreignKey: 'user_id',
            as: 'blacklistedTokens'
        });

        // New associations
        User.hasOne(models.UserProfile, {
            foreignKey: 'user_id',
            as: 'profile'
        });
        User.hasMany(models.UserGuardian, {
            foreignKey: 'user_id',
            as: 'guardians'
        });
        User.hasOne(models.UserPrivacySettings, {
            foreignKey: 'user_id',
            as: 'privacySettings'
        });
        User.hasOne(models.UserNotificationPreferences, {
            foreignKey: 'user_id',
            as: 'notificationPreferences'
        });
        User.hasMany(models.AccountDeletionRequest, {
            foreignKey: 'user_id',
            as: 'deletionRequests'
        });
    };

    // Instance methods
    User.prototype.toJSON = function () {
        const values = { ...this.get() };
        delete values.password;
        return values;
    };

    User.prototype.validatePassword = async function (password) {
        if (!this.password) return false;
        return await bcrypt.compare(password, this.password);
    };

    User.prototype.hasVerifiedEmail = function () {
        return !!this.email_verified_at;
    };

    User.prototype.isOAuthUser = function () {
        return !!this.provider;
    };

    User.prototype.getAvatarUrl = function () {
        if (this.avatar_url) return this.avatar_url;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name || 'User')}&background=random`;
    };

    User.prototype.tokenIssuedBeforePasswordChange = function (tokenIssuedAt) {
        if (!this.password_changed_at) return false;

        const passwordChangedTimestamp = Math.floor(this.password_changed_at.getTime() / 1000);
        return tokenIssuedAt < passwordChangedTimestamp;
    };

    User.prototype.isActive = function () {
        return this.account_status === 'active';
    };

    User.prototype.isDeactivated = function () {
        return this.account_status === 'deactivated';
    };

    User.prototype.isDeleted = function () {
        return this.account_status === 'deleted';
    };

    User.prototype.canReactivate = function () {
        if (!this.isDeactivated()) return false;
        if (!this.deactivated_at) return false;

        const deactivatedDate = new Date(this.deactivated_at);
        const now = new Date();
        const daysSinceDeactivation = Math.floor((now - deactivatedDate) / (1000 * 60 * 60 * 24));

        return daysSinceDeactivation <= 30;
    };

    // Hooks
    User.beforeCreate(async (user) => {
        if (user.password) {
            user.password = await bcrypt.hash(user.password, 12);
        }
    });

    User.beforeUpdate(async (user) => {
        if (user.changed('password') && user.password) {
            user.password = await bcrypt.hash(user.password, 12);
            user.password_changed_at = new Date();
        }
    });

    return User;
};