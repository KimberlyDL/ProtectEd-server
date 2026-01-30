require('dotenv').config();
const http = require('http');
const app = require('./app');
const sequelize = require('./config/db');
const { scheduleCleanup } = require('./jobs/CleanupJob');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const startServer = async () => {
    try {
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ DB Connected');

        // Start cleanup job
        scheduleCleanup();
        console.log('✅ Cleanup job scheduled');

        // Start server
        server.listen(PORT, () => {
            console.log(`🚀 Server: http://localhost:${PORT}`);
            console.log(`🛠️  Env: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Boot Error:', error.message);
        process.exit(1);
    }
};

const shutdown = async (signal) => {
    console.log(`\nShutting down (${signal})...`);
    server.close(async () => {
        try {
            await sequelize.close();
            console.log('✅ Connections closed.');
            process.exit(0);
        } catch (err) {
            console.error('❌ Shutdown error:', err);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    shutdown('REJECTION');
});

startServer(); 