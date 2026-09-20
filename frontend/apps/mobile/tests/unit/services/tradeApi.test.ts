import type { AuthoritativeTradeProposalRequest } from '@pokemongonexus/shared-contracts/trades';
import { tradesContract } from '@pokemongonexus/shared-contracts/trades';
import {
  createNativeTradeProposal,
  deleteNativeTrade,
  getNativeTradePartnerInfo,
  getNativeTrades,
  runNativeTradeCommand,
  updateNativeTradeSatisfaction,
} from '../../../src/services/tradeApi';
import type { NativeUsersApiClient } from '../../../src/services/nativeApiClients';

const proposal: AuthoritativeTradeProposalRequest = {
  username_accepting: 'OtherTrainer',
  pokemon_instance_id_user_proposed: 'mine-1',
  pokemon_instance_id_user_accepting: 'theirs-1',
  is_special_trade: true,
  is_registered_trade: false,
  is_lucky_trade: false,
  trade_dust_cost: 40_000,
  trade_friendship_level: 5,
};

describe('native trade API', () => {
  it('loads the signed-in trainer’s canonical trades', async () => {
    const envelope = {
      trades: [{ trade_id: 'trade-1', trade_status: 'proposed' }],
      related_instances: {},
    };
    const usersClient = { get: jest.fn().mockResolvedValue(envelope) };

    await expect(getNativeTrades(usersClient)).resolves.toEqual(envelope);
    expect(usersClient.get).toHaveBeenCalledWith(tradesContract.endpoints.list);
  });

  it('submits only the authoritative proposal command payload', async () => {
    const envelope = {
      trade: { trade_id: 'trade-1', trade_status: 'proposed' },
      affected_instances: {
        'mine-1': { instance_id: 'mine-1', is_for_trade: true },
      },
    };
    const usersClient = { post: jest.fn().mockResolvedValue(envelope) };

    await expect(
      createNativeTradeProposal(usersClient, proposal),
    ).resolves.toEqual(envelope);
    expect(usersClient.post).toHaveBeenCalledWith(
      tradesContract.endpoints.create,
      proposal,
    );
    expect(usersClient.post.mock.calls[0]?.[1]).not.toHaveProperty(
      'username_proposed',
    );
    expect(usersClient.post.mock.calls[0]?.[1]).not.toHaveProperty(
      'trade_status',
    );
  });

  it('rejects malformed trade lists instead of treating them as empty', async () => {
    const usersClient = {
      get: jest.fn().mockResolvedValue({ trades: {}, related_instances: {} }),
    };

    await expect(getNativeTrades(usersClient)).rejects.toThrow(
      'trades response is invalid',
    );
  });

  it('rejects proposal responses without a committed trade id', async () => {
    const usersClient = {
      post: jest.fn().mockResolvedValue({
        trade: { trade_status: 'proposed' },
        affected_instances: {},
      }),
    };

    await expect(
      createNativeTradeProposal(usersClient, proposal),
    ).rejects.toThrow('proposal response is invalid');
  });

  it.each([
    ['accept', tradesContract.endpoints.accept('trade/1')],
    ['deny', tradesContract.endpoints.deny('trade/1')],
    ['cancel', tradesContract.endpoints.cancel('trade/1')],
    ['complete', tradesContract.endpoints.complete('trade/1')],
    ['repropose', tradesContract.endpoints.repropose('trade/1')],
  ] as const)('runs the %s command against its encoded endpoint', async (command, endpoint) => {
    const envelope = {
      trade: { trade_id: 'trade/1', trade_status: 'pending' },
      affected_instances: {},
    };
    const usersClient = { post: jest.fn().mockResolvedValue(envelope) };

    await expect(
      runNativeTradeCommand(usersClient, command, 'trade/1'),
    ).resolves.toEqual(envelope);
    expect(usersClient.post).toHaveBeenCalledWith(endpoint);
  });

  it('updates satisfaction with the bounded command payload', async () => {
    const envelope = {
      trade: { trade_id: 'trade-1', trade_status: 'completed' },
      affected_instances: {},
    };
    const usersClient = { put: jest.fn().mockResolvedValue(envelope) };

    await expect(
      updateNativeTradeSatisfaction(usersClient, 'trade-1', true),
    ).resolves.toEqual(envelope);
    expect(usersClient.put).toHaveBeenCalledWith(
      tradesContract.endpoints.satisfaction('trade-1'),
      { satisfied: true },
    );
  });

  it('reconciles a two-account accept and dual-confirmation lifecycle from authoritative envelopes', async () => {
    type Actor = 'proposer' | 'accepter';
    const state = {
      accepted: false,
      accepterConfirmed: false,
      proposerConfirmed: false,
      owners: { 'mine-1': 'proposer', 'theirs-1': 'accepter' } as Record<string, Actor>,
    };
    const requests: { actor: Actor; endpoint: string }[] = [];
    const envelope = () => {
      const completed = state.proposerConfirmed && state.accepterConfirmed;
      return {
        trade: {
          trade_id: 'trade-1',
          trade_status: completed ? 'completed' : state.accepted ? 'pending' : 'proposed',
          user_proposed_completion_confirmed: state.proposerConfirmed,
          user_accepting_completion_confirmed: state.accepterConfirmed,
        },
        affected_instances: completed ? {
          'mine-1': { instance_id: 'mine-1', user_id: state.owners['mine-1'] },
          'theirs-1': { instance_id: 'theirs-1', user_id: state.owners['theirs-1'] },
        } : {},
      };
    };
    const clientFor = (actor: Actor): Pick<NativeUsersApiClient, 'post'> => ({
      post: async <T>(endpoint: string): Promise<T> => {
        requests.push({ actor, endpoint });
        if (endpoint === tradesContract.endpoints.accept('trade-1')) {
          if (actor !== 'accepter' || state.accepted) throw new Error('invalid acceptance');
          state.accepted = true;
        } else if (endpoint === tradesContract.endpoints.complete('trade-1')) {
          if (!state.accepted) throw new Error('trade is not active');
          if (actor === 'proposer') state.proposerConfirmed = true;
          else state.accepterConfirmed = true;
          if (state.proposerConfirmed && state.accepterConfirmed) {
            state.owners['mine-1'] = 'accepter';
            state.owners['theirs-1'] = 'proposer';
          }
        }
        return envelope() as unknown as T;
      },
    });
    const proposer = clientFor('proposer');
    const accepter = clientFor('accepter');

    await expect(runNativeTradeCommand(accepter, 'accept', 'trade-1')).resolves.toEqual(
      expect.objectContaining({ trade: expect.objectContaining({ trade_status: 'pending' }) }),
    );
    const firstConfirmation = await runNativeTradeCommand(proposer, 'complete', 'trade-1');
    expect(firstConfirmation.trade).toEqual(expect.objectContaining({
      trade_status: 'pending',
      user_proposed_completion_confirmed: true,
      user_accepting_completion_confirmed: false,
    }));
    expect(firstConfirmation.affected_instances).toEqual({});

    const committed = await runNativeTradeCommand(accepter, 'complete', 'trade-1');
    expect(committed.trade).toEqual(expect.objectContaining({
      trade_status: 'completed',
      user_proposed_completion_confirmed: true,
      user_accepting_completion_confirmed: true,
    }));
    expect(committed.affected_instances).toEqual({
      'mine-1': expect.objectContaining({ user_id: 'accepter' }),
      'theirs-1': expect.objectContaining({ user_id: 'proposer' }),
    });
    expect(requests).toEqual([
      { actor: 'accepter', endpoint: tradesContract.endpoints.accept('trade-1') },
      { actor: 'proposer', endpoint: tradesContract.endpoints.complete('trade-1') },
      { actor: 'accepter', endpoint: tradesContract.endpoints.complete('trade-1') },
    ]);
  });

  it('deletes a terminal trade through the canonical endpoint', async () => {
    const usersClient = { delete: jest.fn().mockResolvedValue(undefined) };

    await expect(deleteNativeTrade(usersClient, 'trade-1')).resolves.toBeUndefined();
    expect(usersClient.delete).toHaveBeenCalledWith(
      tradesContract.endpoints.remove('trade-1'),
    );
  });

  it('validates revealed coordination information', async () => {
    const partner = {
      sharingEnabled: true,
      trainerCode: '1234 5678 9012',
      pokemonGoName: 'OtherTrainer',
      coordinationMethod: 'campfire' as const,
      coordinationHandle: 'OtherTrainer',
      location: 'Burnaby, British Columbia, Canada',
    };
    const usersClient = { get: jest.fn().mockResolvedValue(partner) };

    await expect(
      getNativeTradePartnerInfo(usersClient, 'trade-1'),
    ).resolves.toEqual(partner);
    expect(usersClient.get).toHaveBeenCalledWith(
      tradesContract.endpoints.revealPartnerInfo('trade-1'),
    );
  });

  it('rejects empty trade ids before making a command request', async () => {
    const usersClient = { post: jest.fn() };

    await expect(
      runNativeTradeCommand(usersClient, 'cancel', '   '),
    ).rejects.toThrow('Trade ID is required');
    expect(usersClient.post).not.toHaveBeenCalled();
  });
});
