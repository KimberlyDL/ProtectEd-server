// routes/profileRoutes.js
const express = require('express');
const router = express.Router();
const profileController = require('../controller/ProfileController');
const guardianController = require('../controller/GuardianController');
const settingsController = require('../controller/SettingsController');
const { authenticate } = require('../middleware/AuthMiddleware');
const multer = require('multer');

// Configure multer for avatar uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
        }
    }
});

// ===== Public Routes (Profile View) =====
// GET /api/v1/users/:id/profile - View profile (public or own)
router.get('/:id/profile', profileController.getProfile);

// ===== Protected Routes (require authentication) =====
router.use(authenticate);

// Profile Management
router.put('/profile', profileController.updateProfile);
router.post('/avatar', upload.single('avatar'), profileController.uploadAvatar);
router.delete('/avatar', profileController.deleteAvatar);

// Guardian Management
router.get('/guardians', guardianController.getGuardians);
router.post('/guardians', guardianController.addGuardian);
router.put('/guardians/:id', guardianController.updateGuardian);
router.delete('/guardians/:id', guardianController.deleteGuardian);

// Privacy Settings
router.get('/settings/privacy', settingsController.getPrivacySettings);
router.put('/settings/privacy', settingsController.updatePrivacySettings);

// Notification Preferences
router.get('/settings/notifications', settingsController.getNotificationPreferences);
router.put('/settings/notifications', settingsController.updateNotificationPreferences);

// Account Management
router.post('/account/deactivate', settingsController.deactivateAccount);
router.post('/account/reactivate', settingsController.reactivateAccount);
router.post('/account/delete', settingsController.requestAccountDeletion);
router.post('/account/cancel-deletion', settingsController.cancelAccountDeletion);
router.get('/account/deletion-status', settingsController.getDeletionStatus);

module.exports = router;