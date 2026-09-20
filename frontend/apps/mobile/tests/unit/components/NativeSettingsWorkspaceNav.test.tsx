import { fireEvent, render } from '@testing-library/react-native';
import { NativeSettingsWorkspaceNav } from '../../../src/components/NativeSettingsWorkspaceNav';

describe('NativeSettingsWorkspaceNav', () => {
  it('marks the current workspace and opens the other settings page', () => {
    const onOpenAccount = jest.fn();
    const view = render(
      <NativeSettingsWorkspaceNav active="settings" onOpenAccount={onOpenAccount} onOpenSettings={jest.fn()} />,
    );
    expect(view.getByRole('tab', { name: 'Settings' }).props.accessibilityState.selected).toBe(true);
    fireEvent.press(view.getByRole('tab', { name: 'Account' }));
    expect(onOpenAccount).toHaveBeenCalledTimes(1);
  });
});
