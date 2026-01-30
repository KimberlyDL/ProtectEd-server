const { Sequelize } = require('sequelize');
require('dotenv').config();

// 1. Define the configuration object
const config = {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || null,
    database: process.env.DB_NAME || 'capstone_db',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql',
    logging: false,
    // Add production pool settings here if needed
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};

// 2. Initialize the Sequelize instance
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
);

// 3. Export logic:
// For the CLI, it expects an object with 'development', 'test', etc.
// For your App, it needs the 'sequelize' instance.
// We attach the environment keys to the instance so the CLI can find them.

sequelize.development = config;
sequelize.production = config;
sequelize.test = config;

module.exports = sequelize;