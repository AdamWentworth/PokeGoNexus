// backup.js

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const logger = require('../middlewares/logger'); // Ensure logger is properly configured

// Load environment variables from .env file
dotenv.config({ quiet: true });

const DATABASE_NAME = 'PoGo_App_Users'; // Your actual database name
const COLLECTION_NAME = 'users'; // The collection you want to back up
const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017';
const BACKUP_DIRECTORY = process.env.BACKUP_DIRECTORY || path.join(__dirname, '../backups'); // Ensure this directory exists

/**
 * Create a database backup.
 */
const createBackup = () => {
    // Ensure the backup directory exists
    if (!fs.existsSync(BACKUP_DIRECTORY)) {
        fs.mkdirSync(BACKUP_DIRECTORY, { recursive: true });
        logger.info(`Created backup directory: ${BACKUP_DIRECTORY}`);
    }

    const date = new Date();
    const timestamp = `${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getDate().toString().padStart(2, '0')}`;
    const backupPath = path.join(BACKUP_DIRECTORY, `${DATABASE_NAME}_${timestamp}.gz`);

    // Log the backup path to verify
    logger.info(`Backup path: ${backupPath}`);

    const args = [
        `--uri=${DATABASE_URL}`,
        `--db=${DATABASE_NAME}`,
        `--collection=${COLLECTION_NAME}`,
        `--archive=${backupPath}`,
        '--gzip'
    ];

    logger.debug('Executing mongodump backup');

    // Avoid a shell so configuration values cannot become shell syntax.
    execFile('mongodump', args, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Backup failed: ${error.message}`);
        }
        if (stderr) {
            logger.error(`Backup stderr: ${stderr}`);
        }

        // Always log and verify the result, even if there was an error
        if (fs.existsSync(backupPath)) {
            logger.info(`Backup created successfully at: ${backupPath}`);
        } else {
            logger.error(`Backup file not found: ${backupPath}`);
        }

        // Ensure retention management is called no matter what
        logger.info('Starting retention management...');
        manageRetention();
    });
};

/**
 * Manage backup retention by following a Grandfather-Father-Son scheme.
 * - Daily (Son): Keep daily backups for the last 30 days
 * - Monthly (Father): Keep monthly backups (1st of each month) for 12 months
 * - Yearly (Grandfather): Keep yearly backups (1st Jan) for 5 years
 */
const manageRetention = () => {
    // Retention periods
    const dailyRetentionDays = 30;      // Keep daily backups for 30 days
    const monthlyRetentionMonths = 12;  // Keep monthly backups for 12 months
    const yearlyRetentionYears = 5;     // Keep yearly backups for 5 years

    const now = new Date();

    fs.readdir(BACKUP_DIRECTORY, (err, files) => {
        if (err) {
            logger.error(`Failed to read backup directory: ${err.message}`);
            return;
        }

        files.forEach((file) => {
            if (path.extname(file) !== '.gz') return; // Only consider .gz backups

            const match = file.match(/(\d{4})_(\d{2})_(\d{2})/);
            if (!match) {
                logger.error(`Filename does not match expected format: ${file}`);
                return;
            }

            const [_, yearStr, monthStr, dayStr] = match;
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10) - 1; // zero-based for JS months
            const day = parseInt(dayStr, 10);

            const fileDate = new Date(year, month, day);
            if (isNaN(fileDate)) {
                logger.error(`Invalid date parsed for file: ${file}`);
                return;
            }

            // Determine backup type based on date
            const isYearlyBackup = (month === 0 && day === 1);    // January 1st
            const isMonthlyBackup = (!isYearlyBackup && day === 1); 
            const isDailyBackup   = (!isYearlyBackup && !isMonthlyBackup);

            // Calculate ages
            const ageInDays = Math.floor((now - fileDate) / (1000 * 60 * 60 * 24));
            const ageInMonths = (now.getFullYear() - year) * 12 + (now.getMonth() - month);
            const ageInYears = now.getFullYear() - year;

            logger.debug(`Evaluating file: ${file}`);
            logger.debug(`Type: ${isYearlyBackup ? 'Yearly' : isMonthlyBackup ? 'Monthly' : 'Daily'}`);
            logger.debug(`Age: ${ageInDays} days, ${ageInMonths} months, ${ageInYears} years`);

            let shouldDelete = false;

            if (isDailyBackup && ageInDays > dailyRetentionDays) {
                logger.info(`Daily backup ${file} is older than ${dailyRetentionDays} days. Deleting.`);
                shouldDelete = true;
            } else if (isMonthlyBackup && ageInMonths > monthlyRetentionMonths) {
                logger.info(`Monthly backup ${file} is older than ${monthlyRetentionMonths} months. Deleting.`);
                shouldDelete = true;
            } else if (isYearlyBackup && ageInYears > yearlyRetentionYears) {
                logger.info(`Yearly backup ${file} is older than ${yearlyRetentionYears} years. Deleting.`);
                shouldDelete = true;
            } else {
                logger.info(`Backup ${file} does not meet deletion criteria.`);
            }

            if (shouldDelete) {
                deleteFile(path.join(BACKUP_DIRECTORY, file));
            }
        });
    });
};

/**
 * Delete a file and log the result.
 * @param {string} filePath - The path to the file to delete.
 */
const deleteFile = (filePath) => {
    fs.unlink(filePath, (err) => {
        if (err) {
            logger.error(`Failed to delete file: ${filePath}, Error: ${err.message}`);
        } else {
            logger.info(`Deleted old backup: ${filePath}`);
        }
    });
};

// Export the createBackup function for automatic execution in your server
module.exports = createBackup;

// If this script is run directly, execute the backup
if (require.main === module) {
    logger.info('Running backup manually...');
    createBackup();
}
