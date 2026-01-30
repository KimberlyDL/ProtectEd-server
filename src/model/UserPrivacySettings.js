// models/UserPrivacySettings.js
module.exports = (sequelize, DataTypes) => {
    const UserPrivacySettings = sequelize.define('UserPrivacySettings', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true
        },
        profile_visibility: {
            type: DataTypes.ENUM('public', 'private'),
            defaultValue: 'private',
            allowNull: false
        },
        show_achievements: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        show_progress: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        allow_messages: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'UserPrivacySettings'
    });

    // Associations
    UserPrivacySettings.associate = function (models) {
        UserPrivacySettings.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    // Static methods
    UserPrivacySettings.findOrCreateForUser = async function (userId) {
        const [settings] = await this.findOrCreate({
            where: { user_id: userId },
            defaults: {
                user_id: userId,
                profile_visibility: 'private',
                show_achievements: true,
                show_progress: false,
                allow_messages: false
            }
        });
        return settings;
    };

    // Instance methods
    UserPrivacySettings.prototype.isProfilePublic = function () {
        return this.profile_visibility === 'public';
    };

    UserPrivacySettings.prototype.canShowAchievements = function () {
        return this.show_achievements && this.isProfilePublic();
    };

    UserPrivacySettings.prototype.canShowProgress = function () {
        return this.show_progress && this.isProfilePublic();
    };

    UserPrivacySettings.prototype.canReceiveMessages = function () {
        return this.allow_messages;
    };

    return UserPrivacySettings;
};