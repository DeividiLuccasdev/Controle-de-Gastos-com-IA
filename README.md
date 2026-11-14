<div align="center">

# Controle de Gastos com IA

**Registro de gastos a partir da foto do comprovante: a IA lê, o usuário confere e o gasto é salvo uma única vez.**

[![CI](https://github.com/DeividiLuccasdev/Controle-de-Gastos-com-IA/actions/workflows/ci.yml/badge.svg)](https://github.com/DeividiLuccasdev/Controle-de-Gastos-com-IA/actions/workflows/ci.yml)
![Node.js 22](https://img.shields.io/badge/node-22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Express 5](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)

[**Demo ao vivo**](https://controle-gastos-ia.onrender.com) · [Portfólio](https://portfolio-deividi.vercel.app/) · [GitHub](https://github.com/DeividiLuccasdev)

<table>
  <tr>
    <td width="33%"><img src="screenshots/login.png" alt="Tela de login"></td>
    <td width="33%"><img src="screenshots/dashboard.png" alt="Dashboard com histórico e total de gastos"></td>
    <td width="33%"><img src="screenshots/analise-comprovante.png" alt="Análise do comprovante pela IA"></td>
  </tr>
  <tr>
    <td align="center"><sub>Login</sub></td>
    <td align="center"><sub>Dashboard</sub></td>
    <td align="center"><sub>Análise do comprovante com IA</sub></td>
  </tr>
</table>

</div>

> Projeto de estudo e portfólio. A demo roda no plano gratuito do Render, que "adormece" o servidor após 15 minutos sem uso: **o primeiro acesso pode demorar de 30 a 60 segundos**. Depois que ele acorda, tudo responde normalmente.

## Sobre

Aplicação full stack para controle de gastos por fotografia de comprovantes e notas fiscais. O usuário fotografa o comprovante pelo celular (ou escolhe uma imagem), o backend trata a imagem e um modelo de visão (Qwen, via [Groq](https://groq.com)) devolve estabelecimento, data, valor total, categoria e itens em JSON estruturado.

O foco não está só na chamada à IA, mas no que costuma dar errado em volta dela: **duplo clique e reenvio, a mesma foto enviada duas vezes, a IA lenta ou fora do ar, falha no banco no meio do processo e arquivos que ficam para trás.** O projeto demonstra frontend, backend, API REST, autenticação, banco de dados, processamento de imagens e integração com IA.

## Funcionalidades

| | |
| --- | --- |
| **Contas** | Cadastro e login com JWT (validade de 7 dias), senhas com bcrypt e e-mail normalizado. |
| **Captura do comprovante** | Câmera do celular (`capture="environment"`) ou seleção de arquivo; JPEG, PNG ou WEBP de até 10 MB. |
| **Tratamento da imagem** | O Sharp valida, corrige a rotação e converte para JPEG, removendo metadados como a localização GPS. |
| **Análise com IA** | Modelo de visão Qwen pela API do Groq (compatível com a OpenAI), com resposta normalizada para números, datas e quantidades. |
| **Revisão antes de salvar** | Os dados extraídos aparecem em um formulário editável; o usuário corrige, salva ou cancela. |
| **Histórico e total** | Lista de gastos com itens, exclusão com confirmação e total calculado pelo banco (`GET /gastos/resumo`). |
| **Interface responsiva** | Frontend em Next.js com Tailwind CSS, exportado como site estático. |

## Arquitetura

```mermaid
flowchart LR
    UI["Frontend<br/>Next.js · React<br/>(site estático)"] -->|REST + JWT| API["API<br/>Node.js · Express"]
    API -->|validação e conversão| SHARP["Sharp"]
    SHARP --> DISCO[("uploads/ por usuário<br/>JPEG")]
    API -->|imagem em base64| IA["Groq<br/>Qwen (visão)"]
    IA -->|JSON estruturado| API
    API -->|Prisma ORM| PG[("PostgreSQL<br/>usuários · gastos · itens")]
    LIMPEZA["Limpeza periódica"] -->|remove fotos sem gasto| DISCO
```

Fluxo de um comprovante: `POST /gastos/foto` salva a imagem tratada, `POST /gastos/analisar` devolve os dados extraídos para revisão e `POST /gastos` grava o gasto confirmado. Há também `POST /gastos/analisar-e-salvar`, que faz as duas últimas etapas de uma vez. → [rotas da API](docs/api.md)

## Decisões técnicas

- **Idempotência garantida pelo banco, não por verificação prévia.** Um comprovante vira no máximo um gasto: há restrições únicas por usuário em `imagemUrl` e no hash SHA-256 do JPEG salvo. Duplo clique, reenvio ou a mesma foto enviada de novo caem na violação de unicidade (P2002) e devolvem o gasto existente (`200`, `duplicado: true`), inclusive com requisições simultâneas. Gastos manuais, sem imagem, ficam fora da restrição.
- **Migração sem perda de dados.** A migração que criou essas restrições não apaga duplicados antigos: o gasto mais antigo mantém a imagem e os repetidos ficam sem `imagemUrl`, para o usuário revisar.
- **Falhas não deixam arquivos órfãos.** Fotos que não viram gasto (IA falhou, total não identificado, erro no banco, análise cancelada) são apagadas, mas só se nenhum gasto as referencia. Uma limpeza ao iniciar e a cada 6 horas remove o que sobrar com mais de 24 horas e arquivos `.tmp` abandonados.
- **Escrita atômica da imagem.** O arquivo é gravado como `.tmp` e renomeado, então um `.jpg` nunca fica pela metade se o processo cair no meio.
- **Limites explícitos na chamada à IA.** Timeout de 30 s e uma nova tentativa, em vez dos padrões do SDK, que deixariam a requisição do usuário presa por muito mais tempo. Timeout vira `504`, resposta sem JSON aproveitável vira `502` e chave inválida ou limite de uso vira `503` com mensagem amigável.
- **Erros internos só no log.** Um tradutor central converte exceções em status HTTP e mensagem segura; detalhes do banco, stack e resposta da IA ficam só no log do servidor.
- **Exclusão idempotente e sem vazamento.** `DELETE /gastos/:id` responde `204` mesmo se o gasto já não existe ou pertence a outro usuário, sem revelar se ele existe. O registro é apagado antes do arquivo, para que uma falha no banco não deixe o gasto sem imagem.
- **Comprovantes isolados por usuário.** Cada usuário tem a própria pasta em `uploads/` e só acessa e analisa os próprios comprovantes; o `imagemUrl` é validado por expressão regular (bloqueando tentativas como `/uploads/../.env`) e o download das imagens exige login.
- **IA injetável nos testes.** O app é criado separado do `listen`, o que permite testá-lo com supertest e trocar a IA por um dublê, cobrindo falhas sem depender do provedor.

## Stack

| Camada | Tecnologias |
| --- | --- |
| Frontend | Next.js 16 (export estático), React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js 22, Express 5, TypeScript, Multer, Sharp, JWT, bcrypt |
| IA | Groq API com modelo de visão Qwen, via SDK `openai` |
| Dados | PostgreSQL, Prisma ORM 7 (adapter `pg`) |
| Testes | `node:test` (via tsx), supertest, PostgreSQL real |
| Infra | GitHub Actions, Render (Blueprint em `render.yaml`) |

## Como rodar

Pré-requisitos: Node.js 22+, um PostgreSQL (local ou em Docker) e uma chave do [Groq](https://console.groq.com) (há plano gratuito).

Um PostgreSQL em Docker compatível com o `.env.example`:

```bash
docker run -d --name gastos-db -e POSTGRES_USER=usuario -e POSTGRES_PASSWORD=senha \
  -e POSTGRES_DB=controle_gastos_ia -p 5436:5432 postgres:16
```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # preencha as variáveis
npm run build          # gera o cliente Prisma
npm run migrate        # aplica as migrações
npm run dev            # http://localhost:3001
```

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Connection string do PostgreSQL |
| `JWT_SECRET` | Segredo usado para assinar os tokens |
| `GROQ_API_KEY` | Chave da API do Groq |
| `GROQ_MODEL` | Opcional. Outro modelo de visão do Groq (padrão: `qwen/qwen3.8-27b`) |
| `GROQ_BASE_URL` | Opcional. Endpoint compatível com a OpenAI (padrão: API do Groq) |
| `UPLOADS_DIR` | Opcional. Pasta das imagens (padrão: `uploads`) |
| `PORT` | Porta da API (padrão: `3001`) |

As chaves e credenciais reais não são armazenadas no GitHub.

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Ou utilizando a exportação estática:

```bash
npm run build
npx serve@latest out -l 3000
```

`NEXT_PUBLIC_API_URL` define o endereço da API no build. Sem ela, o frontend usa a porta 3001 do mesmo computador, o que permite testar no celular pela rede local. → [teste em celular](docs/teste-celular.md) · [publicação no Render](docs/deploy-render.md)

## Testes

```bash
cd backend
npm test               # testes unitários
```

Testes de integração (API + PostgreSQL real, IA simulada). Use um banco de teste: as tabelas são limpas a cada teste.

```bash
cd backend
DATABASE_URL=postgresql://usuario:senha@localhost:5432/gastos_teste npm run migrate
DATABASE_URL=postgresql://usuario:senha@localhost:5432/gastos_teste npm run test:integracao
```

São 23 testes: 7 unitários (normalização de números, quantidades e datas; validação do caminho das imagens) e 16 de integração. Os de integração cobrem salvamentos simultâneos do mesmo comprovante (um só gasto), a mesma foto enviada duas vezes, erro e timeout da IA, total não identificado, erro no banco (sem arquivo órfão e sem detalhes internos na resposta), cancelamento da análise, limpeza periódica, cadastros simultâneos com o mesmo e-mail, exclusão repetida, gasto de outro usuário e o resumo calculado no banco.

O CI (GitHub Actions) roda em cada push na `main` e em pull requests: no backend, gera o cliente Prisma, faz o typecheck, roda os testes unitários, aplica as migrações em um PostgreSQL 16 e roda os testes de integração; no frontend, roda o lint e o build.

## Estrutura

```text
backend/
├── prisma/
│   ├── migrations/      # migrações SQL (inclui a de idempotência)
│   └── schema.prisma
└── src/
    ├── config/          # Prisma, upload e gravação das imagens
    ├── middlewares/     # autenticação JWT
    ├── routes/          # auth, usuários, gastos e download de imagens
    ├── services/        # análise com IA e limpeza de uploads
    ├── utils/           # normalização de números e tradução de erros
    ├── tests/           # testes de integração
    ├── app.ts           # criação do app (testável)
    └── server.ts        # listen e agendamento da limpeza
frontend/
└── src/
    ├── app/             # páginas: dashboard, login e cadastro
    └── lib/api.ts       # endereço da API
docs/                    # API, publicação no Render e teste em celular
screenshots/
render.yaml              # Blueprint do Render (API + site)
```

## Limitações conhecidas

- No plano gratuito do Render, as imagens ficam no disco temporário do servidor: os dados dos gastos ficam salvos no banco, mas as fotos dos comprovantes são apagadas quando o servidor reinicia.
- O token JWT fica no `localStorage`; não há revogação de sessão nem recuperação de senha.
- A leitura depende da qualidade da foto e do modelo; por isso os dados passam por revisão antes de salvar.
- Não há rate limit nas rotas nem cota de análises por usuário.
- O frontend não tem testes automatizados (o CI roda lint e build).

## Roadmap

- [ ] Armazenamento das imagens fora do disco do servidor (object storage)
- [ ] Rate limit e cota de análises por usuário
- [ ] Filtros por período e categoria, com gráficos
- [ ] Recuperação de senha
- [ ] Testes de frontend

## Autor

**Deividi Tiago Luccas** · Desenvolvedor Full Stack · [Portfólio](https://portfolio-deividi.vercel.app/) · [GitHub](https://github.com/DeividiLuccasdev)
