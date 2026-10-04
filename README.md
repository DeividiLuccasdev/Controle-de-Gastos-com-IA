# 📸 Controle de Gastos com IA

[![CI](https://github.com/DeividiLuccasdev/gasto-na-foto/actions/workflows/ci.yml/badge.svg)](https://github.com/DeividiLuccasdev/gasto-na-foto/actions/workflows/ci.yml)

Aplicação Full Stack para controle de gastos por meio de fotografias de comprovantes e notas fiscais.

O usuário fotografa um comprovante pelo celular ou seleciona uma imagem. O backend processa a imagem e utiliza Inteligência Artificial (modelo de visão Qwen, via Groq) para identificar automaticamente estabelecimento, data, valor total, categoria e itens da compra.

## 🌐 Aplicação Online

[Acessar o Controle de Gastos com IA](https://controle-gastos-ia.onrender.com)

> ⏳ **O primeiro acesso pode demorar de 30 a 60 segundos.** A aplicação usa o plano gratuito do Render, que "adormece" o servidor após 15 minutos sem uso. Depois que ele acorda, tudo responde normalmente.

## 🚀 Funcionalidades

- Cadastro e autenticação de usuários
- Login com JWT
- Upload de comprovantes
- Captura de imagem pela câmera do celular
- Tratamento de imagens com Sharp
- Análise de comprovantes com IA (Qwen via Groq)
- Extração automática de estabelecimento, data, total, categoria e produtos
- Cadastro dos gastos no PostgreSQL
- Histórico de gastos
- Soma automática do total gasto
- Interface responsiva
- API REST entre frontend e backend

## 🧠 Inteligência Artificial

O sistema envia a imagem do comprovante a um modelo de visão (Qwen 3.8, pela API do [Groq](https://groq.com), compatível com a OpenAI) para interpretar imagens de comprovantes e retornar dados estruturados em JSON.

### Fluxo da aplicação

```text
Celular / Navegador
        ↓
Next.js / React
        ↓
API Node.js / Express
        ↓
Sharp
        ↓
Groq (Qwen 3.8 Vision)
        ↓
JSON estruturado
        ↓
Prisma ORM
        ↓
PostgreSQL
```

## 🛠️ Tecnologias

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- HTML5
- CSS3

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- JWT
- Multer
- Sharp

### Inteligência Artificial

- Groq API (modelo Qwen 3.8 com visão)
- Google GenAI SDK

### Banco de Dados

- PostgreSQL
- Docker

### Ferramentas

- Git
- GitHub
- VS Code
- Docker Desktop

## 📂 Estrutura

```text
controle-gastos-ia/
├── backend/
│   ├── prisma/
│   └── src/
│       ├── config/
│       ├── middlewares/
│       ├── routes/
│       ├── services/
│       └── server.ts
│
├── frontend/
│   └── src/
│       └── app/
│           ├── login/
│           ├── layout.tsx
│           └── page.tsx
│
├── screenshots/
├── .gitignore
└── README.md
```

## 🔐 Variáveis de ambiente

As chaves e credenciais reais não são armazenadas no GitHub.

Exemplo:

```env
GROQ_API_KEY=sua_chave_groq
DATABASE_URL=postgresql://usuario:senha@localhost:5436/controle_gastos_ia
JWT_SECRET=seu_segredo_aqui
PORT=3001
```

## ⚙️ Como executar

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend:

```text
http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Ou utilizando a exportação estática:

```bash
npm run build
npx serve@latest out -l 3000
```

Frontend:

```text
http://localhost:3000
```

## ☁️ Publicando no Render

O arquivo `render.yaml` cria a API e o site de uma vez:

1. Crie um banco PostgreSQL (por exemplo, no [Neon](https://neon.tech)) e copie a connection string.
2. No Render, clique em **New → Blueprint** e escolha este repositório.
3. Informe as variáveis que o Render pedir:
   - `DATABASE_URL`: a connection string do banco
   - `GROQ_API_KEY`: sua chave do [Groq](https://console.groq.com) (plano gratuito)
   - `NEXT_PUBLIC_API_URL`: o endereço da API (ex.: `https://controle-gastos-ia-api.onrender.com`)
4. As migrações do banco rodam sozinhas a cada deploy. A `JWT_SECRET` é gerada automaticamente.

Variáveis do frontend:

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | Endereço da API usado no build. Sem ela, o frontend usa a porta 3001 do mesmo computador (útil para testar no celular pela rede local) |

> No plano gratuito, os arquivos enviados ficam no disco temporário do servidor: os dados dos gastos ficam salvos no banco, mas as imagens dos comprovantes são apagadas quando o servidor reinicia.

## 🧪 Testes

```bash
cd backend
npm test
```

## 🔐 Segurança dos comprovantes

- Só imagens de verdade são aceitas: o arquivo é validado e convertido para JPEG pelo Sharp, o que também remove metadados como a localização GPS.
- Cada usuário tem a própria pasta em `uploads/` e só acessa e analisa os próprios comprovantes.
- As imagens exigem login para serem baixadas.

## 📱 Teste em celular

O projeto foi testado em smartphone Android conectado à mesma rede do computador, permitindo fotografar comprovantes diretamente pelo aparelho.

## 📸 Screenshots

### Login

<img src="screenshots/login.png" width="300">

### Dashboard

<img src="screenshots/dashboard.png" width="300">

### Análise do comprovante com IA

<img src="screenshots/analise-comprovante.png" width="300">

## 🎯 Objetivo

Projeto desenvolvido para demonstrar conhecimentos em desenvolvimento Full Stack, incluindo frontend, backend, APIs REST, autenticação, banco de dados, processamento de imagens e integração com Inteligência Artificial.

## 👨‍💻 Autor

**Deividi Tiago Luccas**

Desenvolvedor Full Stack

GitHub: [DeividiLuccasdev](https://github.com/DeividiLuccasdev)

---

Projeto desenvolvido para estudo, prática e portfólio profissional.
