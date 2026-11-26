import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.createSourceFile(
  "App.tsx",
  readFileSync(new URL("../App.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

for (const name of ["Campaigns", "Orders"]) {
  test(`${name} pagination does not put literal text directly in native layout`, () => {
    const screen = source.statements.find((node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.ok(screen?.body, `Não foi possível localizar a tela ${name}.`);
    const rawChildren: number[] = [];
    function visit(node: ts.Node) {
      const parent = node.parent;
      const layoutChild = ts.isJsxFragment(parent) ||
        (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(source) !== "Text");
      if (layoutChild && (
        (ts.isJsxExpression(node) && node.expression && ts.isStringLiteralLike(node.expression) && node.expression.text.length > 0) ||
        (ts.isJsxText(node) && node.text.trim().length > 0)
      )) {
        rawChildren.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
      }
      ts.forEachChild(node, visit);
    }
    visit(screen.body);
    assert.deepEqual(rawChildren, [], "React Native requer texto dentro de <Text>, inclusive espaços explícitos.");
  });
}
