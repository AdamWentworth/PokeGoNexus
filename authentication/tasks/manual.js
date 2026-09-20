const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env file
require('dotenv').config({ quiet: true });

const DATABASE_NAME = 'PoGo_App_Users'; // Your actual database name
const COLLECTION_NAME = 'users'; // The collection you want to back up
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017';
const BACKUP_DIRECTORY = process.env.BACKUP_DIRECTORY || path.join(__dirname, '../backups'); // Ensure this directory exists

const createBackup = () => {
    // Ensure the backup directory exists
    if (!fs.existsSync(BACKUP_DIRECTORY)) {
        fs.mkdirSync(BACKUP_DIRECTORY, { recursive: true });
        console.log(`Created backup directory: ${BACKUP_DIRECTORY}`);
    }

    const date = new Date();
    const timestamp = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getDate().toString().padStart(2, '0')}`;
    const backupPath = path.join(BACKUP_DIRECTORY, `${DATABASE_NAME}_${timestamp}.gz`);

    // Log the backup path to verify
    console.log(`Backup path: ${backupPath}`);

    const args = [
        `--uri=${DATABASE_URL}`,
        `--db=${DATABASE_NAME}`,
        `--collection=${COLLECTION_NAME}`,
        `--archive=${backupPath}`,
        '--gzip'
    ];

    console.log('Executing mongodump backup');

    // Avoid a shell so configuration values cannot become shell syntax.
    execFile('mongodump', args, (error, stdout, stderr) => {
        if (error) {
            console.error(`Backup failed: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Backup stderr: ${stderr}`);
            return;
        }
        console.log(`Backup successful: ${stdout}`);

        // Verify the file exists
        if (fs.existsSync(backupPath)) {
            console.log(`Backup created successfully at: ${backupPath}`);
        } else {
            console.error(`Backup file not found: ${backupPath}`);
        }
    });
};

// If this script is run directly, execute the backup
if (require.main === module) {
    createBackup();
}
