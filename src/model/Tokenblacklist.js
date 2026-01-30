module.exports = (sequelize, DataTypes) => {
    const TokenBlacklist = sequelize.define('TokenBlacklist', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        jti: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        reason: {
            type: DataTypes.STRING(100),
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'TokenBlacklist',
        createdAt: 'created_at',
        updatedAt: false
    });

    // Associations
    TokenBlacklist.associate = function (models) {
        TokenBlacklist.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    // Static methods
    TokenBlacklist.isBlacklisted = async function (jti) {
        const entry = await this.findOne({
            where: { jti }
        });
        return !!entry;
    };

    TokenBlacklist.blacklistToken = async function (jti, userId, expiresAt, reason = null) {
        await this.create({
            jti,
            user_id: userId,
            expires_at: expiresAt,
            reason
        });
    };

    TokenBlacklist.cleanupExpired = async function () {
        const now = new Date();
        await this.destroy({
            where: {
                expires_at: { [sequelize.Sequelize.Op.lt]: now }
            }
        });
    };

    return TokenBlacklist;
};