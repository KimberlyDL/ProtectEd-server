// jobs/AccountDeletionJob.js
const cron = require('node-cron');
const { User, UserProfile, UserGuardian, UserPrivacySettings, UserNotificationPreferences, AccountDeletionRequest, Session, TokenBlacklist } = require('../model');
const sequelize = require('../config/db');
const AvatarService = require('../services/AvatarService');

class AccountDeletionJob {
    /**
     * Schedule the account deletion job to run daily at midnight
     */
    static schedule() {
        // Run daily at midnight (00:00)
        cron.schedule('0 0 * * *', async () => {
            console.log('[AccountDeletionJob] Running daily account deletion check...');
            await this.processAccountDeletions();
        });

        console.log('[AccountDeletionJob] Scheduled to run daily at midnight');
    }

    /**
     * Process all pending account deletions
     */
    static async processAccountDeletions() {
        try {
            // Find all accounts scheduled for deletion
            const deletionRequests = await AccountDeletionRequest.findDueForDeletion();

            if (deletionRequests.length === 0) {
                console.log('[AccountDeletionJob] No accounts scheduled for deletion');
                return;
            }

            console.log(`[AccountDeletionJob] Found ${deletionRequests.length} accounts to delete`);

            for (const request of deletionRequests) {
                await this.deleteAccount(request);
            }

            console.log('[AccountDeletionJob] Completed account deletion process');
        } catch (error) {
            console.error('[AccountDeletionJob] Error processing deletions:', error);
        }
    }

    /**
     * Delete a single account
     * @param {AccountDeletionRequest} deletionRequest
     */
    static async deleteAccount(deletionRequest) {
        const transaction = await sequelize.transaction();

        try {
            const userId = deletionRequest.user_id;
            const user = deletionRequest.user;

            console.log(`[AccountDeletionJob] Deleting account for user ${userId}...`);

            // 1. Delete avatar from Cloudflare R2
            if (user.avatar_url) {
                await AvatarService.deleteAvatar(user.avatar_url);
            }

            // 2. Delete related records (cascade will handle some, but we do it explicitly for logging)

            // Delete guardians
            await UserGuardian.destroy({
                where: { user_id: userId },
                transaction
            });

            // Delete profile
            await UserProfile.destroy({
                where: { user_id: userId },
                transaction
            });

            // Delete privacy settings
            await UserPrivacySettings.destroy({
                where: { user_id: userId },
                transaction
            });

            // Delete notification preferences
            await UserNotificationPreferences.destroy({
                where: { user_id: userId },
                transaction
            });

            // Delete sessions
            await Session.destroy({
                where: { user_id: userId },
                transaction
            });

            // Delete token blacklist entries
            await TokenBlacklist.destroy({
                where: { user_id: userId },
                transaction
            });

            // TODO: Delete other related records
            // - Progress records
            // - Achievement records
            // - Risk assessments
            // - Module logs
            // - etc.

            // 3. Update user record (soft delete approach)
            await User.update({
                account_status: 'deleted',
                email: `deleted_user_${userId}@deleted.local`,
                name: 'Deleted User',
                avatar_url: null,
                provider: null,
                provider_id: null,
                email_verified_at: null,
                password: null,
                is_profile_public: false
            }, {
                where: { id: userId },
                transaction
            });

            // 4. Mark deletion request as completed
            await request.complete();
            await transaction.commit();

            console.log(`[AccountDeletionJob] Successfully deleted account for user ${userId}`);

            // TODO: Send final deletion confirmation email
            // await emailService.sendAccountDeletedEmail(user.email);

        } catch (error) {
            await transaction.rollback();
            console.error(`[AccountDeletionJob] Failed to delete account for user ${deletionRequest.user_id}:`, error);
        }
    }

    /**
     * Manually trigger deletion (for testing or admin purposes)
     */
    static async runNow() {
        console.log('[AccountDeletionJob] Manually triggered account deletion process');
        await this.processAccountDeletions();
    }
}

module.exports = AccountDeletionJob;