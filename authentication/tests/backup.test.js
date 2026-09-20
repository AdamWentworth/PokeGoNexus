jest.mock('child_process', () => ({
  execFile: jest.fn()
}));

jest.mock('../middlewares/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const fs = require('fs');

let createBackup;
let execFile;
let logger;

describe('authentication backups', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'mongodb://user:p@ss;touch-pwned@db.example:27017';
    process.env.BACKUP_DIRECTORY = '/tmp/pokegonexus-auth-backups';
    ({ execFile } = require('child_process'));
    logger = require('../middlewares/logger');
    createBackup = require('../tasks/backup');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readdir').mockImplementation((_directory, callback) => callback(null, []));
    execFile.mockImplementation((_file, _args, callback) => callback(null, '', ''));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DATABASE_URL;
    delete process.env.BACKUP_DIRECTORY;
  });

  test('passes database configuration as arguments without invoking a shell', () => {
    createBackup();

    expect(execFile).toHaveBeenCalledTimes(1);
    const [file, args] = execFile.mock.calls[0];
    expect(file).toBe('mongodump');
    expect(args).toEqual(expect.arrayContaining([
      '--uri=mongodb://user:p@ss;touch-pwned@db.example:27017',
      '--db=PoGo_App_Users',
      '--collection=users',
      '--gzip'
    ]));
    expect(logger.debug).toHaveBeenCalledWith('Executing mongodump backup');
    expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('p@ss'));
  });
});
