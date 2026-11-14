// Importado ANTES do app nos testes de integração: as variáveis precisam
// existir quando os módulos de configuração são carregados.
import fs from "fs";
import os from "os";
import path from "path";

process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "gastos-uploads-"));
process.env.JWT_SECRET ??= "segredo-de-teste";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Defina DATABASE_URL apontando para um PostgreSQL de teste (as tabelas são limpas)."
  );
}
