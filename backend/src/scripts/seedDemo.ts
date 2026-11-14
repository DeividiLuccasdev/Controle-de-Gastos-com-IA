// Roda no start do Render, depois das migrações: npm run seed:demo
import { prisma } from "../config/prisma";
import { EMAIL_DEMO, garantirUsuarioDemo } from "../services/usuarioDemo";

async function main() {
  const resultado = await garantirUsuarioDemo();

  if (!resultado.executado) {
    console.log("Conta demo ignorada (defina RENDER ou CRIAR_USUARIO_DEMO=true).");
    return;
  }

  console.log(
    `Conta demo pronta (${EMAIL_DEMO}); gastos de exemplo criados: ${resultado.gastosCriados}.`
  );
}

main()
  .catch((erro) => {
    console.error("ERRO AO CRIAR CONTA DEMO:", erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
