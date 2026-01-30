// const { Sequelize } = require('sequelize');
// const config = require('../config/db');

// const sequelize = config;

// // Import models
// const User = require('./User')(sequelize, Sequelize.DataTypes);
// const Session = require('./Session')(sequelize, Sequelize.DataTypes);
// const TokenBlacklist = require('./TokenBlacklist')(sequelize, Sequelize.DataTypes);

// // Setup associations
// const models = { User, Session, TokenBlacklist };

// Object.keys(models).forEach(modelName => {
//     if (models[modelName].associate) {
//         models[modelName].associate(models);
//     }
// });

// // Export models and sequelize
// module.exports = {
//     sequelize,
//     Sequelize,
//     User,
//     Session,
//     TokenBlacklist
// };


// src/model/index.js
const { Sequelize } = require('sequelize');
const config = require('../config/db');

const sequelize = config;

// 1. Import ALL models
const User = require('./User')(sequelize, Sequelize.DataTypes);
const Session = require('./Session')(sequelize, Sequelize.DataTypes);
const TokenBlacklist = require('./TokenBlacklist')(sequelize, Sequelize.DataTypes);
const UserProfile = require('./UserProfile')(sequelize, Sequelize.DataTypes);
const UserGuardian = require('./UserGuardian')(sequelize, Sequelize.DataTypes);
const UserPrivacySettings = require('./UserPrivacySettings')(sequelize, Sequelize.DataTypes);
const UserNotificationPreferences = require('./UserNotificationPreferences')(sequelize, Sequelize.DataTypes);
const AccountDeletionRequest = require('./AccountDeletionrequest')(sequelize, Sequelize.DataTypes);
const File = require('./File')(sequelize, Sequelize.DataTypes);
// 2. Add them to the models object so associations can find them
const models = { 
    User, 
    Session, 
    TokenBlacklist, 
    UserProfile, 
    UserGuardian, 
    UserPrivacySettings, 
    UserNotificationPreferences, 
    AccountDeletionRequest,
    File 
};

// 3. Execute associations
Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

module.exports = {
    sequelize,
    Sequelize,
    ...models // Export everything
};