import { createNativeCollectionImageRevealController } from '../../../../src/features/collection/parity/nativeCollectionImageRevealController';

describe('nativeCollectionImageRevealController', () => {
  it('notifies only cards whose image eligibility changes', () => {
    const controller = createNativeCollectionImageRevealController();
    const first = jest.fn();
    const second = jest.fn();
    const fourth = jest.fn();
    const unsubscribeFirst = controller.subscribe(0, first);
    controller.subscribe(1, second);
    controller.subscribe(3, fourth);

    expect(controller.isEnabled(0)).toBe(true);
    expect(controller.getRevealState(0)).toBe(1);
    controller.setRevealCount(0);
    expect(controller.getRevealState(0)).toBe(2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(fourth).toHaveBeenCalledTimes(1);

    controller.setRevealCount(1);
    expect(controller.getRevealState(0)).toBe(1);
    expect(controller.getRevealState(1)).toBe(2);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
    expect(fourth).toHaveBeenCalledTimes(1);

    controller.setRevealCount(2);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    expect(fourth).toHaveBeenCalledTimes(1);

    controller.setRevealCount(2);
    expect(second).toHaveBeenCalledTimes(2);

    unsubscribeFirst();
    controller.setRevealCount(null);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
    expect(fourth).toHaveBeenCalledTimes(2);
  });
});
