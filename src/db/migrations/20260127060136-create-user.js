'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: true // Nullable for OAuth users
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      role: {
        type: Sequelize.STRING(50),
        defaultValue: 'player',
        allowNull: false
      },
      avatar_url: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      provider_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      email_verified_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      password_changed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Track password changes to invalidate old tokens'
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

    // Indexes
    await queryInterface.addIndex('Users', ['email']);
    await queryInterface.addIndex('Users', ['provider_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('Users');
  }
};