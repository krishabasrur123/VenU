// Find a Volunteer v3 (Figma 506:9816): help types are a single-choice radio list, and the note
// sits behind an "Add a note (optional)" row.
import { describe, expect, it, jest } from '@jest/globals';
import { act, useState } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import type { HelpTypeId } from '@/features/volunteer/types';

import { chosenHelpType, HelpRow } from '../help-card';
import { NoteToggle } from '../note-toggle';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('chosenHelpType', () => {
  it('is the one selected type', () => {
    expect(chosenHelpType(['directions'])).toBe('directions');
  });

  it('is null when nothing is picked', () => {
    expect(chosenHelpType([])).toBeNull();
  });

  it('takes the first in screen order from a draft saved when several could be ticked', () => {
    expect(chosenHelpType(['other', 'language', 'physical'])).toBe('physical');
  });
});

const ROWS: HelpTypeId[] = ['physical', 'directions', 'language'];

/** The form's wiring: tapping a row replaces the list with just that type. */
function List({ start = [] }: { start?: HelpTypeId[] }) {
  const [selected, setSelected] = useState<HelpTypeId[]>(start);
  const chosen = chosenHelpType(selected);
  return (
    <>
      {ROWS.map(id => <HelpRow key={id} type={id} selected={chosen === id} onPress={() => setSelected([id])} />)}
    </>
  );
}

// Host views: react-native folds aria-checked into accessibilityState, so that's what's checked here.
const radios = (c: TestInstance) => c.queryAll(n => n.type === 'View' && n.props.accessibilityRole === 'radio');
const checked = (c: TestInstance) => radios(c).filter(n => n.props.accessibilityState?.checked).map(n => n.props.accessibilityLabel);
/** A tap, the way Pressable sees a click. */
const tap = (n: TestInstance) => act(() => { n.props.onClick({ nativeEvent: {} }); });

describe('help type rows', () => {
  it('are labelled radios, none chosen at first', async () => {
    const root = createRoot();
    await act(async () => { root.render(<List />); });
    expect(radios(root.container).map(n => n.props.accessibilityLabel)).toEqual(['Physical Assistance', 'Directions', 'Language Help']);
    expect(checked(root.container)).toEqual([]);
  });

  it('keep one choice: picking another row moves the dot', async () => {
    const root = createRoot();
    await act(async () => { root.render(<List />); });
    const press = (label: string) => tap(radios(root.container).find(n => n.props.accessibilityLabel === label)!);
    press('Directions');
    expect(checked(root.container)).toEqual(['Directions']);
    press('Physical Assistance');
    expect(checked(root.container)).toEqual(['Physical Assistance']);
    // Tapping the chosen row again keeps it chosen, like a radio.
    press('Physical Assistance');
    expect(checked(root.container)).toEqual(['Physical Assistance']);
  });

  it('show only the first of an old multi-pick draft as chosen', async () => {
    const root = createRoot();
    await act(async () => { root.render(<List start={['language', 'directions']} />); });
    expect(checked(root.container)).toEqual(['Directions']);
  });
});

describe('NoteToggle', () => {
  it('says whether the note box is open, and names its camera and mic buttons', async () => {
    const root = createRoot();
    const onToggle = jest.fn();
    await act(async () => {
      root.render(<NoteToggle open={false} onToggle={onToggle} onAddPicture={() => {}} onSpeak={() => {}} listening={false} />);
    });
    const buttons = root.container.queryAll(n => n.type === 'View' && n.props.accessibilityRole === 'button');
    expect(buttons.map(n => n.props.accessibilityLabel)).toEqual(['Add a note (optional)', 'Add picture', 'Speak your note']);
    const row = buttons[0]!;
    expect(row.props.accessibilityState).toMatchObject({ expanded: false });
    tap(row);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
