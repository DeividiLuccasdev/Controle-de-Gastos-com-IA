// Conta pública de demonstração: quem visita a demo entra sem se cadastrar.
// Ela é criada (ou "curada") a cada deploy pelo script seed:demo.
import bcrypt from "bcryptjs";
import { Response } from "express";

import { prisma } from "../config/prisma";

export const EMAIL_DEMO = "demo@example.com";
export const SENHA_DEMO = "Demo@2026";
export const NOME_DEMO = "Usuário Demo";

// Chave fixa do advisory lock: dois deploys simultâneos não inserem
// os gastos de exemplo em dobro.
const LOCK_SEED_DEMO = 20261114;

export function ehUsuarioDemo(email: unknown): boolean {
  return String(email ?? "").trim().toLowerCase() === EMAIL_DEMO;
}

// Usar em toda rota que altere ou exclua a conta (senha, e-mail, exclusão).
// Retorna true quando já respondeu 403 e a rota deve parar.
export function bloquearContaDemo(email: unknown, res: Response): boolean {
  if (!ehUsuarioDemo(email)) return false;

  res.status(403).json({
    mensagem: "A conta de demonstração não pode ser alterada. Crie sua própria conta para testar isso."
  });
  return true;
}

// Só no deploy (o Render define RENDER) ou quando pedido explicitamente:
// bancos locais e de teste não ganham a conta demo sem querer.
export function deveCriarUsuarioDemo(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RENDER) || env.CRIAR_USUARIO_DEMO === "true";
}

function diasAtras(dias: number) {
  const data = new Date();
  data.setUTCHours(12, 0, 0, 0);
  data.setUTCDate(data.getUTCDate() - dias);
  return data;
}

function gastosDeExemplo() {
  return [
    {
      estabelecimento: "Supermercado Bom Preço",
      categoria: "Mercado",
      dataCompra: diasAtras(1),
      total: "187.45",
      itens: [
        { produto: "Arroz 5 kg", quantidade: 1, valorUnitario: "27.90", valorTotal: "27.90" },
        { produto: "Feijão carioca 1 kg", quantidade: 2, valorUnitario: "8.49", valorTotal: "16.98" },
        { produto: "Café 500 g", quantidade: 2, valorUnitario: "19.90", valorTotal: "39.80" },
        { produto: "Carne moída 1 kg", quantidade: 2, valorUnitario: "51.39", valorTotal: "102.77" }
      ]
    },
    {
      estabelecimento: "Posto Shell Av. Brasil",
      categoria: "Transporte",
      dataCompra: diasAtras(3),
      total: "150.00",
      itens: [
        { produto: "Gasolina comum", quantidade: 1, valorUnitario: "150.00", valorTotal: "150.00" }
      ]
    },
    {
      estabelecimento: "Restaurante Sabor Caseiro",
      categoria: "Alimentação",
      dataCompra: diasAtras(5),
      total: "64.80",
      itens: [
        { produto: "Prato executivo", quantidade: 2, valorUnitario: "27.90", valorTotal: "55.80" },
        { produto: "Suco natural", quantidade: 1, valorUnitario: "9.00", valorTotal: "9.00" }
      ]
    },
    {
      estabelecimento: "Drogaria São Paulo",
      categoria: "Saúde",
      dataCompra: diasAtras(8),
      total: "42.37",
      itens: [
        { produto: "Dipirona 500 mg", quantidade: 1, valorUnitario: "12.49", valorTotal: "12.49" },
        { produto: "Protetor solar FPS 50", quantidade: 1, valorUnitario: "29.88", valorTotal: "29.88" }
      ]
    },
    {
      estabelecimento: "Padaria Pão Quente",
      categoria: "Alimentação",
      dataCompra: diasAtras(10),
      total: "23.50",
      itens: [
        { produto: "Pão francês", quantidade: 10, valorUnitario: "0.95", valorTotal: "9.50" },
        { produto: "Queijo muçarela 200 g", quantidade: 1, valorUnitario: "14.00", valorTotal: "14.00" }
      ]
    },
    {
      estabelecimento: "Cinemark",
      categoria: "Lazer",
      dataCompra: diasAtras(14),
      total: "78.00",
      itens: [
        { produto: "Ingresso inteira", quantidade: 2, valorUnitario: "32.00", valorTotal: "64.00" },
        { produto: "Pipoca média", quantidade: 1, valorUnitario: "14.00", valorTotal: "14.00" }
      ]
    }
  ];
}

export type ResultadoSeedDemo =
  | { executado: false }
  | { executado: true; usuarioId: number; gastosCriados: number };

// Idempotente: cria a conta se faltar, redefine a senha se já existir
// (cura uma demo "vandalizada") e insere os gastos de exemplo só quando
// a conta não tem nenhum gasto.
export async function garantirUsuarioDemo(
  env: NodeJS.ProcessEnv = process.env
): Promise<ResultadoSeedDemo> {
  if (!deveCriarUsuarioDemo(env)) {
    return { executado: false };
  }

  // Mesmo hash do cadastro (routes/usuarios.ts).
  const senhaHash = await bcrypt.hash(SENHA_DEMO, 10);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_SEED_DEMO})`);

    // upsert pelo índice único de e-mail: seguro contra execuções simultâneas.
    const usuario = await tx.usuario.upsert({
      where: { email: EMAIL_DEMO },
      create: { nome: NOME_DEMO, email: EMAIL_DEMO, senha: senhaHash },
      update: { nome: NOME_DEMO, senha: senhaHash },
      select: { id: true }
    });

    const existentes = await tx.gasto.count({ where: { usuarioId: usuario.id } });

    if (existentes > 0) {
      return { executado: true, usuarioId: usuario.id, gastosCriados: 0 };
    }

    const gastos = gastosDeExemplo();

    for (const { itens, ...gasto } of gastos) {
      await tx.gasto.create({
        data: {
          ...gasto,
          usuarioId: usuario.id,
          itens: { create: itens }
        }
      });
    }

    return { executado: true, usuarioId: usuario.id, gastosCriados: gastos.length };
  });
}
