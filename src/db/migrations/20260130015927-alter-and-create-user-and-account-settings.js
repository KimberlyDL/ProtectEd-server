'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add new columns to Users table
    await queryInterface.addColumn('Users', 'is_profile_public', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Whether the user profile is publicly viewable'
    });

    await queryInterface.addColumn('Users', 'account_status', {
      type: Sequelize.ENUM('active', 'deactivated', 'deleted'),
      defaultValue: 'active',
      allowNull: false,
      comment: 'Current status of the user account'
    });

    await queryInterface.addColumn('Users', 'deactivated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the account was deactivated'
    });

    // 2. Create UserProfiles table
    await queryInterface.createTable('UserProfiles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      display_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Public display name'
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User bio (max 500 chars)'
      },
      date_of_birth: {
        type: Sequelize.DATE,
        allowNull: true
      },
      sex: {
        type: Sequelize.ENUM('male', 'female', 'prefer_not_to_say'),
        allowNull: true
      },
      gender_identity: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      address_line1: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      address_line2: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      province: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      country: {
        type: Sequelize.STRING(100),
        defaultValue: 'Philippines',
        allowNull: false
      },
      emergency_contact_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      emergency_contact_relationship: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      emergency_contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
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

    // 3. Create UserGuardians table
    await queryInterface.createTable('UserGuardians', {
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
      guardian_type: {
        type: Sequelize.ENUM('parent', 'legal_guardian', 'other'),
        allowNull: false
      },
      full_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      relationship: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
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

    // 4. Create UserPrivacySettings table
    await queryInterface.createTable('UserPrivacySettings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      profile_visibility: {
        type: Sequelize.ENUM('public', 'private'),
        defaultValue: 'private',
        allowNull: false
      },
      show_achievements: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      show_progress: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      allow_messages: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
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

    // 5. Create UserNotificationPreferences table
    await queryInterface.createTable('UserNotificationPreferences', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      email_notifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      module_reminders: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      achievement_alerts: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      safety_alerts: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'VAWC safety alerts - should not be disabled'
      },
      platform_updates: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
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

    // 6. Create AccountDeletionRequests table
    await queryInterface.createTable('AccountDeletionRequests', {
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
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      scheduled_deletion_date: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: '30 days from request date'
      },
      status: {
        type: Sequelize.ENUM('pending', 'cancelled', 'completed'),
        defaultValue: 'pending',
        allowNull: false
      },
      requested_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('UserProfiles', ['user_id']);
    await queryInterface.addIndex('UserGuardians', ['user_id']);
    await queryInterface.addIndex('UserGuardians', ['is_primary']);
    await queryInterface.addIndex('UserPrivacySettings', ['user_id']);
    await queryInterface.addIndex('UserNotificationPreferences', ['user_id']);
    await queryInterface.addIndex('AccountDeletionRequests', ['user_id']);
    await queryInterface.addIndex('AccountDeletionRequests', ['status']);
    await queryInterface.addIndex('AccountDeletionRequests', ['scheduled_deletion_date']);
  },

  down: async (queryInterface) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('AccountDeletionRequests');
    await queryInterface.dropTable('UserNotificationPreferences');
    await queryInterface.dropTable('UserPrivacySettings');
    await queryInterface.dropTable('UserGuardians');
    await queryInterface.dropTable('UserProfiles');

    // Remove columns from Users table
    await queryInterface.removeColumn('Users', 'deactivated_at');
    await queryInterface.removeColumn('Users', 'account_status');
    await queryInterface.removeColumn('Users', 'is_profile_public');
  }
};