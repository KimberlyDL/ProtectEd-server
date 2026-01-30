const { Sequelize } = require('sequelize');
const config = require('../config/db');

const sequelize = config;

// Import models
const User = require('./User')(sequelize, Sequelize.DataTypes);
const Session = require('./Session')(sequelize, Sequelize.DataTypes);
const TokenBlacklist = require('./TokenBlacklist')(sequelize, Sequelize.DataTypes);

// Setup associations
const models = { User, Session, TokenBlacklist };

Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

// Export models and sequelize
module.exports = {
    sequelize,
    Sequelize,
    User,
    Session,
    TokenBlacklist
};