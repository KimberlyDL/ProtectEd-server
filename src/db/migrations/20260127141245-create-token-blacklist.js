'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('TokenBlacklist', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      jti: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
        comment: 'JWT ID to blacklist'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this entry can be removed'
      },
      reason: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Why token was blacklisted'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Indexes
    await queryInterface.addIndex('TokenBlacklist', ['jti']);
    await queryInterface.addIndex('TokenBlacklist', ['user_id']);
    await queryInterface.addIndex('TokenBlacklist', ['expires_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('TokenBlacklist');
  }
};