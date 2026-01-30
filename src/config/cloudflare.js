const { S3Client } = require('@aws-sdk/client-s3');

// Initialize the Cloudflare R2 client globally
const r2Client = new S3Client({
    region: 'auto', // R2 requires 'auto'
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

module.exports = {
    r2Client,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL
};