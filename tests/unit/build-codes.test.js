import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Build code encoding/decoding functions for testing
 */

// Simple build code format: character|weapon|tomes|items
// Example: knight|sword|power,health|ring,amulet

function encodeBuild(build) {
  if (!build.character || !build.weapon) {
    return null;
  }

  const parts = [
    build.character,
    build.weapon,
    (build.tomes || []).join(',') || '-',
    (build.items || []).join(',') || '-'
  ];

  return parts.join('|');
}

function decodeBuild(code) {
  if (!code || typeof code !== 'string') {
    return null;
  }

  const parts = code.split('|');
  if (parts.length !== 4) {
    return null;
  }

  const [character, weapon, tomesStr, itemsStr] = parts;

  if (!character || !weapon) {
    return null;
  }

  return {
    character,
    weapon,
    tomes: tomesStr === '-' ? [] : tomesStr.split(',').filter(Boolean),
    items: itemsStr === '-' ? [] : itemsStr.split(',').filter(Boolean)
  };
}

function encodeToBase64(build) {
  const code = encodeBuild(build);
  if (!code) return null;

  try {
    return btoa(code);
  } catch {
    return null;
  }
}

function decodeFromBase64(base64Code) {
  if (!base64Code || typeof base64Code !== 'string') {
    return null;
  }

  try {
    const code = atob(base64Code);
    return decodeBuild(code);
  } catch {
    return null;
  }
}

function encodeToJSON(build) {
  if (!build.character || !build.weapon) {
    return null;
  }

  return JSON.stringify({
    c: build.character,
    w: build.weapon,
    t: build.tomes || [],
    i: build.items || []
  });
}

function decodeFromJSON(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') {
    return null;
  }

  try {
    const data = JSON.parse(jsonStr);
    if (!data.c || !data.w) {
      return null;
    }
    return {
      character: data.c,
      weapon: data.w,
      tomes: Array.isArray(data.t) ? data.t : [],
      items: Array.isArray(data.i) ? data.i : []
    };
  } catch {
    return null;
  }
}

function validateBuildCode(build, allData) {
  const errors = [];

  // Check character exists
  if (!allData.characters?.characters?.find(c => c.id === build.character)) {
    errors.push(`Unknown character: ${build.character}`);
  }

  // Check weapon exists
  if (!allData.weapons?.weapons?.find(w => w.id === build.weapon)) {
    errors.push(`Unknown weapon: ${build.weapon}`);
  }

  // Check tomes exist
  build.tomes?.forEach(tomeId => {
    if (!allData.tomes?.tomes?.find(t => t.id === tomeId)) {
      errors.push(`Unknown tome: ${tomeId}`);
    }
  });

  // Check items exist
  build.items?.forEach(itemId => {
    if (!allData.items?.items?.find(i => i.id === itemId)) {
      errors.push(`Unknown item: ${itemId}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function generateShareableURL(build, baseURL = 'https://megabonk.app') {
  const encoded = encodeToBase64(build);
  if (!encoded) return null;

  return `${baseURL}?build=${encodeURIComponent(encoded)}`;
}

function parseShareableURL(url) {
  try {
    const urlObj = new URL(url);
    const buildParam = urlObj.searchParams.get('build');
    if (!buildParam) return null;

    return decodeFromBase64(decodeURIComponent(buildParam));
  } catch {
    return null;
  }
}

describe('Build Code Encoding', () => {
  describe('encodeBuild()', () => {
    it('should encode complete build', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power', 'health'],
        items: ['ring', 'amulet']
      };

      const code = encodeBuild(build);

      expect(code).toBe('knight|sword|power,health|ring,amulet');
    });

    it('should encode build without tomes', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: [],
        items: ['ring']
      };

      const code = encodeBuild(build);

      expect(code).toBe('knight|sword|-|ring');
    });

    it('should encode build without items', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: []
      };

      const code = encodeBuild(build);

      expect(code).toBe('knight|sword|power|-');
    });

    it('should encode minimal build', () => {
      const build = {
        character: 'knight',
        weapon: 'sword'
      };

      const code = encodeBuild(build);

      expect(code).toBe('knight|sword|-|-');
    });

    it('should return null without character', () => {
      const build = {
        weapon: 'sword',
        tomes: ['power']
      };

      const code = encodeBuild(build);

      expect(code).toBeNull();
    });

    it('should return null without weapon', () => {
      const build = {
        character: 'knight',
        tomes: ['power']
      };

      const code = encodeBuild(build);

      expect(code).toBeNull();
    });

    it('should handle single tome', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: []
      };

      const code = encodeBuild(build);

      expect(code).toBe('knight|sword|power|-');
    });

    it('should handle many items', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: [],
        items: ['a', 'b', 'c', 'd', 'e']
      };

      const code = encodeBuild(build);

      expect(code).toBe('knight|sword|-|a,b,c,d,e');
    });
  });

  describe('decodeBuild()', () => {
    it('should decode complete build', () => {
      const code = 'knight|sword|power,health|ring,amulet';

      const build = decodeBuild(code);

      expect(build).toEqual({
        character: 'knight',
        weapon: 'sword',
        tomes: ['power', 'health'],
        items: ['ring', 'amulet']
      });
    });

    it('should decode build without tomes', () => {
      const code = 'knight|sword|-|ring';

      const build = decodeBuild(code);

      expect(build.tomes).toEqual([]);
      expect(build.items).toEqual(['ring']);
    });

    it('should decode build without items', () => {
      const code = 'knight|sword|power|-';

      const build = decodeBuild(code);

      expect(build.tomes).toEqual(['power']);
      expect(build.items).toEqual([]);
    });

    it('should decode minimal build', () => {
      const code = 'knight|sword|-|-';

      const build = decodeBuild(code);

      expect(build).toEqual({
        character: 'knight',
        weapon: 'sword',
        tomes: [],
        items: []
      });
    });

    it('should return null for invalid format', () => {
      expect(decodeBuild('invalid')).toBeNull();
      expect(decodeBuild('only|two')).toBeNull();
      expect(decodeBuild('one|two|three|four|five')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(decodeBuild(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(decodeBuild(undefined)).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(decodeBuild(123)).toBeNull();
      expect(decodeBuild({})).toBeNull();
    });

    it('should return null for missing character', () => {
      const code = '|sword|power|ring';

      expect(decodeBuild(code)).toBeNull();
    });

    it('should return null for missing weapon', () => {
      const code = 'knight||power|ring';

      expect(decodeBuild(code)).toBeNull();
    });
  });

  describe('Round-trip encoding', () => {
    it('should preserve build through encode/decode cycle', () => {
      const original = {
        character: 'mage',
        weapon: 'staff',
        tomes: ['power', 'health', 'crit'],
        items: ['ring', 'amulet', 'gloves']
      };

      const code = encodeBuild(original);
      const decoded = decodeBuild(code);

      expect(decoded).toEqual(original);
    });

    it('should preserve minimal build', () => {
      const original = {
        character: 'rogue',
        weapon: 'dagger',
        tomes: [],
        items: []
      };

      const code = encodeBuild(original);
      const decoded = decodeBuild(code);

      expect(decoded.character).toBe(original.character);
      expect(decoded.weapon).toBe(original.weapon);
      expect(decoded.tomes).toEqual(original.tomes);
      expect(decoded.items).toEqual(original.items);
    });
  });
});

describe('Base64 Encoding', () => {
  describe('encodeToBase64()', () => {
    it('should encode build to base64', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: ['ring']
      };

      const encoded = encodeToBase64(build);

      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });

    it('should return null for invalid build', () => {
      const build = { character: 'knight' }; // No weapon

      expect(encodeToBase64(build)).toBeNull();
    });
  });

  describe('decodeFromBase64()', () => {
    it('should decode base64 to build', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: ['ring']
      };

      const encoded = encodeToBase64(build);
      const decoded = decodeFromBase64(encoded);

      expect(decoded).toEqual(build);
    });

    it('should return null for invalid base64', () => {
      expect(decodeFromBase64('not-valid-base64!!!')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(decodeFromBase64(null)).toBeNull();
    });
  });

  describe('Base64 round-trip', () => {
    it('should preserve build through base64 encode/decode', () => {
      const original = {
        character: 'mage',
        weapon: 'staff',
        tomes: ['power', 'health'],
        items: ['ring', 'amulet']
      };

      const encoded = encodeToBase64(original);
      const decoded = decodeFromBase64(encoded);

      expect(decoded).toEqual(original);
    });
  });
});

describe('JSON Encoding', () => {
  describe('encodeToJSON()', () => {
    it('should encode build to JSON', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: ['ring']
      };

      const json = encodeToJSON(build);

      expect(json).toBeTruthy();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should use compact keys', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: ['ring']
      };

      const json = encodeToJSON(build);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('c');
      expect(parsed).toHaveProperty('w');
      expect(parsed).toHaveProperty('t');
      expect(parsed).toHaveProperty('i');
    });

    it('should return null for invalid build', () => {
      expect(encodeToJSON({ character: 'knight' })).toBeNull();
    });
  });

  describe('decodeFromJSON()', () => {
    it('should decode JSON to build', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: ['ring']
      };

      const json = encodeToJSON(build);
      const decoded = decodeFromJSON(json);

      expect(decoded).toEqual(build);
    });

    it('should return null for invalid JSON', () => {
      expect(decodeFromJSON('not json')).toBeNull();
    });

    it('should return null for JSON missing required fields', () => {
      expect(decodeFromJSON('{"c":"knight"}')).toBeNull();
    });

    it('should handle missing optional arrays', () => {
      const json = '{"c":"knight","w":"sword"}';
      const decoded = decodeFromJSON(json);

      expect(decoded.tomes).toEqual([]);
      expect(decoded.items).toEqual([]);
    });
  });
});

describe('Build Validation', () => {
  const mockAllData = {
    characters: { characters: [{ id: 'knight' }, { id: 'mage' }] },
    weapons: { weapons: [{ id: 'sword' }, { id: 'staff' }] },
    tomes: { tomes: [{ id: 'power' }, { id: 'health' }] },
    items: { items: [{ id: 'ring' }, { id: 'amulet' }] }
  };

  describe('validateBuildCode()', () => {
    it('should validate correct build', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: ['ring']
      };

      const result = validateBuildCode(build, mockAllData);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unknown character', () => {
      const build = {
        character: 'unknown',
        weapon: 'sword',
        tomes: [],
        items: []
      };

      const result = validateBuildCode(build, mockAllData);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('character'))).toBe(true);
    });

    it('should detect unknown weapon', () => {
      const build = {
        character: 'knight',
        weapon: 'unknown',
        tomes: [],
        items: []
      };

      const result = validateBuildCode(build, mockAllData);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('weapon'))).toBe(true);
    });

    it('should detect unknown tome', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['unknown'],
        items: []
      };

      const result = validateBuildCode(build, mockAllData);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tome'))).toBe(true);
    });

    it('should detect unknown item', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: [],
        items: ['unknown']
      };

      const result = validateBuildCode(build, mockAllData);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('item'))).toBe(true);
    });

    it('should detect multiple errors', () => {
      const build = {
        character: 'unknown1',
        weapon: 'unknown2',
        tomes: ['unknown3'],
        items: ['unknown4']
      };

      const result = validateBuildCode(build, mockAllData);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(4);
    });
  });
});

describe('Shareable URL', () => {
  describe('generateShareableURL()', () => {
    it('should generate URL with build parameter', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: [],
        items: []
      };

      const url = generateShareableURL(build);

      expect(url).toContain('megabonk.app');
      expect(url).toContain('build=');
    });

    it('should use custom base URL', () => {
      const build = {
        character: 'knight',
        weapon: 'sword',
        tomes: [],
        items: []
      };

      const url = generateShareableURL(build, 'https://custom.app');

      expect(url).toContain('custom.app');
    });

    it('should return null for invalid build', () => {
      const build = { character: 'knight' };

      expect(generateShareableURL(build)).toBeNull();
    });
  });

  describe('parseShareableURL()', () => {
    it('should parse URL and return build', () => {
      const original = {
        character: 'knight',
        weapon: 'sword',
        tomes: ['power'],
        items: ['ring']
      };

      const url = generateShareableURL(original);
      const parsed = parseShareableURL(url);

      expect(parsed).toEqual(original);
    });

    it('should return null for URL without build parameter', () => {
      expect(parseShareableURL('https://megabonk.app')).toBeNull();
    });

    it('should return null for invalid URL', () => {
      expect(parseShareableURL('not-a-url')).toBeNull();
    });

    it('should return null for invalid build parameter', () => {
      expect(parseShareableURL('https://megabonk.app?build=invalid')).toBeNull();
    });
  });

  describe('URL round-trip', () => {
    it('should preserve build through URL encode/parse', () => {
      const original = {
        character: 'mage',
        weapon: 'staff',
        tomes: ['power', 'health'],
        items: ['ring', 'amulet']
      };

      const url = generateShareableURL(original);
      const parsed = parseShareableURL(url);

      expect(parsed).toEqual(original);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle special characters in IDs', () => {
    const build = {
      character: 'knight-v2',
      weapon: 'sword_plus',
      tomes: ['power-boost'],
      items: ['ring_of_fire']
    };

    const code = encodeBuild(build);
    const decoded = decodeBuild(code);

    expect(decoded).toEqual(build);
  });

  it('should handle empty strings in arrays', () => {
    const build = {
      character: 'knight',
      weapon: 'sword',
      tomes: ['', 'power', ''],
      items: []
    };

    const code = encodeBuild(build);
    const decoded = decodeBuild(code);

    // Empty strings should be filtered out
    expect(decoded.tomes).toEqual(['power']);
  });

  it('should handle unicode characters', () => {
    const build = {
      character: 'knight',
      weapon: 'sword',
      tomes: [],
      items: []
    };

    const encoded = encodeToBase64(build);
    const decoded = decodeFromBase64(encoded);

    expect(decoded).toEqual(build);
  });

  it('should handle very long item lists', () => {
    const items = Array.from({ length: 50 }, (_, i) => `item-${i}`);
    const build = {
      character: 'knight',
      weapon: 'sword',
      tomes: [],
      items
    };

    const code = encodeBuild(build);
    const decoded = decodeBuild(code);

    expect(decoded.items).toHaveLength(50);
  });
});
