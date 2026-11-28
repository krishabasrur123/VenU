// Finding a Volunteer (Figma 554:5535) says where the visitor waits, what they asked for, "Help in:"
// the request's language as a chip, and their note in quotes; the volunteer chips (home, Profile)
// colour trainings by kind.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { StyleSheet } from 'react-native';
import { createRoot, type TestInstance } from 'test-renderer';

import { Colors } from '@/constants/theme';
import type { HelpRequest } from '@/features/volunteer/types';
import i18n from '@/i18n';

import { RequestSummary } from '../searching-view';
import { TrainingChips } from '../skill-chips';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const texts = (c: TestInstance) => c.queryAll(n => n.type === 'Text').map(n => [n.props.children].flat().join(''));

const REQUEST: HelpRequest = {
  id: 'r1',
  visitorName: 'Rosa',
  helpTypes: ['physical'],
  note: 'I’m stuck near a ramp',
  photoUri: null,
  language: 'vi',
  location: { venueId: 'sofi', facilityId: 'entry-4' },
  createdAt: 0,
};

async function render(node: React.ReactElement) {
  const root = createRoot();
  await act(async () => { root.render(node); });
  return root.container;
}

describe('RequestSummary', () => {
  beforeEach(async () => { await act(async () => { await i18n.changeLanguage('en'); }); });

  it('shows the spot, the help type, "Help in:" with the request’s language, and the note', async () => {
    const c = await render(<RequestSummary request={REQUEST} />);
    expect(texts(c)).toEqual([
      'Near Entry 4',
      'SoFi Stadium',
      'You asked for',
      'Physical Assistance',
      'Help in:',
      'Vietnamese',
      '“I’m stuck near a ramp”',
    ]);
  });

  it('leaves the note out when there is none, and names the language in the app language', async () => {
    await act(async () => { await i18n.changeLanguage('es'); });
    const c = await render(<RequestSummary request={{ ...REQUEST, note: '', location: { venueId: 'sofi', facilityId: null } }} />);
    expect(texts(c)).toEqual(['SoFi Stadium', 'Pediste', 'Asistencia física', 'Ayuda en:', 'vietnamita']);
  });
});

describe('TrainingChips', () => {
  it('labels each training as the app does, green for getting around and orange for care', async () => {
    await act(async () => { await i18n.changeLanguage('en'); });
    const c = await render(<TrainingChips trainings={['wheelchair', 'first_aid']} />);
    const chips = c.queryAll(n => n.type === 'Text').map(n => ({ label: n.props.children, bg: StyleSheet.flatten(n.props.style).backgroundColor }));
    expect(chips).toEqual([
      { label: 'Wheelchair trained', bg: Colors.successStrong },
      { label: 'First aid', bg: Colors.warning },
    ]);
  });
});
