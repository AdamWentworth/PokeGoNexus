import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const USER_FACING_EXTENSIONS = new Set(['.html', '.json', '.ts', '.tsx']);
const LEGACY_PRODUCT_NAME = /(?:PokeGo|Poke Go) ?Nexus|Pokemon (?:Go|GO) Nexus|POKEGO NEXUS/;

const collectUserFacingFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectUserFacingFiles(path);
    return USER_FACING_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });

describe('product branding', () => {
  it('uses the canonical accented and spaced product name in user-facing surfaces', () => {
    const projectRoot = process.cwd();
    const files = [
      ...collectUserFacingFiles(join(projectRoot, 'src')),
      join(projectRoot, 'index.html'),
      join(projectRoot, 'public', 'manifest.json'),
    ];
    const violations = files.filter((file) => {
      // Repository URLs and versioned download paths must keep their real names;
      // those identifiers are not the product copy this check protects.
      const copy = readFileSync(file, 'utf8')
        .replace(/https?:\/\/[^\s"'`<>]+/g, '')
        .replace(/\bPokeGoNexus-Android-(?:\d+|\$\{[^}\r\n]+\})\.apk\b/g, '');
      return LEGACY_PRODUCT_NAME.test(copy);
    });

    expect(violations, 'Use “Pokémon Go Nexus” in user-facing product text.').toEqual([]);
    expect(readFileSync(join(projectRoot, 'index.html'), 'utf8')).toContain('Pokémon Go Nexus');
    expect(readFileSync(join(projectRoot, 'public', 'manifest.json'), 'utf8')).toContain('Pokémon Go Nexus');
  });
});
