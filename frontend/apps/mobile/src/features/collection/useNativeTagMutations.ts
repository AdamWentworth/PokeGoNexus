import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type {
  CreateCustomTagRequest,
  CustomTagParent,
  PokemonTagOrderKey,
  UpdateCustomTagRequest,
} from '@pokemongonexus/shared-contracts/users';
import {
  createNativeCustomTag,
  deleteNativeCustomTag,
  updateNativeCustomTag,
  updateNativePokemonTagOrder,
} from '../../services/nativeTagApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { nativeCollectionQueryKeys } from './collectionQueries';

export const useNativeTagMutations = (userId: string) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  const refresh = useCallback(
    () => queryClient.invalidateQueries({
      queryKey: nativeCollectionQueryKeys.snapshot(userId),
    }),
    [queryClient, userId],
  );

  const create = useMutation({
    mutationFn: (request: CreateCustomTagRequest) =>
      createNativeCustomTag(clients.users, request),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ tagId, request }: { tagId: string; request: UpdateCustomTagRequest }) =>
      updateNativeCustomTag(clients.users, tagId, request),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (tagId: string) => deleteNativeCustomTag(clients.users, tagId),
    onSuccess: refresh,
  });
  const reorder = useMutation({
    mutationFn: ({ parent, tagKeys }: { parent: CustomTagParent; tagKeys: PokemonTagOrderKey[] }) =>
      updateNativePokemonTagOrder(clients.users, { parent, tag_keys: tagKeys }),
    onSuccess: refresh,
  });
  const updateMutation = update.mutateAsync;
  const reorderMutation = reorder.mutateAsync;
  const updateTag = useCallback(
    (tagId: string, request: UpdateCustomTagRequest) =>
      updateMutation({ tagId, request }),
    [updateMutation],
  );
  const saveOrder = useCallback(
    (parent: CustomTagParent, tagKeys: PokemonTagOrderKey[]) =>
      reorderMutation({ parent, tagKeys }),
    [reorderMutation],
  );

  return {
    createTag: create.mutateAsync,
    updateTag,
    deleteTag: remove.mutateAsync,
    saveOrder,
    isPending: create.isPending || update.isPending || remove.isPending || reorder.isPending,
  };
};
