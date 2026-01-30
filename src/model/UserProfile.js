// models/UserProfile.js
module.exports = (sequelize, DataTypes) => {
    const UserProfile = sequelize.define('UserProfile', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true
        },
        display_name: {
            type: DataTypes.STRING(100),
            allowNull: true,
            validate: {
                len: {
                    args: [3, 100],
                    msg: 'Display name must be between 3 and 100 characters'
                },
                is: {
                    args: /^[a-zA-Z0-9\s._-]+$/,
                    msg: 'Display name can only contain letters, numbers, spaces, dots, underscores, and hyphens'
                }
            }
        },
        bio: {
            type: DataTypes.TEXT,
            allowNull: true,
            validate: {
                len: {
                    args: [0, 500],
                    msg: 'Bio must not exceed 500 characters'
                }
            }
        },
        date_of_birth: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            validate: {
                isDate: true,
                isValidAge(value) {
                    if (value) {
                        const today = new Date();
                        const birthDate = new Date(value);
                        let age = today.getFullYear() - birthDate.getFullYear();
                        const monthDiff = today.getMonth() - birthDate.getMonth();
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                        }
                        if (age < 13) {
                            throw new Error('You must be at least 13 years old to use ProtectEd');
                        }
                        if (age > 120) {
                            throw new Error('Invalid date of birth');
                        }
                    }
                }
            }
        },
        sex: {
            type: DataTypes.ENUM('male', 'female', 'prefer_not_to_say'),
            allowNull: true
        },
        gender_identity: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        phone_number: {
            type: DataTypes.STRING(20),
            allowNull: true,
            validate: {
                isValidPhone(value) {
                    if (value && !/^\+63[0-9]{10}$/.test(value)) {
                        throw new Error('Please enter a valid Philippine phone number (+639XXXXXXXXX)');
                    }
                }
            }
        },
        address_line1: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        address_line2: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        city: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        province: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        postal_code: {
            type: DataTypes.STRING(20),
            allowNull: true
        },
        country: {
            type: DataTypes.STRING(100),
            defaultValue: 'Philippines',
            allowNull: false
        },
        emergency_contact_name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        emergency_contact_relationship: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        emergency_contact_phone: {
            type: DataTypes.STRING(20),
            allowNull: true,
            validate: {
                isValidPhone(value) {
                    if (value && !/^\+63[0-9]{10}$/.test(value)) {
                        throw new Error('Please enter a valid Philippine phone number (+639XXXXXXXXX)');
                    }
                }
            }
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'UserProfiles'
    });

    // Associations
    UserProfile.associate = function (models) {
        UserProfile.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    // Instance methods
    UserProfile.prototype.getAge = function () {
        if (!this.date_of_birth) return null;
        
        const today = new Date();
        const birthDate = new Date(this.date_of_birth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    };

    UserProfile.prototype.isMinor = function () {
        const age = this.getAge();
        return age !== null && age < 18;
    };

    UserProfile.prototype.getFullAddress = function () {
        const parts = [
            this.address_line1,
            this.address_line2,
            this.city,
            this.province,
            this.postal_code,
            this.country
        ].filter(Boolean);
        
        return parts.length > 0 ? parts.join(', ') : null;
    };

    UserProfile.prototype.toPublicJSON = function () {
        return {
            display_name: this.display_name,
            bio: this.bio,
            sex: this.sex
        };
    };

    return UserProfile;
};