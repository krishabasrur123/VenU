import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { emptyFacilitiesMessage, facilityIconXml } from '../categories';

describe('facilityIconXml', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('crops the sheet to one glyph and paints its details', () => {
    const xml = facilityIconXml('gate', '#123456');
    expect(xml).toContain('viewBox="135.5 1.5 32 32"');
    expect(xml).toContain('"#123456"');
    expect(xml).not.toContain('="white"');
  });

  it('builds each (category, background) once and reuses it', () => {
    const replace = jest.spyOn(String.prototype, 'replace');
    const first = facilityIconXml('restroom', '#abcdef');
    const built = replace.mock.calls.length;
    expect(built).toBeGreaterThan(0);
    for (let i = 0; i < 26; i++) expect(facilityIconXml('restroom', '#abcdef')).toBe(first);
    expect(replace.mock.calls.length).toBe(built);
    facilityIconXml('restroom', '#000000'); // another background is its own entry
    expect(replace.mock.calls.length).toBeGreaterThan(built);
  });
});

describe('emptyFacilitiesMessage', () => {
  it('names the search and the category', () => {
    expect(emptyFacilitiesMessage('restroom', ' xyz ', 'SoFi Stadium')).toBe('No restrooms match “xyz”');
    expect(emptyFacilitiesMessage(null, 'xyz', 'SoFi Stadium')).toBe('No facilities match “xyz”');
  });

  it('says when a category has nothing at this venue', () => {
    expect(emptyFacilitiesMessage('parking', '', 'Crypto.com Arena')).toBe('No parking lots at Crypto.com Arena yet');
    expect(emptyFacilitiesMessage(null, '  ', 'Intuit Dome')).toBe('No facilities at Intuit Dome yet');
  });
});
