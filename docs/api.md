# API

API REST em Express (`backend/src`). Todas as respostas são JSON; as rotas marcadas com **JWT** exigem o cabeçalho `Authorization: Bearer <token>` obtido em `POST /auth/login`.

## Rotas

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| `GET` | `/` | | Status da API (usado como health check no Render) |
| `GET` | `/teste-banco` | | Verifica a conexão com o PostgreSQL |
| `POST` | `/usuarios` | | Cadastro (`nome`, `email`, `senha` com pelo menos 6 caracteres) |
| `POST` | `/auth/login` | | Login (`email`, `senha`); devolve o token JWT (7 dias) e os dados do usuário |
| `POST` | `/gastos/foto` | JWT | Upload multipart do campo `comprovante` (JPEG, PNG ou WEBP, até 10 MB); devolve o `imagemUrl` |
| `POST` | `/gastos/analisar` | JWT | Analisa a imagem (`imagemUrl`) com a IA e devolve os dados extraídos, sem salvar |
| `POST` | `/gastos` | JWT | Salva um gasto (com ou sem `imagemUrl`); `total` é obrigatório |
| `POST` | `/gastos/analisar-e-salvar` | JWT | Analisa a imagem e salva o gasto em uma única chamada |
| `GET` | `/gastos` | JWT | Lista os gastos do usuário com os itens, do mais recente ao mais antigo |
| `GET` | `/gastos/resumo` | JWT | Total e quantidade de gastos, calculados pelo banco |
| `DELETE` | `/gastos/foto` | JWT | Descarta uma imagem que não virou gasto (análise cancelada) |
| `DELETE` | `/gastos/:id` | JWT | Exclui um gasto do usuário e a imagem associada |
| `GET` | `/uploads/:usuarioId/:arquivo` | JWT | Baixa a imagem de um comprovante do próprio usuário |

## Formato extraído pela IA

```json
{
  "estabelecimento": "string ou null",
  "dataCompra": "YYYY-MM-DD ou null",
  "total": 0,
  "categoria": "string ou null",
  "itens": [
    { "produto": "string", "quantidade": 1, "valorUnitario": 0, "valorTotal": 0 }
  ]
}
```

A resposta do modelo é normalizada no backend: números em formato brasileiro ou internacional, quantidade inteira e positiva, e data aceita apenas em `YYYY-MM-DD` válido.

## Respostas relevantes

| Situação | Status |
| --- | --- |
| Gasto criado | `201` |
| Comprovante já salvo (mesmo `imagemUrl` ou mesma foto) | `200` com `duplicado: true` e o gasto existente |
| Exclusão (inclusive repetida, ou de gasto de outro usuário) | `204` |
| Descarte de foto (inclusive repetido) | `204` |
| Arquivo grande demais, formato não permitido ou imagem inválida | `400` |
| Token ausente, inválido ou expirado | `401` |
| E-mail já cadastrado | `409` |
| IA não identificou o valor total (`analisar-e-salvar`) | `422` |
| IA respondeu sem JSON aproveitável | `502` |
| IA indisponível (sem chave, chave inválida ou limite de uso) | `503` |
| IA demorou mais que o limite | `504` |
| Erro interno | `500` com mensagem genérica; detalhes só no log |
