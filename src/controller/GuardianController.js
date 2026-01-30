// controllers/GuardianController.js
const { UserGuardian } = require('../model');

/**
 * Get all guardians for current user
 */
exports.getGuardians = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const guardians = await UserGuardian.findUserGuardians(userId);

        res.json({
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
            }))
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add a new guardian
 */
exports.addGuardian = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            guardian_type,
            full_name,
            relationship,
            phone_number,
            email,
            address,
            is_primary
        } = req.body;

        // Validation
        if (!guardian_type || !full_name || !relationship || !phone_number) {
            return res.status(422).json({
                message: 'Guardian type, full name, relationship, and phone number are required.',
                errors: {
                    guardian_type: !guardian_type ? ['Guardian type is required'] : [],
                    full_name: !full_name ? ['Full name is required'] : [],
                    relationship: !relationship ? ['Relationship is required'] : [],
                    phone_number: !phone_number ? ['Phone number is required'] : []
                }
            });
        }

        const guardian = await UserGuardian.create({
            user_id: userId,
            guardian_type,
            full_name,
            relationship,
            phone_number,
            email: email || null,
            address: address || null,
            is_primary: is_primary || false
        });

        res.status(201).json({
            message: 'Guardian added successfully',
            guardian: {
                id: guardian.id,
                guardian_type: guardian.guardian_type,
                full_name: guardian.full_name,
                relationship: guardian.relationship,
                phone_number: guardian.phone_number,
                email: guardian.email,
                address: guardian.address,
                is_primary: guardian.is_primary,
                created_at: guardian.created_at
            }
        });
    } catch (error) {
        // Handle unique constraint error for primary guardian
        if (error.message.includes('primary guardian')) {
            return res.status(422).json({
                message: error.message,
                errors: {
                    is_primary: [error.message]
                }
            });
        }
        next(error);
    }
};

/**
 * Update guardian
 */
exports.updateGuardian = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const guardianId = req.params.id;
        const {
            guardian_type,
            full_name,
            relationship,
            phone_number,
            email,
            address,
            is_primary
        } = req.body;

        // Find guardian and verify ownership
        const guardian = await UserGuardian.findByPk(guardianId);

        if (!guardian || guardian.user_id !== userId) {
            return res.status(404).json({
                message: 'Guardian not found'
            });
        }

        // Update fields
        if (guardian_type !== undefined) guardian.guardian_type = guardian_type;
        if (full_name !== undefined) guardian.full_name = full_name;
        if (relationship !== undefined) guardian.relationship = relationship;
        if (phone_number !== undefined) guardian.phone_number = phone_number;
        if (email !== undefined) guardian.email = email;
        if (address !== undefined) guardian.address = address;
        if (is_primary !== undefined) guardian.is_primary = is_primary;

        await guardian.save();

        res.json({
            message: 'Guardian updated successfully',
            guardian: {
                id: guardian.id,
                guardian_type: guardian.guardian_type,
                full_name: guardian.full_name,
                relationship: guardian.relationship,
                phone_number: guardian.phone_number,
                email: guardian.email,
                address: guardian.address,
                is_primary: guardian.is_primary,
                created_at: guardian.created_at
            }
        });
    } catch (error) {
        // Handle unique constraint error for primary guardian
        if (error.message.includes('primary guardian')) {
            return res.status(422).json({
                message: error.message,
                errors: {
                    is_primary: [error.message]
                }
            });
        }
        next(error);
    }
};

/**
 * Delete guardian
 */
exports.deleteGuardian = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const guardianId = req.params.id;

        // Find guardian and verify ownership
        const guardian = await UserGuardian.findByPk(guardianId);

        if (!guardian || guardian.user_id !== userId) {
            return res.status(404).json({
                message: 'Guardian not found'
            });
        }

        await guardian.destroy();

        res.json({
            message: 'Guardian removed successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = exports;