import type { NativeTradeActivityActionModel } from './nativeTradeActivityModel';

export type NativeTradeActivityCommandAction = Exclude<
  NativeTradeActivityActionModel['action'],
  'coordinate'
>;

export type NativeTradeActivityCommandPorts = {
  accept: (tradeId: string) => Promise<unknown>;
  cancel: (tradeId: string) => Promise<unknown>;
  complete: (tradeId: string) => Promise<unknown>;
  deny: (tradeId: string) => Promise<unknown>;
  repropose: (tradeId: string) => Promise<unknown>;
  satisfy: (tradeId: string) => Promise<unknown>;
};

export const executeNativeTradeActivityAction = async (
  tradeId: string,
  action: NativeTradeActivityCommandAction,
  commands: NativeTradeActivityCommandPorts,
): Promise<void> => {
  await commands[action](tradeId);
};
