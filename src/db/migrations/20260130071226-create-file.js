// migrations/YYYYMMDDHHMMSS-create-file.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('files', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      // Polymorphic Association
      entity_type: {
        type: Sequelize.ENUM('user', 'announcement', 'module'),
        allowNull: false
      },
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      // The full URL (for easy access)
      file_url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      // The internal R2 path (CRITICAL for flexibility)
      file_key: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users', // Make sure your users table name matches exactly
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add index for fast lookups
    await queryInterface.addIndex('files', ['entity_type', 'entity_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('files');
  }
};