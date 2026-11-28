import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function readSource(path: string) {
  return ts.createSourceFile(
    path,
    readFileSync(new URL(path, import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

const app = readSource("../App.tsx");
const nativeOrders = readSource("../src/organizer/NativeOrganizerOrders.tsx");

test("Organizer orders labels and pagination use native text and buttons", () => {
  const label = nativeOrders.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === "Label",
  );
  assert.ok(label?.body, "O componente de texto da paginação precisa existir.");
  const returns = label.body.statements.find(ts.isReturnStatement);
  let expression = returns?.expression;
  while (expression && ts.isParenthesizedExpression(expression))
    expression = expression.expression;
  assert.ok(expression && ts.isJsxElement(expression));
  assert.equal(expression.openingElement.tagName.getText(nativeOrders), "Text");
  const nativeOrderScreen = nativeOrders.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "NativeOrganizerOrders",
  );
  assert.ok(nativeOrderScreen?.body);
  const labels: string[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(nativeOrders) === "PremiumButton"
    ) {
      const title = node.attributes.properties.find(
        (attr): attr is ts.JsxAttribute =>
          ts.isJsxAttribute(attr) &&
          attr.name.getText(nativeOrders) === "title",
      )?.initializer;
      if (title && ts.isStringLiteral(title)) labels.push(title.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(nativeOrderScreen.body);
  for (const title of ["Pedidos anteriores", "Mais pedidos"])
    assert.ok(labels.includes(title), title);
});

for (const [source, name, textTags] of [
  [app, "Campaigns", ["Text"]],
  [app, "Orders", ["Text"]],
  [nativeOrders, "NativeOrganizerOrders", ["Text", "Label"]],
] as const) {
  test(`${name} pagination does not put literal text directly in native layout`, () => {
    const screen = source.statements.find(
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.ok(screen?.body, `Não foi possível localizar a tela ${name}.`);
    const rawChildren: number[] = [];
    function visit(node: ts.Node) {
      const parent = node.parent;
      const layoutChild =
        ts.isJsxFragment(parent) ||
        (ts.isJsxElement(parent) &&
          !textTags.some(
            (tag) => tag === parent.openingElement.tagName.getText(source),
          ));
      if (
        layoutChild &&
        ((ts.isJsxExpression(node) &&
          node.expression &&
          ts.isStringLiteralLike(node.expression) &&
          node.expression.text.length > 0) ||
          (ts.isJsxText(node) && node.text.trim().length > 0))
      ) {
        rawChildren.push(
          source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(screen.body);
    assert.deepEqual(
      rawChildren,
      [],
      "React Native requer texto dentro de <Text>, inclusive espaços explícitos.",
    );
  });
}
