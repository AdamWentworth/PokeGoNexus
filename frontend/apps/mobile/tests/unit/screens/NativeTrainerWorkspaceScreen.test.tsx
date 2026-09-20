import { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { NativeTrainerWorkspace } from '../../../src/components/NativeTrainerWorkspaceNav';
import { NativeTrainerWorkspaceScreen } from '../../../src/screens/NativeTrainerWorkspaceScreen';

const Draft = ({ name }: { name: string }) => {
  const [text, setText] = useState('');
  return <TextInput accessibilityLabel={name} onChangeText={setText} value={text} />;
};
const Workspace = ({ initial = 'profile' }: { initial?: NativeTrainerWorkspace }) => {
  const [active, setActive] = useState<NativeTrainerWorkspace>(initial);
  return <SafeAreaProvider initialMetrics={{
    frame: { x: 0, y: 0, width: 412, height: 915 },
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
  }}>
    <NativeTrainerWorkspaceScreen
      active={active}
      friends={<Draft name="Trainer search draft" />}
      profile={<Draft name="Profile edit draft" />}
      username="Trainer"
      onBack={jest.fn()}
      onChange={setActive}
    />
  </SafeAreaProvider>;
};

describe('NativeTrainerWorkspaceScreen', () => {
  it('retains both drafts and the header while alternating panels, with only the active panel accessible', async () => {
    const view = render(<Workspace />);
    await act(async () => Promise.resolve());
    const header = view.getByTestId('native-trainer-workspace-header');
    const indicator = view.getByTestId('native-trainer-workspace-indicator');
    fireEvent.changeText(view.getByLabelText('Profile edit draft'), 'Unsubmitted trainer name');
    fireEvent.press(view.getByRole('tab', { name: 'Friends' }));
    fireEvent.changeText(view.getByLabelText('Trainer search draft'), 'Misty');

    for (let index = 0; index < 5; index += 1) {
      fireEvent.press(view.getByRole('tab', { name: 'Profile' }));
      expect(view.getByLabelText('Profile edit draft').props.value).toBe('Unsubmitted trainer name');
      expect(view.queryByLabelText('Trainer search draft')).toBeNull();
      fireEvent.press(view.getByRole('tab', { name: 'Friends' }));
      expect(view.getByLabelText('Trainer search draft').props.value).toBe('Misty');
      expect(view.queryByLabelText('Profile edit draft')).toBeNull();
    }
    expect(view.getByLabelText('Profile edit draft', { includeHiddenElements: true }).props.value).toBe('Unsubmitted trainer name');
    expect(view.getByTestId('native-trainer-workspace-header')).toBe(header);
    expect(view.getByTestId('native-trainer-workspace-indicator')).toBe(indicator);
  });

  it('opens directly on Friends while retaining a ready Profile panel', async () => {
    const view = render(<Workspace initial="friends" />);
    await act(async () => Promise.resolve());
    expect(view.getByLabelText('Trainer search draft')).toBeTruthy();
    expect(view.queryByLabelText('Profile edit draft')).toBeNull();
    expect(view.getByLabelText('Profile edit draft', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(view.getByRole('tab', { name: 'Profile' }));
    expect(view.getByLabelText('Profile edit draft')).toBeTruthy();
  });
});
