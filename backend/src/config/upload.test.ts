import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import { resolverImagem, UPLOADS_DIR } from "./upload";

const UUID = "9b450676-d0e6-477b-920b-604a51ce5b45";

test("resolverImagem aceita imagem do próprio usuário", () => {
  assert.equal(
    resolverImagem(`/uploads/7/${UUID}.jpg`, 7),
    path.join(UPLOADS_DIR, "7", `${UUID}.jpg`)
  );
});

test("resolverImagem recusa imagem de outro usuário", () => {
  assert.equal(resolverImagem(`/uploads/8/${UUID}.jpg`, 7), null);
});

test("resolverImagem recusa caminhos fora da pasta de uploads", () => {
  for (const tentativa of [
    "/uploads/../.env",
    "/uploads/7/../../.env",
    "/etc/passwd",
    `/uploads/7/${UUID}.html`,
    `/uploads/${UUID}.jpg`,
    `uploads/7/${UUID}.jpg`,
    undefined,
    123
  ]) {
    assert.equal(resolverImagem(tentativa, 7), null, String(tentativa));
  }
});
