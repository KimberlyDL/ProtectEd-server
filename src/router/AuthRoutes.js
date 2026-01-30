const express = require('express');
const router = express.Router();
const authController = require('../controller/AuthController');
const { authenticate, requireEmailVerified } = require('../middleware/AuthMiddleware');

// ===== Public Routes =====
router.post('/register', authController.register);
router.get('/verify-email', authController.verifyEmail); // NEW
router.post('/forgot-password', authController.forgotPassword); // NEW
router.post('/reset-password', authController.resetPassword); // NEW
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/email/verification-notification', authController.resendVerification);

// ===== Protected Routes (require authentication) =====
router.use(authenticate); // All routes below require valid JWT

// User info
router.get('/me', authController.me);

// Session management
router.get('/sessions', authController.getSessions);
router.delete('/sessions/:session_id', authController.revokeSession);

// Logout
router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);

// Password management
router.post('/change-password', authController.changePassword);

module.exports = router;