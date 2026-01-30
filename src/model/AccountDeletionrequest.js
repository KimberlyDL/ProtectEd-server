// models/AccountDeletionRequest.js
module.exports = (sequelize, DataTypes) => {
    const AccountDeletionRequest = sequelize.define('AccountDeletionRequest', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        scheduled_deletion_date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'cancelled', 'completed'),
            defaultValue: 'pending',
            allowNull: false
        },
        requested_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        completed_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'AccountDeletionRequests',
        createdAt: 'created_at',
        updatedAt: false
    });

    // Associations
    AccountDeletionRequest.associate = function (models) {
        AccountDeletionRequest.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
    };

    // Static methods
    AccountDeletionRequest.createRequest = async function (userId, reason = null) {
        // Check if there's already a pending request
        const existing = await this.findOne({
            where: {
                user_id: userId,
                status: 'pending'
            }
        });

        if (existing) {
            throw new Error('A deletion request is already pending for this account');
        }

        // Calculate deletion date (30 days from now)
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 30);

        return await this.create({
            user_id: userId,
            reason: reason,
            scheduled_deletion_date: scheduledDate,
            status: 'pending',
            requested_at: new Date()
        });
    };

    AccountDeletionRequest.findPendingRequest = async function (userId) {
        return await this.findOne({
            where: {
                user_id: userId,
                status: 'pending'
            }
        });
    };

    AccountDeletionRequest.findDueForDeletion = async function () {
        return await this.findAll({
            where: {
                status: 'pending',
                scheduled_deletion_date: {
                    [sequelize.Sequelize.Op.lte]: new Date()
                }
            },
            include: [{
                model: sequelize.models.User,
                as: 'user'
            }]
        });
    };

    // Instance methods
    AccountDeletionRequest.prototype.cancel = async function () {
        if (this.status !== 'pending') {
            throw new Error('Only pending deletion requests can be cancelled');
        }

        this.status = 'cancelled';
        await this.save();
    };

    AccountDeletionRequest.prototype.complete = async function () {
        if (this.status !== 'pending') {
            throw new Error('Only pending deletion requests can be completed');
        }

        this.status = 'completed';
        this.completed_at = new Date();
        await this.save();
    };

    AccountDeletionRequest.prototype.getDaysRemaining = function () {
        if (this.status !== 'pending') return 0;

        const now = new Date();
        const scheduledDate = new Date(this.scheduled_deletion_date);
        const diffTime = scheduledDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return Math.max(0, diffDays);
    };

    AccountDeletionRequest.prototype.canBeCancelled = function () {
        return this.status === 'pending';
    };

    return AccountDeletionRequest;
};