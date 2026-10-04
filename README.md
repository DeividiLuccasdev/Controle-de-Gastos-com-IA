# 📸 Controle de Gastos com IA

Aplicação Full Stack para controle de gastos por meio de fotografias de comprovantes e notas fiscais.

O usuário fotografa um comprovante pelo celular ou seleciona uma imagem. O backend processa a imagem e utiliza Inteligência Artificial com Google Gemini para identificar automaticamente estabelecimento, data, valor total, categoria e itens da compra.

## 🚀 Funcionalidades

- Autenticação de usuários
- Login com JWT
- Upload de comprovantes
- Captura de imagem pela câmera do celular
- Tratamento de imagens com Sharp
- Análise de comprovantes com Google Gemini
- Extração automática de estabelecimento, data, total, categoria e produtos
- Cadastro dos gastos no PostgreSQL
- Histórico de gastos
- Soma automática do total gasto
- Interface responsiva
- API REST entre frontend e backend

## 🧠 Inteligência Artificial

O sistema utiliza a API do Google Gemini para interpretar imagens de comprovantes e retornar dados estruturados em JSON.

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
Google Gemini
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

- Google Gemini API
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
GEMINI_API_KEY=sua_chave_aqui
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