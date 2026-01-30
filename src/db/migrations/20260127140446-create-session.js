'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Sessions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      jti: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
        comment: 'JWT ID for this session'
      },
      refresh_token_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Hashed refresh token'
      },
      device_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Device identifier (e.g., Chrome on Windows)'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      last_activity: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this refresh token expires'
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this session was revoked'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Indexes for performance
    await queryInterface.addIndex('Sessions', ['user_id']);
    await queryInterface.addIndex('Sessions', ['jti']);
    await queryInterface.addIndex('Sessions', ['expires_at']);
    await queryInterface.addIndex('Sessions', ['revoked_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Sessions');
  }
};