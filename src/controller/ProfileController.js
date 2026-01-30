// controllers/ProfileController.js
const { User, UserProfile, UserGuardian, UserPrivacySettings } = require('../model');

/**
 * Get user profile (public or own)
 */
exports.getProfile = async (req, res, next) => {
    try {
        const targetUserId = req.params.id;
        const requesterId = req.user?.id;

        // Find target user
        const targetUser = await User.findByPk(targetUserId, {
            include: [
                {
                    model: UserProfile,
                    as: 'profile'
                },
                {
                    model: UserPrivacySettings,
                    as: 'privacySettings'
                }
            ]
        });

        if (!targetUser) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Check if user is deactivated or deleted
        if (targetUser.account_status !== 'active') {
            return res.status(403).json({
                message: 'This account is no longer available'
            });
        }

        // Viewing own profile - return full info
        if (targetUserId == requesterId) {
            const guardians = await UserGuardian.findUserGuardians(targetUserId);

            return res.json({
                id: targetUser.id,
                email: targetUser.email,
                name: targetUser.name,
                role: targetUser.role,
                avatar_url: targetUser.getAvatarUrl(),
                is_profile_public: targetUser.is_profile_public,
                account_status: targetUser.account_status,
                created_at: targetUser.created_at,
                profile: targetUser.profile ? {
                    display_name: targetUser.profile.display_name,
                    bio: targetUser.profile.bio,
                    date_of_birth: targetUser.profile.date_of_birth,
                    sex: targetUser.profile.sex,
                    gender_identity: targetUser.profile.gender_identity,
                    phone_number: targetUser.profile.phone_number,
                    address: {
                        line1: targetUser.profile.address_line1,
                        line2: targetUser.profile.address_line2,
                        city: targetUser.profile.city,
                        province: targetUser.profile.province,
                        postal_code: targetUser.profile.postal_code,
                        country: targetUser.profile.country
                    },
                    emergency_contact: {
                        name: targetUser.profile.emergency_contact_name,
                        relationship: targetUser.profile.emergency_contact_relationship,
                        phone: targetUser.profile.emergency_contact_phone
                    }
                } : null,
                guardians: guardians.map(g => ({
                    id: g.id,
                    guardian_type: g.guardian_type,
                    full_name: g.full_name,
                    relationship: g.relationship,
                    phone_number: g.phone_number,
                    email: g.email,
                    address: g.address,
                    is_primary: g.is_primary,
                    created_at: g.created_at
                })),
                privacy_settings: targetUser.privacySettings || null
            });
        }

        // Viewing another user's profile
        // Check if profile is public
        if (!targetUser.is_profile_public) {
            return res.status(403).json({
                message: 'This profile is private'
            });
        }

        // Return public profile info only
        return res.json({
            id: targetUser.id,
            display_name: targetUser.profile?.display_name || targetUser.name,
            bio: targetUser.profile?.bio || null,
            sex: targetUser.profile?.sex || null,
            avatar_url: targetUser.getAvatarUrl(),
            is_profile_public: true,
            // Achievements would be loaded here if show_achievements is true
            achievements: [] // TODO: Load from achievements table
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            display_name,
            bio,
            date_of_birth,
            sex,
            gender_identity,
            phone_number,
            address,
            emergency_contact
        } = req.body;

        // Find or create profile
        let profile = await UserProfile.findOne({ where: { user_id: userId } });

        if (!profile) {
            profile = await UserProfile.create({ user_id: userId });
        }

        // Update profile fields
        if (display_name !== undefined) profile.display_name = display_name;
        if (bio !== undefined) profile.bio = bio;
        if (date_of_birth !== undefined) profile.date_of_birth = date_of_birth;
        if (sex !== undefined) profile.sex = sex;
        if (gender_identity !== undefined) profile.gender_identity = gender_identity;
        if (phone_number !== undefined) profile.phone_number = phone_number;

        // Update address fields
        if (address) {
            if (address.line1 !== undefined) profile.address_line1 = address.line1;
            if (address.line2 !== undefined) profile.address_line2 = address.line2;
            if (address.city !== undefined) profile.city = address.city;
            if (address.province !== undefined) profile.province = address.province;
            if (address.postal_code !== undefined) profile.postal_code = address.postal_code;
            if (address.country !== undefined) profile.country = address.country;
        }

        // Update emergency contact
        if (emergency_contact) {
            if (emergency_contact.name !== undefined) {
                profile.emergency_contact_name = emergency_contact.name;
            }
            if (emergency_contact.relationship !== undefined) {
                profile.emergency_contact_relationship = emergency_contact.relationship;
            }
            if (emergency_contact.phone !== undefined) {
                profile.emergency_contact_phone = emergency_contact.phone;
            }
        }

        await profile.save();

        res.json({
            message: 'Profile updated successfully',
            profile: {
                display_name: profile.display_name,
                bio: profile.bio,
                date_of_birth: profile.date_of_birth,
                sex: profile.sex,
                gender_identity: profile.gender_identity,
                phone_number: profile.phone_number,
                address: {
                    line1: profile.address_line1,
                    line2: profile.address_line2,
                    city: profile.city,
                    province: profile.province,
                    postal_code: profile.postal_code,
                    country: profile.country
                },
                emergency_contact: {
                    name: profile.emergency_contact_name,
                    relationship: profile.emergency_contact_relationship,
                    phone: profile.emergency_contact_phone
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Upload avatar (handled separately with file upload)
 */
exports.uploadAvatar = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: 'No file uploaded'
            });
        }

        // Avatar upload logic will be in AvatarService
        // For now, just return the file path
        const avatarUrl = req.file.path; // This will be replaced with Cloudflare URL

        // Update user's avatar_url
        const user = await User.findByPk(req.user.id);
        user.avatar_url = avatarUrl;
        await user.save();

        res.json({
            message: 'Avatar uploaded successfully',
            avatar_url: avatarUrl
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete avatar
 */
exports.deleteAvatar = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id);

        // Delete from Cloudflare if exists
        // TODO: Implement AvatarService.deleteAvatar(user.avatar_url)

        user.avatar_url = null;
        await user.save();

        res.json({
            message: 'Avatar removed successfully',
            avatar_url: user.getAvatarUrl() // Returns default avatar
        });
    } catch (error) {
        next(error);
    }
};

module.exports = exports;