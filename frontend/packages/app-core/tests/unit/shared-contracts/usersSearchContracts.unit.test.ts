import { describe, expect, it } from 'vitest';
import { usersContract } from '@shared-contracts/users';
import { searchContract } from '@shared-contracts/search';
import { authContract } from '@shared-contracts/auth';
import { tradesContract } from '@shared-contracts/trades';
import { locationContract } from '@shared-contracts/location';
import { eventsContract } from '@shared-contracts/events';
import { pokemonContract } from '@shared-contracts/pokemon';
import { receiverContract } from '@shared-contracts/receiver';

describe('shared contracts', () => {
  it('builds users endpoints with canonical lowercase username', () => {
    const path = usersContract.endpoints.instancesByUsername('ChernoB8ta');
    expect(path).toBe('/instances/by-username/chernob8ta');
  });

  it('encodes query values for trainer autocomplete', () => {
    const path = usersContract.endpoints.autocompleteTrainers('ash k');
    expect(path).toBe('/autocomplete-trainers?q=ash%20k');
  });

  it('exposes stable search endpoint path', () => {
    expect(searchContract.endpoints.searchPokemon).toBe('/searchPokemon');
  });

  it('builds users overview/update endpoints', () => {
    expect(usersContract.endpoints.userOverview('663d6760537fa61b79ac8bab')).toBe(
      '/users/663d6760537fa61b79ac8bab/overview',
    );
    expect(usersContract.endpoints.updateUser('663d6760537fa61b79ac8bab')).toBe(
      '/update-user/663d6760537fa61b79ac8bab',
    );
  });

  it('builds auth endpoints with encoded user ids', () => {
    expect(authContract.endpoints.register).toBe('/register');
    expect(authContract.endpoints.login).toBe('/login');
    expect(authContract.endpoints.logout).toBe('/logout');
    expect(authContract.endpoints.refresh).toBe('/refresh');
    expect(authContract.endpoints.mobileLogin).toBe('/mobile/login');
    expect(authContract.endpoints.mobileRefresh).toBe('/mobile/refresh');
    expect(authContract.endpoints.mobileLogout).toBe('/mobile/logout');
    expect(authContract.endpoints.resetPassword).toBe('/reset-password');
    expect(authContract.endpoints.updateUser('u/1')).toBe('/update/u%2F1');
    expect(authContract.endpoints.deleteUser('u/1')).toBe('/delete/u%2F1');
    expect(authContract.endpoints.accountSecurity).toBe('/account/security');
    expect(authContract.endpoints.revokeAllSessions).toBe('/sessions/revoke-all');
    expect(authContract.endpoints.requestEmailChange).toBe('/email-change');
    expect(authContract.endpoints.confirmEmailChange).toBe('/email-change/confirm');
    expect(authContract.endpoints.unlinkProvider('discord')).toBe(
      '/account/identities/discord',
    );
  });

  it('exposes stable trades/location/events/pokemon endpoints', () => {
    expect(tradesContract.endpoints.revealPartnerInfo('trade/1')).toBe(
      '/trades/trade%2F1/partner',
    );
    expect(locationContract.endpoints.autocomplete).toBe('/autocomplete');
    expect(locationContract.endpoints.reverse).toBe('/reverse');
    expect(eventsContract.endpoints.getUpdates).toBe('/getUpdates');
    expect(eventsContract.endpoints.sse).toBe('/sse');
    expect(pokemonContract.endpoints.pokemons).toBe('/pokemons');
    expect(receiverContract.endpoints.batchedUpdates).toBe('/batchedUpdates');
  });
});
