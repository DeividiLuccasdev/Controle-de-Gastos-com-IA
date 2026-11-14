# Publicação no Render

O arquivo [`render.yaml`](../render.yaml) é um Blueprint que cria a API e o site de uma vez:

- `controle-gastos-ia-api`: serviço web Node.js 22 com raiz em `backend/`. O build roda `npm ci --include=dev && npm run build` e o start roda `npm run migrate && npm start`, então as migrações do banco rodam sozinhas a cada deploy. O health check usa `/`.
- `controle-gastos-ia`: site estático com raiz em `frontend/`, publicado a partir de `out/` (export do Next.js), com rewrites para `/login` e `/cadastro`.

## Passo a passo

1. Crie um banco PostgreSQL (por exemplo, no [Neon](https://neon.tech)) e copie a connection string.
2. No Render, clique em **New → Blueprint** e escolha este repositório.
3. Informe as variáveis que o Render pedir:
   - `DATABASE_URL`: a connection string do banco
   - `GROQ_API_KEY`: sua chave do [Groq](https://console.groq.com) (plano gratuito)
   - `NEXT_PUBLIC_API_URL`: o endereço da API (ex.: `https://controle-gastos-ia-api.onrender.com`)
4. As migrações do banco rodam sozinhas a cada deploy. A `JWT_SECRET` é gerada automaticamente.

## Variáveis do frontend

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | Endereço da API usado no build. Sem ela, o frontend usa a porta 3001 do mesmo computador (útil para testar no celular pela rede local) |

## Observações do plano gratuito

- O servidor "adormece" após 15 minutos sem uso; o primeiro acesso pode demorar de 30 a 60 segundos.
- Os arquivos enviados ficam no disco temporário do servidor: os dados dos gastos ficam salvos no banco, mas as imagens dos comprovantes são apagadas quando o servidor reinicia.
