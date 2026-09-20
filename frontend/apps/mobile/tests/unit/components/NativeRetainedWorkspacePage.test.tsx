import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { NativeRetainedWorkspacePage } from '../../../src/components/NativeRetainedWorkspacePage';

test('opens a tool on first visit and preserves its draft across later visits', () => {
  const mounted = jest.fn();
  const Tool = () => {
    const [draft, setDraft] = useState(() => { mounted(); return ''; });
    return <TextInput accessibilityLabel="Draft" onChangeText={setDraft} value={draft} />;
  };
  const Page = ({ active }: { active: boolean }) => <NativeRetainedWorkspacePage active={active}><Tool /></NativeRetainedWorkspacePage>;
  const view = render(<Page active={false} />);
  expect(mounted).not.toHaveBeenCalled();
  view.rerender(<Page active />);
  fireEvent.changeText(view.getByLabelText('Draft'), 'My team');
  view.rerender(<Page active={false} />);
  view.rerender(<Page active />);
  expect(view.getByLabelText('Draft').props.value).toBe('My team');
  expect(mounted).toHaveBeenCalledTimes(1);
});
