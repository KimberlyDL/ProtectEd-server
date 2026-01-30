// routes/ProfileRoutes.js
const express = require('express');
const router = express.Router();
const profileController = require('../controller/ProfileController');
const guardianController = require('../controller/GuardianController');
const settingsController = require('../controller/SettingsController');
const { authenticate } = require('../middleware/AuthMiddleware');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

// ==================== MULTER CONFIG ====================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1 // Only one file at a time
    },
    fileFilter: (req, file, cb) => {
        // Whitelist approach - only allow specific types
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(
                new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'),
                false
            );
        }

        // Check file extension as additional security
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

        if (!allowedExtensions.includes(ext)) {
            return cb(
                new Error('Invalid file extension.'),
                false
            );
        }

        // Additional security: check for double extensions
        const parts = file.originalname.split('.');
        if (parts.length > 2) {
            return cb(
                new Error('Multiple file extensions are not allowed.'),
                false
            );
        }

        cb(null, true);
    }
});

// ==================== MULTER ERROR HANDLER ====================

/**
 * Middleware to handle Multer errors
 */
const handleMulterErrors = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                message: 'File too large',
                error: 'File size cannot exceed 5MB',
                code: 'FILE_TOO_LARGE'
            });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                message: 'Too many files',
                error: 'Only one file can be uploaded at a time',
                code: 'TOO_MANY_FILES'
            });
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                message: 'Unexpected field',
                error: 'File uploaded to wrong field name',
                code: 'UNEXPECTED_FIELD'
            });
        }

        return res.status(400).json({
            message: 'Upload error',
            error: err.message,
            code: 'MULTER_ERROR'
        });
    }

    // Non-Multer errors (e.g., fileFilter rejections)
    if (err) {
        return res.status(400).json({
            message: 'File validation failed',
            error: err.message,
            code: 'VALIDATION_ERROR'
        });
    }

    next();
};

// ==================== RATE LIMITING ====================

// Rate limit for avatar uploads (prevent spam)
const avatarUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 uploads per 15 minutes
    message: {
        message: 'Too many avatar uploads',
        error: 'Please wait before uploading another avatar',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for admins
    skip: (req) => req.user && req.user.role === 'admin'
});

// Rate limit for profile updates
const profileUpdateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Max 10 updates per 5 minutes
    message: {
        message: 'Too many profile updates',
        error: 'Please wait before updating your profile again',
        code: 'RATE_LIMIT_EXCEEDED'
    }
});

// ==================== PUBLIC ROUTES ====================

// GET /api/v1/users/:id/profile - View profile (public or own)
router.get('/:id/profile', profileController.getProfile);

// ==================== PROTECTED ROUTES ====================

router.use(authenticate);

// ===== Profile Management =====
router.put(
    '/profile',
    profileUpdateLimiter,
    profileController.updateProfile
);

router.post(
    '/avatar',
    avatarUploadLimiter,
    upload.single('avatar'),
    handleMulterErrors, // Handle Multer errors BEFORE controller
    profileController.uploadAvatar
);

router.delete(
    '/avatar',
    profileController.deleteAvatar
);

// ===== Guardian Management =====
router.get('/guardians', guardianController.getGuardians);
router.post('/guardians', guardianController.addGuardian);
router.put('/guardians/:id', guardianController.updateGuardian);
router.delete('/guardians/:id', guardianController.deleteGuardian);

// ===== Privacy Settings =====
router.get('/settings/privacy', settingsController.getPrivacySettings);
router.put('/settings/privacy', settingsController.updatePrivacySettings);

// ===== Notification Preferences =====
router.get('/settings/notifications', settingsController.getNotificationPreferences);
router.put('/settings/notifications', settingsController.updateNotificationPreferences);

// ===== Account Management =====
router.post('/account/deactivate', settingsController.deactivateAccount);
router.post('/account/reactivate', settingsController.reactivateAccount);
router.post('/account/delete', settingsController.requestAccountDeletion);
router.post('/account/cancel-deletion', settingsController.cancelAccountDeletion);
router.get('/account/deletion-status', settingsController.getDeletionStatus);

// ==================== GLOBAL ERROR HANDLER ====================

router.use((err, req, res, next) => {
    console.error('Profile routes error:', err);

    // Handle specific error types
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            message: 'Validation error',
            errors: err.errors.map(e => ({
                field: e.path,
                message: e.message
            }))
        });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            message: 'Duplicate entry',
            error: 'This value already exists'
        });
    }

    // Default error response
    res.status(err.status || 500).json({
        message: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR'
    });
});

module.exports = router;