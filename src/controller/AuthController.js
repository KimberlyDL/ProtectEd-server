const { User } = require('../model');
const jwtService = require('../services/JwtService');
const { getDeviceInfo } = require('../middleware/AuthMiddleware');
const emailService = require('../services/EmailService');

const setRefreshCookie = (res, token) => {
    res.cookie('refresh_token', token, {
        httpOnly: true, // Invisible to frontend JS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'None', // Allows cross-site/third-party integration
        path: '/api/refresh', // Security: only send to the refresh route
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

/**
 * Register new user
 */
exports.register = async (req, res, next) => {
    try {
        const { email, password, password_confirmation, name } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(422).json({
                message: 'Email and password are required.',
                errors: {
                    email: !email ? ['Email is required'] : [],
                    password: !password ? ['Password is required'] : []
                }
            });
        }

        // Password confirmation check
        if (password_confirmation && password !== password_confirmation) {
            return res.status(422).json({
                message: 'Passwords do not match.',
                errors: {
                    password: ['Passwords do not match']
                }
            });
        }

        // Password strength validation
        if (password.length < 8) {
            return res.status(422).json({
                message: 'Password must be at least 8 characters.',
                errors: {
                    password: ['Password must be at least 8 characters']
                }
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(422).json({
                message: 'Email already registered.',
                errors: {
                    email: ['This email is already registered']
                }
            });
        }

        // Create user
        const user = await User.create({
            email,
            password,
            name: name || null,
            role: 'player'
        });

        // Generate verification token and send email
        const token = jwtService.generateVerificationToken(user);
        await emailService.sendVerificationEmail(user, token);

        res.status(201).json({
            message: 'Account created successfully. Please verify your email.',
            email: user.email
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Login user
 */
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(422).json({
                message: 'Email and password are required.'
            });
        }

        // Find user with password
        const user = await User.scope('withPassword').findOne({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        // Validate password
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        // Check email verification (optional - remove if not needed)
        if (!user.hasVerifiedEmail()) {
            return res.status(403).json({
                message: 'Please verify your email before logging in.',
                unverified: true,
                email: user.email
            });
        }

        // Generate tokens with device info
        const tokens = await jwtService.issueTokens(user, getDeviceInfo(req));

        // Set cookie instead of body
        setRefreshCookie(res, tokens.refreshToken);

        res.json({
            message: 'Login successful',
            token: tokens.accessToken, // Access token stays in JSON
            user: user.toJSON()
        });

        // res.json({
        //     message: 'Login successful',
        //     token: tokens.accessToken,
        //     refresh_token: tokens.refreshToken,
        //     expires_in: tokens.expiresIn,
        //     user: userResponse
        // });
    } catch (error) {
        next(error);
    }
};

/**
 * Refresh access token
 */

exports.refresh = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refresh_token; // Read from cookie

        if (!refreshToken) return res.status(401).json({ message: 'Session expired' });

        const result = await jwtService.refreshAccessToken(refreshToken, getDeviceInfo(req));

        setRefreshCookie(res, result.refreshToken); // Rotate cookie

        // res.json({ token: result.accessToken });

        res.json({
            message: 'Token refreshed successfully',
            token: result.accessToken,
            refresh_token: result.refreshToken,
            expires_in: result.expiresIn,
            user: result.user.toJSON()
        });
    } catch (error) {
        if (error.message.includes('Token reuse detected')) {
            return res.status(401).json({
                message: error.message,
                code: 'TOKEN_REUSE_DETECTED'
            });
        }

        if (error.message.includes('Invalid or expired')) {
            return res.status(401).json({
                message: 'Invalid or expired refresh token.',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }
        next(error);
    }
};

// exports.refresh = async (req, res, next) => {
//     try {
//         const { refresh_token } = req.body;

//         if (!refresh_token) {
//             return res.status(422).json({
//                 message: 'Refresh token is required.'
//             });
//         }

//         // Refresh tokens with device info
//         const deviceInfo = getDeviceInfo(req);
//         const result = await jwtService.refreshAccessToken(refresh_token, deviceInfo);

//         res.json({
//             message: 'Token refreshed successfully',
//             token: result.accessToken,
//             refresh_token: result.refreshToken,
//             expires_in: result.expiresIn,
//             user: result.user.toJSON()
//         });
//     } catch (error) {
//         if (error.message.includes('Token reuse detected')) {
//             return res.status(401).json({
//                 message: error.message,
//                 code: 'TOKEN_REUSE_DETECTED'
//             });
//         }

//         if (error.message.includes('Invalid or expired')) {
//             return res.status(401).json({
//                 message: 'Invalid or expired refresh token.',
//                 code: 'INVALID_REFRESH_TOKEN'
//             });
//         }

//         next(error);
//     }
// };

/**
 * Logout current session
 */
exports.logout = async (req, res, next) => {
    try {
        const { refresh_token } = req.body;

        if (refresh_token) {
            await jwtService.logout(refresh_token);
        }

        res.json({
            message: 'Logged out successfully'
        });
    } catch (error) {
        // Always succeed logout
        res.json({
            message: 'Logged out successfully'
        });
    }
};

/**
 * Logout all sessions (all devices)
 */
exports.logoutAll = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required.'
            });
        }

        await jwtService.logoutAll(req.user.id);

        res.json({
            message: 'Logged out from all devices successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get current user
 */
exports.me = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required.'
            });
        }

        res.json(req.user.toJSON());
    } catch (error) {
        next(error);
    }
};

/**
 * Get active sessions
 */
exports.getSessions = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required.'
            });
        }

        const sessions = await jwtService.getUserSessions(req.user.id);

        res.json({
            sessions
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Revoke specific session
 */
exports.revokeSession = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required.'
            });
        }

        const { session_id } = req.params;

        // Find session and verify ownership
        const { Session } = require('../model');
        const session = await Session.findByPk(session_id);

        if (!session || session.user_id !== req.user.id) {
            return res.status(404).json({
                message: 'Session not found.'
            });
        }

        await jwtService.revokeSession(session.jti);

        res.json({
            message: 'Session revoked successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Resend verification email
 */
// exports.resendVerification = async (req, res, next) => {
//     try {
//         const { email } = req.body;

//         if (!email) {
//             return res.status(422).json({ message: 'Email is required.' });
//         }

//         const user = await User.findOne({ where: { email } });

//         // Security: Don't reveal if user doesn't exist, just say "Email sent"
//         if (!user) {
//             return res.status(200).json({ message: 'If the account is unverified, a new link has been sent.' });
//         }

//         if (user.hasVerifiedEmail()) {
//             return res.status(400).json({ message: 'This account is already verified.' });
//         }

//         // Generate a new 24h verification token
//         const token = jwtService.generateVerificationToken(user);
//         await emailService.sendVerificationEmail(user, token);

//         res.json({ message: 'A new verification link has been sent to your email.' });
//     } catch (error) {
//         next(error);
//     }
// };

// src/controller/AuthController.js

exports.resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            // Security: Don't confirm existence
            return res.status(200).json({ message: 'If unverified, a new link was sent.' });
        }

        // 🟢 Tell the user specifically if they are already verified
        if (user.hasVerifiedEmail()) {
            return res.status(400).json({
                message: 'This account is already verified. Please log in.',
                code: 'ALREADY_VERIFIED'
            });
        }

        const token = jwtService.generateVerificationToken(user);
        await emailService.sendVerificationEmail(user, token);

        res.json({ message: 'A new verification link has been sent.' });
    } catch (error) { next(error); }
};

/**
 * Change password
 */
exports.changePassword = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: 'Authentication required.'
            });
        }

        const { current_password, password, password_confirmation } = req.body;

        // Validation
        if (!current_password || !password || !password_confirmation) {
            return res.status(422).json({
                message: 'All fields are required.'
            });
        }

        if (password !== password_confirmation) {
            return res.status(422).json({
                message: 'Passwords do not match.'
            });
        }

        if (password.length < 8) {
            return res.status(422).json({
                message: 'Password must be at least 8 characters.'
            });
        }

        // Get user with password
        const user = await User.scope('withPassword').findByPk(req.user.id);

        // Validate current password
        const isValid = await user.validatePassword(current_password);
        if (!isValid) {
            return res.status(401).json({
                message: 'Current password is incorrect.'
            });
        }

        // Update password (will trigger hook to set password_changed_at)
        user.password = password;
        await user.save();

        // Revoke all sessions except current
        await jwtService.logoutAll(user.id);

        // Issue new tokens for current session
        const deviceInfo = getDeviceInfo(req);
        const tokens = await jwtService.issueTokens(user, deviceInfo);

        res.json({
            message: 'Password changed successfully. All other sessions have been logged out.',
            token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expires_in: tokens.expiresIn
        });
    } catch (error) {
        next(error);
    }
}

exports.verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.query;
        const decoded = jwtService.verifyActionToken(token, 'email_verification');

        const user = await User.findByPk(decoded.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.email_verified_at) return res.status(400).json({ message: 'Already verified' });

        user.email_verified_at = new Date();
        await user.save();

        res.json({ message: 'Email verified successfully! You can now log in.' });
    } catch (error) {
        res.status(400).json({ message: 'Invalid or expired verification link.' });
    }
};

exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });

        // Security: Don't reveal if user exists
        if (user) {
            const token = jwtService.generateResetToken(user);
            await emailService.sendPasswordResetEmail(user, token);
        }

        res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (error) { next(error); }
};

// exports.resetPassword = async (req, res, next) => {
//     try {
//         const { token, password } = req.body;
//         const decoded = jwtService.verifyActionToken(token, 'password_reset');

//         const user = await User.scope('withPassword').findByPk(decoded.id);
//         if (!user) return res.status(404).json({ message: 'User not found' });

//         user.password = password; // Hook handles hashing and sets password_changed_at
//         await user.save();

//         // Security: Invalidate all existing sessions
//         await jwtService.logoutAll(user.id);

//         res.json({ message: 'Password reset successful. Please log in with your new password.' });
//     } catch (error) {
//         res.status(400).json({ message: 'Invalid or expired reset link.' });
//     }
// };

// src/controller/AuthController.js

exports.resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;

        // 1. Decode without verifying first to get user ID
        const payload = jwt.decode(token);
        const user = await User.scope('withPassword').findByPk(payload?.id);

        if (!user) return res.status(404).json({ message: 'User not found' });

        // 2. 🟢 Verify token against the current user state (One-Time Use check)
        jwtService.verifyActionToken(token, 'password_reset', user);

        user.password = password;
        await user.save(); // This updates password_changed_at

        await jwtService.logoutAll(user.id); //

        res.json({ message: 'Password reset successful.' });
    } catch (error) {
        res.status(400).json({ message: error.message || 'Invalid reset link.' });
    }
};