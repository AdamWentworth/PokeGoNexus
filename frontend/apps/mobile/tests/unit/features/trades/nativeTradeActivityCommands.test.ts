import {
  executeNativeTradeActivityAction,
  type NativeTradeActivityCommandAction,
  type NativeTradeActivityCommandPorts,
} from '../../../../src/features/trades/nativeTradeActivityCommands';

const actions: NativeTradeActivityCommandAction[] = [
  'accept',
  'deny',
  'cancel',
  'complete',
  'repropose',
  'satisfy',
];

describe('native trade activity commands', () => {
  it.each(actions)('dispatches %s only to its authoritative command', async (action) => {
    const commands = Object.fromEntries(
      actions.map((candidate) => [candidate, jest.fn().mockResolvedValue(undefined)]),
    ) as unknown as NativeTradeActivityCommandPorts;

    await executeNativeTradeActivityAction('trade-1', action, commands);

    for (const candidate of actions) {
      expect(commands[candidate]).toHaveBeenCalledTimes(candidate === action ? 1 : 0);
    }
    expect(commands[action]).toHaveBeenCalledWith('trade-1');
  });

  it('propagates command failures so the screen cannot claim success', async () => {
    const failure = new Error('Trade state changed');
    const commands = Object.fromEntries(
      actions.map((candidate) => [candidate, jest.fn().mockResolvedValue(undefined)]),
    ) as unknown as NativeTradeActivityCommandPorts;
    commands.cancel = jest.fn().mockRejectedValue(failure);

    await expect(executeNativeTradeActivityAction('trade-1', 'cancel', commands))
      .rejects.toBe(failure);
  });
});
