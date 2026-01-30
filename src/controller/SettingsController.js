// controllers/SettingsController.js
const { User, UserPrivacySettings, UserNotificationPreferences, AccountDeletionRequest, Session } = require('../model');
const jwtService = require('../services/JwtService');

/**
 * Get privacy settings
 */
exports.getPrivacySettings = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const settings = await UserPrivacySettings.findOrCreateForUser(userId);

        res.json({
            profile_visibility: settings.profile_visibility,
            show_achievements: settings.show_achievements,
            show_progress: settings.show_progress,
            allow_messages: settings.allow_messages
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update privacy settings
 */
exports.updatePrivacySettings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            profile_visibility,
            show_achievements,
            show_progress,
            allow_messages
        } = req.body;

        const settings = await UserPrivacySettings.findOrCreateForUser(userId);

        // Update fields
        if (profile_visibility !== undefined) {
            settings.profile_visibility = profile_visibility;

            // Also update is_profile_public in Users table for consistency
            const user = await User.findByPk(userId);
            user.is_profile_public = (profile_visibility === 'public');
            await user.save();
        }
        if (show_achievements !== undefined) settings.show_achievements = show_achievements;
        if (show_progress !== undefined) settings.show_progress = show_progress;
        if (allow_messages !== undefined) settings.allow_messages = allow_messages;

        await settings.save();

        res.json({
            message: 'Privacy settings updated successfully',
            settings: {
                profile_visibility: settings.profile_visibility,
                show_achievements: settings.show_achievements,
                show_progress: settings.show_progress,
                allow_messages: settings.allow_messages
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get notification preferences
 */
exports.getNotificationPreferences = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const preferences = await UserNotificationPreferences.findOrCreateForUser(userId);

        res.json({
            email_notifications: preferences.email_notifications,
            module_reminders: preferences.module_reminders,
            achievement_alerts: preferences.achievement_alerts,
            safety_alerts: preferences.safety_alerts,
            platform_updates: preferences.platform_updates
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update notification preferences
 */
exports.updateNotificationPreferences = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            email_notifications,
            module_reminders,
            achievement_alerts,
            safety_alerts,
            platform_updates
        } = req.body;

        const preferences = await UserNotificationPreferences.findOrCreateForUser(userId);

        // Update fields
        if (email_notifications !== undefined) {
            preferences.email_notifications = email_notifications;
        }
        if (module_reminders !== undefined) {
            preferences.module_reminders = module_reminders;
        }
        if (achievement_alerts !== undefined) {
            preferences.achievement_alerts = achievement_alerts;
        }
        if (safety_alerts !== undefined) {
            preferences.safety_alerts = safety_alerts;
        }
        if (platform_updates !== undefined) {
            preferences.platform_updates = platform_updates;
        }

        await preferences.save();

        res.json({
            message: 'Notification preferences updated successfully',
            preferences: {
                email_notifications: preferences.email_notifications,
                module_reminders: preferences.module_reminders,
                achievement_alerts: preferences.achievement_alerts,
                safety_alerts: preferences.safety_alerts,
                platform_updates: preferences.platform_updates
            }
        });
    } catch (error) {
        // Handle safety_alerts validation error
        if (error.message.includes('Safety alerts')) {
            return res.status(422).json({
                message: error.message,
                errors: {
                    safety_alerts: [error.message]
                }
            });
        }
        next(error);
    }
};

/**
 * Deactivate account
 */
exports.deactivateAccount = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { password, reason } = req.body;

        // Validate password
        if (!password) {
            return res.status(422).json({
                message: 'Password is required to deactivate your account',
                errors: {
                    password: ['Password is required']
                }
            });
        }

        // Verify password
        const user = await User.scope('withPassword').findByPk(userId);
        const isValidPassword = await user.validatePassword(password);

        if (!isValidPassword) {
            return res.status(401).json({
                message: 'Incorrect password',
                errors: {
                    password: ['Incorrect password']
                }
            });
        }

        // Deactivate account
        user.account_status = 'deactivated';
        user.deactivated_at = new Date();
        user.is_profile_public = false;
        await user.save();

        // Revoke all sessions (logout everywhere)
        await jwtService.logoutAll(userId);

        // TODO: Send deactivation confirmation email

        res.json({
            message: 'Account deactivated successfully. You can reactivate within 30 days by logging in again.'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reactivate account
 */
exports.reactivateAccount = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(422).json({
                message: 'Email and password are required'
            });
        }

        // Find deactivated user
        const user = await User.scope('withPassword').findOne({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // Check if account is deactivated
        if (user.account_status !== 'deactivated') {
            return res.status(400).json({
                message: 'This account is not deactivated'
            });
        }

        // Check if deactivation is within 30 days
        const deactivatedDate = new Date(user.deactivated_at);
        const now = new Date();
        const daysSinceDeactivation = Math.floor((now - deactivatedDate) / (1000 * 60 * 60 * 24));

        if (daysSinceDeactivation > 30) {
            return res.status(403).json({
                message: 'Account deactivation period has expired. Please contact support.'
            });
        }

        // Verify password
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // Reactivate account
        user.account_status = 'active';
        user.deactivated_at = null;
        await user.save();

        // Generate new tokens
        const { getDeviceInfo } = require('../middleware/AuthMiddleware');
        const tokens = await jwtService.issueTokens(user, getDeviceInfo(req));

        res.json({
            message: 'Account reactivated successfully',
            token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expires_in: tokens.expiresIn,
            user: user.toJSON()
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Request account deletion
 */
exports.requestAccountDeletion = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { password, reason, confirm_text } = req.body;

        // Validate password
        if (!password) {
            return res.status(422).json({
                message: 'Password is required',
                errors: {
                    password: ['Password is required']
                }
            });
        }

        // Validate confirmation text
        if (confirm_text !== 'DELETE MY ACCOUNT') {
            return res.status(422).json({
                message: 'Please type "DELETE MY ACCOUNT" to confirm',
                errors: {
                    confirm_text: ['Please type "DELETE MY ACCOUNT" to confirm']
                }
            });
        }

        // Verify password
        const user = await User.scope('withPassword').findByPk(userId);
        const isValidPassword = await user.validatePassword(password);

        if (!isValidPassword) {
            return res.status(401).json({
                message: 'Incorrect password',
                errors: {
                    password: ['Incorrect password']
                }
            });
        }

        // Create deletion request
        const deletionRequest = await AccountDeletionRequest.createRequest(userId, reason);

        // Deactivate account immediately
        user.account_status = 'deactivated';
        user.deactivated_at = new Date();
        user.is_profile_public = false;
        await user.save();

        // Revoke all sessions
        await jwtService.logoutAll(userId);

        // TODO: Send deletion confirmation email with cancellation link

        res.json({
            message: `Account deletion scheduled for ${deletionRequest.scheduled_deletion_date.toISOString().split('T')[0]}. You can cancel within 30 days.`,
            scheduled_deletion_date: deletionRequest.scheduled_deletion_date,
            days_remaining: deletionRequest.getDaysRemaining()
        });
    } catch (error) {
        if (error.message.includes('already pending')) {
            return res.status(422).json({
                message: error.message
            });
        }
        next(error);
    }
};

/**
 * Cancel account deletion
 */
exports.cancelAccountDeletion = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Find pending deletion request
        const deletionRequest = await AccountDeletionRequest.findPendingRequest(userId);

        if (!deletionRequest) {
            return res.status(404).json({
                message: 'No pending deletion request found'
            });
        }

        // Cancel the request
        await deletionRequest.cancel();

        // Reactivate account
        const user = await User.findByPk(userId);
        user.account_status = 'active';
        user.deactivated_at = null;
        await user.save();

        res.json({
            message: 'Account deletion cancelled successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get account deletion status
 */
exports.getDeletionStatus = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const deletionRequest = await AccountDeletionRequest.findPendingRequest(userId);

        if (!deletionRequest) {
            return res.json({
                has_pending_deletion: false
            });
        }

        res.json({
            has_pending_deletion: true,
            scheduled_deletion_date: deletionRequest.scheduled_deletion_date,
            days_remaining: deletionRequest.getDaysRemaining(),
            requested_at: deletionRequest.requested_at,
            can_cancel: deletionRequest.canBeCancelled()
        });
    } catch (error) {
        next(error);
    }
};

module.exports = exports;