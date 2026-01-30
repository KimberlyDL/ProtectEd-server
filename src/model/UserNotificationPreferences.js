// models/UserNotificationPreferences.js
module.exports = (sequelize, DataTypes) => {
    const UserNotificationPreferences = sequelize.define('UserNotificationPreferences', {
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
        email_notifications: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        module_reminders: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        achievement_alerts: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        safety_alerts: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
            comment: 'VAWC safety alerts - should always be enabled'
        },
        platform_updates: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'UserNotificationPreferences',
        hooks: {
            beforeUpdate: (preferences) => {
                // Prevent disabling safety alerts
                if (preferences.changed('safety_alerts') && !preferences.safety_alerts) {
                    throw new Error('Safety alerts cannot be disabled for your protection');
                }
            }
        }
    });

    // Associations
    UserNotificationPreferences.associate = function (models) {
        UserNotificationPreferences.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    // Static methods
    UserNotificationPreferences.findOrCreateForUser = async function (userId) {
        const [preferences] = await this.findOrCreate({
            where: { user_id: userId },
            defaults: {
                user_id: userId,
                email_notifications: true,
                module_reminders: true,
                achievement_alerts: true,
                safety_alerts: true,
                platform_updates: false
            }
        });
        return preferences;
    };

    // Instance methods
    UserNotificationPreferences.prototype.canSendEmail = function () {
        return this.email_notifications;
    };

    UserNotificationPreferences.prototype.shouldSendModuleReminder = function () {
        return this.module_reminders && this.email_notifications;
    };

    UserNotificationPreferences.prototype.shouldSendAchievementAlert = function () {
        return this.achievement_alerts && this.email_notifications;
    };

    UserNotificationPreferences.prototype.shouldSendSafetyAlert = function () {
        // Safety alerts should always be sent regardless of other settings
        return true;
    };

    return UserNotificationPreferences;
};