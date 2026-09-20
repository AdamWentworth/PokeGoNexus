import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeCustomTagEditorSheet } from '../../../../src/features/collection/NativeCustomTagEditorSheet';

const tag = {
  tag_id: 'tag-shadow-shinies',
  parent: 'caught' as const,
  name: 'Shadow Shinies',
  color: '#7C3AED',
  sort: 0,
  created_at: '2026-08-27T00:00:00.000Z',
};

const baseProps = {
  parent: 'caught' as const,
  visible: true,
  isSaving: false,
  onClose: jest.fn(),
  onCreate: jest.fn(async () => undefined),
  onDelete: jest.fn(async () => undefined),
  onUpdate: jest.fn(async () => undefined),
};

describe('NativeCustomTagEditorSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the app confirmation dialog before deleting a tag', async () => {
    const view = render(<NativeCustomTagEditorSheet {...baseProps} tag={tag} />);

    fireEvent.press(view.getByText('Delete'));
    expect(view.getByText('Delete Shadow Shinies?')).toBeTruthy();
    expect(baseProps.onDelete).not.toHaveBeenCalled();

    const deleteLabels = view.getAllByText('Delete');
    fireEvent.press(deleteLabels[deleteLabels.length - 1]);

    await waitFor(() => expect(baseProps.onDelete).toHaveBeenCalledWith(tag.tag_id));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the editor open and presents an inline error when deletion fails', async () => {
    const onDelete = jest.fn(async () => {
      throw new Error('Delete failed safely.');
    });
    const view = render(
      <NativeCustomTagEditorSheet {...baseProps} onDelete={onDelete} tag={tag} />,
    );

    fireEvent.press(view.getByText('Delete'));
    const deleteLabels = view.getAllByText('Delete');
    fireEvent.press(deleteLabels[deleteLabels.length - 1]);

    await waitFor(() => expect(view.getByText('Delete failed safely.')).toBeTruthy());
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });
});
