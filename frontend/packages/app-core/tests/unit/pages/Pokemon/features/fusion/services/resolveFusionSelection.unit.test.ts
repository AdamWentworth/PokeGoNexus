import { describe, expect, it, vi } from 'vitest';

import { resolveFusionSelection } from '@/pages/Pokemon/features/fusion/services/resolveFusionSelection';

describe('resolveFusionSelection', () => {
  it('applies fused updates to both selected instances and resolves fuseThis', async () => {
    const updateDetails = vi.fn().mockResolvedValue(undefined);
    const resolve = vi.fn();

    await resolveFusionSelection({
      choice: 'confirmFuse',
      leftInstanceId: 'left-1',
      rightInstanceId: 'right-1',
      fusionData: { fusion_id: 999, name: 'Test Fusion' } as any,
      instances: {
        'left-1': { fusion: { 123: true } },
      } as any,
      updateDetails,
      resolve,
    });

    expect(updateDetails).toHaveBeenCalledWith({
      'left-1': {
        is_fused: true,
        fused_with: 'right-1',
        fusion_form: 'Test Fusion',
        fusion: {
          123: true,
          999: true,
        },
      },
      'right-1': {
        is_fused: true,
        fused_with: 'left-1',
        fusion_form: 'Test Fusion',
        disabled: true,
      },
    });
    expect(resolve).toHaveBeenCalledWith({ action: 'fuseThis', instanceId: 'left-1' });
  });

  it('resolves cancel and skips updates when choice is not confirmFuse', async () => {
    const updateDetails = vi.fn().mockResolvedValue(undefined);
    const resolve = vi.fn();

    await resolveFusionSelection({
      choice: 'cancel',
      leftInstanceId: 'left-1',
      rightInstanceId: 'right-1',
      fusionData: { fusion_id: 100, name: 'Unused' } as any,
      instances: {} as any,
      updateDetails,
      resolve,
    });

    expect(updateDetails).not.toHaveBeenCalled();
    expect(resolve).toHaveBeenCalledWith({ action: 'cancel', instanceId: null });
  });
});
