// Endereço da API.
// Em produção, defina NEXT_PUBLIC_API_URL no build (ex.: https://sua-api.onrender.com).
// Sem a variável, usa a porta 3001 do mesmo computador: assim o app
// continua funcionando no celular conectado à mesma rede durante o desenvolvimento.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:3001`
    : "http://localhost:3001");
