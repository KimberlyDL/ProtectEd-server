// models/UserGuardian.js
module.exports = (sequelize, DataTypes) => {
    const UserGuardian = sequelize.define('UserGuardian', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        guardian_type: {
            type: DataTypes.ENUM('parent', 'legal_guardian', 'other'),
            allowNull: false
        },
        full_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                len: {
                    args: [3, 255],
                    msg: 'Guardian name must be between 3 and 255 characters'
                }
            }
        },
        relationship: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        phone_number: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isValidPhone(value) {
                    if (!/^\+63[0-9]{10}$/.test(value)) {
                        throw new Error('Please enter a valid Philippine phone number (+639XXXXXXXXX)');
                    }
                }
            }
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            validate: {
                isEmail: {
                    msg: 'Please provide a valid email address'
                }
            }
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        is_primary: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'UserGuardians',
        hooks: {
            beforeCreate: async (guardian) => {
                if (guardian.is_primary) {
                    await checkPrimaryGuardian(guardian.user_id);
                }
            },
            beforeUpdate: async (guardian) => {
                if (guardian.changed('is_primary') && guardian.is_primary) {
                    await checkPrimaryGuardian(guardian.user_id, guardian.id);
                }
            }
        }
    });

    // Helper function to check for existing primary guardian
    async function checkPrimaryGuardian(userId, excludeId = null) {
        const where = { user_id: userId, is_primary: true };
        if (excludeId) {
            where.id = { [sequelize.Sequelize.Op.ne]: excludeId };
        }

        const existing = await UserGuardian.findOne({ where });
        if (existing) {
            throw new Error('A primary guardian already exists for this user');
        }
    }

    // Associations
    UserGuardian.associate = function (models) {
        UserGuardian.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    // Static methods
    UserGuardian.findPrimaryGuardian = async function (userId) {
        return await this.findOne({
            where: {
                user_id: userId,
                is_primary: true
            }
        });
    };

    UserGuardian.findUserGuardians = async function (userId) {
        return await this.findAll({
            where: { user_id: userId },
            order: [['is_primary', 'DESC'], ['created_at', 'ASC']]
        });
    };

    // Instance methods
    UserGuardian.prototype.toJSON = function () {
        const values = { ...this.get() };
        return values;
    };

    return UserGuardian;
};