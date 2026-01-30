const jwtService = require('../services/JwtService');

/**
 * Cleanup expired sessions and tokens
 * Run this as a cron job (e.g., every hour or daily)
 */
async function cleanupExpiredTokens() {
    try {
        console.log('[Cleanup] Starting cleanup of expired tokens and sessions...');

        await jwtService.cleanupExpired();

        console.log('[Cleanup] Cleanup completed successfully');
    } catch (error) {
        console.error('[Cleanup] Error during cleanup:', error.message);
    }
}

/**
 * Schedule cleanup job
 * You can use node-cron or similar library
 */
function scheduleCleanup() {
    // Run every 6 hours
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    setInterval(cleanupExpiredTokens, SIX_HOURS);

    // Run immediately on startup
    cleanupExpiredTokens();
}

module.exports = {
    cleanupExpiredTokens,
    scheduleCleanup
};