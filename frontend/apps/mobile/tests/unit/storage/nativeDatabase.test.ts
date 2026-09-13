import { createNativeDatabase } from '../../../src/storage/nativeDatabase';

const released = (method = 'NativeDatabase.prepareAsync') => new Error(
  `Call to function '${method}' has been rejected. The 1st argument cannot be cast to NativeDatabase. Cannot use shared object that was already released`,
);
const connection = () => ({
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 1 }),
  getFirstAsync: jest.fn().mockResolvedValue({ user_id: 'owner', payload_json: 'queued' }),
  getAllAsync: jest.fn().mockResolvedValue([]),
});

describe('shared native database recovery', () => {
  it('shares one connection and one stable facade across stores', async () => {
    const open = jest.fn().mockResolvedValue(connection());
    const getDatabase = createNativeDatabase(open);
    const [first, second] = await Promise.all([getDatabase(), getDatabase()]);
    expect(first).toBe(second);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('recovers concurrent reads and writes once without losing their parameters', async () => {
    const old = connection();
    const fresh = connection();
    old.getFirstAsync.mockRejectedValue(released());
    old.runAsync.mockRejectedValue(released());
    const open = jest.fn().mockResolvedValueOnce(old).mockResolvedValue(fresh);
    const database = await createNativeDatabase(open)();
    const [row] = await Promise.all([
      database.getFirstAsync('SELECT payload_json WHERE user_id = ?', ['owner']),
      database.runAsync('UPDATE outbox SET attempts = attempts + 1 WHERE user_id = ?', ['owner']),
    ]);
    expect(open).toHaveBeenCalledTimes(2);
    expect(row).toEqual({ user_id: 'owner', payload_json: 'queued' });
    expect(fresh.runAsync).toHaveBeenCalledTimes(1);
    expect(fresh.runAsync).toHaveBeenCalledWith('UPDATE outbox SET attempts = attempts + 1 WHERE user_id = ?', ['owner']);
    expect(fresh.getFirstAsync).toHaveBeenCalledWith('SELECT payload_json WHERE user_id = ?', ['owner']);
  });

  it('keeps the replacement when an older operation rejects late', async () => {
    const old = connection();
    const fresh = connection();
    let rejectOld!: (error: Error) => void;
    old.getFirstAsync.mockImplementation(() => new Promise((_, reject) => { rejectOld = reject; }));
    old.runAsync.mockRejectedValue(released());
    const open = jest.fn().mockResolvedValueOnce(old).mockResolvedValue(fresh);
    const database = await createNativeDatabase(open)();
    const read = database.getFirstAsync('SELECT 1', []);
    await database.runAsync('INSERT', []);
    rejectOld(released());
    await read;
    await database.getAllAsync('SELECT 2');
    expect(open).toHaveBeenCalledTimes(2);
    expect(fresh.getAllAsync).toHaveBeenCalledWith('SELECT 2', undefined);
  });

  it.each(['NativeStatement.executeAsync', 'NativeStatement.finalizeAsync', 'NativeDatabase.runAsync'])(
    'does not replay potentially committed writes rejected by %s', async (method) => {
      const raw = connection();
      raw.runAsync.mockRejectedValue(released(method));
      const open = jest.fn().mockResolvedValue(raw);
      const database = await createNativeDatabase(open)();
      await expect(database.runAsync('INSERT', [])).rejects.toThrow(method);
      expect(raw.runAsync).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledTimes(1);
    },
  );

  it('surfaces ordinary SQL failures without retrying', async () => {
    const raw = connection();
    raw.runAsync.mockRejectedValue(new Error('UNIQUE constraint failed'));
    const open = jest.fn().mockResolvedValue(raw);
    const database = await createNativeDatabase(open)();
    await expect(database.runAsync('INSERT', [])).rejects.toThrow('UNIQUE');
    expect(raw.runAsync).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('bounds recovery to one retry and allows a later call to reopen', async () => {
    const raw = connection();
    raw.execAsync.mockRejectedValue(released('NativeDatabase.execAsync'));
    const open = jest.fn().mockResolvedValue(raw);
    const database = await createNativeDatabase(open)();
    await expect(database.execAsync('CREATE TABLE')).rejects.toThrow('already released');
    expect(open).toHaveBeenCalledTimes(2);
    const fresh = connection();
    open.mockResolvedValue(fresh);
    await database.execAsync('CREATE TABLE');
    expect(open).toHaveBeenCalledTimes(3);
  });

  it('allows a later open after an initial connection failure', async () => {
    const open = jest.fn().mockRejectedValueOnce(new Error('open failed')).mockResolvedValue(connection());
    const getDatabase = createNativeDatabase(open);
    await expect(getDatabase()).rejects.toThrow('open failed');
    await expect(getDatabase()).resolves.toBeDefined();
    expect(open).toHaveBeenCalledTimes(2);
  });
});
