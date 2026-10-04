import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { prisma } from "./config/prisma";
import usuariosRoutes from "./routes/usuarios";
import authRoutes from "./routes/auth";
import gastosRoutes from "./routes/gastos";
import uploadsRoutes from "./routes/uploads";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", uploadsRoutes);

app.use("/usuarios", usuariosRoutes);
app.use("/auth", authRoutes);
app.use("/gastos", gastosRoutes);
app.get("/", (req, res) => {
  return res.json({
    aplicacao: "Controle de Gastos com IA",
    status: "online",
    mensagem: "API funcionando 🚀"
  });
});

app.get("/teste-banco", async (req, res) => {
  try {
    const totalUsuarios = await prisma.usuario.count();

    return res.json({
      banco: "PostgreSQL",
      status: "conectado",
      totalUsuarios
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      status: "erro",
      mensagem: "Não foi possível conectar ao banco."
    });
  }
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Controle de Gastos com IA rodando na porta ${PORT}`);
});