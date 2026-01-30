const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Session, TokenBlacklist } = require('../model');

/**
 * Comprehensive JWT Service with Security Features
 * - Access & Refresh token generation
 * - Token rotation
 * - Session management
 * - Replay attack detection
 * - Token blacklisting
 */
class JWTService {
    constructor() {
        this.accessSecret = process.env.JWT_SECRET;
        this.refreshSecret = process.env.JWT_REFRESH_SECRET;
        this.accessExpiry = process.env.JWT_EXPIRES_IN || '15m';
        this.refreshExpiry = '7d';

        if (!this.accessSecret || !this.refreshSecret) {
            throw new Error('JWT secrets must be configured');
        }
    }

    /**
     * Generate unique JWT ID
     */
    generateJTI() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Generate access token with JTI
     */
    generateAccessToken(user, jti) {
        const payload = {
            jti,
            id: user.id,
            email: user.email,
            role: user.role,
            email_verified: !!user.email_verified_at
        };

        return jwt.sign(payload, this.accessSecret, {
            expiresIn: this.accessExpiry,
            issuer: 'your-app-name',
            audience: 'your-app-users'
        });
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(userId, jti) {
        const payload = {
            jti,
            id: userId,
            type: 'refresh'
        };

        return jwt.sign(payload, this.refreshSecret, {
            expiresIn: this.refreshExpiry,
            issuer: 'your-app-name',
            audience: 'your-app-users'
        });
    }

    /**
     * Issue complete token pair with session
     */
    // src/services/JwtService.js (Partial Update)
    async issueTokens(user, deviceInfo = {}) {
        const jti = this.generateJTI();
        const accessToken = this.generateAccessToken(user, jti);
        const refreshToken = this.generateRefreshToken(user.id, jti);

        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await Session.create({
            user_id: user.id,
            jti,
            refresh_token_hash: refreshTokenHash,
            device_name: deviceInfo.device_name || null,
            ip_address: deviceInfo.ip_address || null,
            user_agent: deviceInfo.user_agent || null,
            last_activity: new Date(),
            expires_at: expiresAt
        });

        return {
            accessToken,
            refreshToken, // This will be sent as a cookie in the controller
            expiresIn: this.getAccessTokenTTL()
        };
    }

    /**
     * Verify access token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, this.accessSecret, {
                issuer: 'your-app-name',
                audience: 'your-app-users'
            });
            return decoded;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Verify refresh token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, this.refreshSecret, {
                issuer: 'your-app-name',
                audience: 'your-app-users'
            });

            if (decoded.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            return decoded;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Refresh access token with rotation
     */
    async refreshAccessToken(refreshToken, deviceInfo = {}) {
        // Verify refresh token signature
        let decoded;
        try {
            decoded = this.verifyRefreshToken(refreshToken);
        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }

        // Find active session
        const session = await Session.findActiveSession(decoded.jti);

        if (!session) {
            // Token reuse detected - revoke all user sessions
            await this.detectTokenReuse(decoded.id);
            throw new Error('Token reuse detected. All sessions revoked for security.');
        }

        // Validate refresh token hash
        const isValid = await session.validateRefreshToken(refreshToken);
        if (!isValid) {
            await this.detectTokenReuse(decoded.id);
            throw new Error('Invalid refresh token. All sessions revoked for security.');
        }

        // Check if user's password changed after token issue
        if (session.user.tokenIssuedBeforePasswordChange(decoded.iat)) {
            await session.revoke();
            throw new Error('Token invalidated due to password change');
        }

        // Revoke old session
        await session.revoke();

        // Issue new tokens (rotation)
        const newTokens = await this.issueTokens(session.user, deviceInfo);

        return {
            ...newTokens,
            user: session.user
        };
    }

    /**
     * Validate access token and check blacklist
     */
    async validateAccessToken(token) {
        // Verify signature
        const decoded = this.verifyAccessToken(token);

        // Check blacklist (for emergency invalidation)
        const isBlacklisted = await TokenBlacklist.isBlacklisted(decoded.jti);
        if (isBlacklisted) {
            throw new Error('Token has been revoked');
        }

        return decoded;
    }

    /**
     * Logout - revoke single session
     */
    async logout(refreshToken) {
        try {
            const decoded = this.verifyRefreshToken(refreshToken);

            const session = await Session.findOne({
                where: { jti: decoded.jti }
            });

            if (session) {
                await session.revoke();
            }

            return true;
        } catch (error) {
            // Fail silently for logout
            return true;
        }
    }

    /**
     * Logout all devices - revoke all user sessions
     */
    async logoutAll(userId) {
        await Session.revokeAllUserSessions(userId);

        // Optionally blacklist all active access tokens
        // (expensive - usually not needed since sessions are revoked)

        return true;
    }

    /**
     * Detect token reuse (replay attack)
     */
    async detectTokenReuse(userId) {
        console.warn(`[SECURITY] Token reuse detected for user ${userId}`);

        // Revoke all sessions immediately
        await Session.revokeAllUserSessions(userId);

        // Log security event
        // TODO: Send security alert email/notification

        return true;
    }

    /**
     * Revoke specific session by JTI
     */
    async revokeSession(jti) {
        const session = await Session.findOne({ where: { jti } });
        if (session) {
            await session.revoke();
        }
        return true;
    }

    /**
     * Get user's active sessions
     */
    async getUserSessions(userId) {
        const sessions = await Session.findAll({
            where: {
                user_id: userId,
                revoked_at: null
            },
            order: [['last_activity', 'DESC']]
        });

        return sessions.filter(s => s.isActive()).map(s => ({
            id: s.id,
            device_name: s.device_name,
            ip_address: s.ip_address,
            last_activity: s.last_activity,
            created_at: s.created_at
        }));
    }

    /**
     * Blacklist access token (emergency use)
     */
    async blacklistAccessToken(token, reason = 'manual_revocation') {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.jti || !decoded.exp) {
                return false;
            }

            const expiresAt = new Date(decoded.exp * 1000);
            await TokenBlacklist.blacklistToken(decoded.jti, decoded.id, expiresAt, reason);

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Cleanup expired tokens and sessions (run as cron job)
     */
    async cleanupExpired() {
        await Promise.all([
            Session.cleanupExpired(),
            TokenBlacklist.cleanupExpired()
        ]);

        console.log('[Cleanup] Expired sessions and tokens removed');
        return true;
    }

    /**
     * Decode token without verification
     */
    decode(token) {
        return jwt.decode(token);
    }

    /**
     * Get access token TTL in seconds
     */
    getAccessTokenTTL() {
        const match = this.accessExpiry.match(/^(\d+)([smhd])$/);
        if (!match) return 900;

        const [, value, unit] = match;
        const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
        return parseInt(value) * multipliers[unit];
    }


    //#region Email verification
    /**
     * Email verification
     */
    generateVerificationToken(user) {
        return jwt.sign({ id: user.id, type: 'email_verification' }, this.accessSecret, { expiresIn: '24h' });
    }

    generateResetToken(user) {
        // 🟢 Use a slice of the current password hash as a 'secret' piece of the payload
        const secretPart = user.password.substring(user.password.length - 10);

        return jwt.sign(
            {
                id: user.id,
                type: 'password_reset',
                version: secretPart // This token version is tied to the current password
            },
            this.accessSecret,
            { expiresIn: '1h' }
        );
    }

    verifyActionToken(token, type, user = null) {
        const decoded = jwt.verify(token, this.accessSecret);

        if (decoded.type !== type) throw new Error('Invalid token type');

        // 🟢 If it's a reset token, verify it still matches the user's current password
        if (type === 'password_reset' && user) {
            const currentSecretPart = user.password.substring(user.password.length - 10);
            if (decoded.version !== currentSecretPart) {
                throw new Error('This reset link has already been used or is outdated.');
            }
        }

        return decoded;
    }

    //#endregion Email verification
}

module.exports = new JWTService();