const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const Session = sequelize.define('Session', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        jti: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true
        },
        refresh_token_hash: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        device_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        last_activity: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        revoked_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'Sessions'
    });

    // Associations
    Session.associate = function (models) {
        Session.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    // Instance methods
    Session.prototype.isActive = function () {
        if (this.revoked_at) return false;
        if (this.expires_at < new Date()) return false;
        return true;
    };

    Session.prototype.revoke = async function () {
        this.revoked_at = new Date();
        await this.save();
    };

    Session.prototype.validateRefreshToken = async function (token) {
        if (!this.refresh_token_hash) return false;
        return await bcrypt.compare(token, this.refresh_token_hash);
    };

    Session.prototype.updateActivity = async function () {
        this.last_activity = new Date();
        await this.save();
    };

    // Static methods
    Session.findActiveSession = async function (jti) {
        const session = await this.findOne({
            where: { jti, revoked_at: null },
            include: [{
                model: sequelize.models.User,
                as: 'user'
            }]
        });

        if (!session) return null;
        if (!session.isActive()) return null;

        return session;
    };

    Session.revokeAllUserSessions = async function (userId) {
        await this.update(
            { revoked_at: new Date() },
            { where: { user_id: userId, revoked_at: null } }
        );
    };

    Session.cleanupExpired = async function () {
        const now = new Date();
        await this.destroy({
            where: {
                expires_at: { [sequelize.Sequelize.Op.lt]: now }
            }
        });
    };

    return Session;
};