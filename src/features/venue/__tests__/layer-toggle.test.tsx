// The layer toggle reads as words to a screen reader: "Level 3, 3 matches", not the badge's bare
// "Level 3 3", while a chip is on; just "Level 3" without one.
import { describe, expect, it, jest } from '@jest/globals';
import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import i18n from '@/i18n';
import { resources } from '@/i18n/locales';

import { layerCountLabel } from '../labels';
import { LayerToggle } from '../layer-toggle';
import { getVenue } from '../mock';
import { layerById, mapLayers, venueMapFor } from '../venue-maps';

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async () => null, setItem: async () => {} } }));

const map = venueMapFor(getVenue('sofi')!);
const level3 = layerById(map, 'level-3');
const outside = layerById(map, 'outside');
const LANGS = Object.keys(resources) as (keyof typeof resources)[];

const radios = (c: TestInstance) => c.queryAll(n => n.props.accessibilityRole === 'radio');

describe('layer toggle labels', () => {
  it('says the layer and its matches in English: none, one, several', () => {
    const en = i18n.getFixedT('en', 'venue');
    expect(layerCountLabel(outside, 0, en)).toBe('Outside, no matches');
    expect(layerCountLabel(level3, 1, en)).toBe('Level 3, 1 match');
    expect(layerCountLabel(level3, 3, en)).toBe('Level 3, 3 matches');
    expect(layerCountLabel(level3, undefined, en)).toBe('Level 3'); // no chip
  });

  it('has the words in every language, in its own digits', () => {
    for (const lng of LANGS) {
      const t = i18n.getFixedT(lng, 'venue');
      for (const n of [0, 1, 2, 3, 5, 11, 21]) {
        const label = layerCountLabel(level3, n, t);
        const ok = !label.includes('map.layers') && !label.includes('{{') && label.includes(layerCountLabel(level3, undefined, t)) && label !== layerCountLabel(level3, undefined, t);
        expect({ lng, n, ok }).toEqual({ lng, n, ok: true });
      }
    }
    expect(layerCountLabel(level3, 3, i18n.getFixedT('fa', 'venue'))).toContain('۳');
  });

  it('labels each button with its count only while a chip is on', async () => {
    await i18n.changeLanguage('en');
    const root = createRoot();
    const layers = mapLayers(map);
    await act(async () => { root.render(<LayerToggle layers={layers} value="outside" counts={{ outside: 0, 'level-3': 3, 'level-6': 1 }} onChange={() => {}} />); });
    expect(radios(root.container).map(r => r.props.accessibilityLabel)).toEqual(['Outside, no matches', 'Level 3, 3 matches', 'Level 6, 1 match']);
    await act(async () => { root.render(<LayerToggle layers={layers} value="outside" onChange={() => {}} />); });
    expect(radios(root.container).map(r => r.props.accessibilityLabel)).toEqual([undefined, undefined, undefined]); // read from the text: "Outside"
  });
});
