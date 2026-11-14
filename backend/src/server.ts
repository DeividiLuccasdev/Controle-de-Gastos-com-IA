import { criarApp } from "./app";
import { agendarLimpezaDeUploads } from "./services/imagens";

const app = criarApp();

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Controle de Gastos com IA rodando na porta ${PORT}`);
});

// Remove comprovantes que nunca viraram gasto (ao iniciar e periodicamente).
agendarLimpezaDeUploads();
