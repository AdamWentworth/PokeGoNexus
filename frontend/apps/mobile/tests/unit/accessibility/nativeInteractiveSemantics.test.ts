/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const sourceRoot = join(__dirname, '../../../src');

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? sourceFiles(join(directory, entry.name))
    : entry.name.endsWith('.tsx') ? [join(directory, entry.name)] : []);

type MissingSemantics = { file: string; line: number; element: string };

const findMissingSemantics = (): MissingSemantics[] => sourceFiles(sourceRoot).flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const missing: MissingSemantics[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const element = node.tagName.getText(source);
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const names = new Set(attributes.map((attribute) => attribute.name.getText(source)));
      const deliberatelyHidden = attributes.some((attribute) => (
        attribute.name.getText(source) === 'accessible'
        && attribute.initializer?.getText(source) === '{false}'
      ));
      const lacksSemantics = (
        element === 'Pressable'
          ? !names.has('accessibilityRole') && !deliberatelyHidden
          : element === 'TextInput' && !names.has('accessibilityLabel')
      );
      if (lacksSemantics) {
        missing.push({
          element,
          file: relative(sourceRoot, file),
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return missing;
});

describe('native interactive semantics', () => {
  it('labels text inputs and gives every visible Pressable an accessibility role', () => {
    expect(findMissingSemantics()).toEqual([]);
  });
});
