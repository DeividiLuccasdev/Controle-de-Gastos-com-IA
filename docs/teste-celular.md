# Teste em celular

O projeto foi testado em smartphone Android conectado à mesma rede do computador, permitindo fotografar comprovantes diretamente pelo aparelho.

## Como funciona

- A API escuta em `0.0.0.0` (porta `3001` por padrão), então aceita conexões de outros aparelhos da rede local.
- Sem `NEXT_PUBLIC_API_URL`, o frontend monta o endereço da API com o mesmo host da página e a porta 3001 (`http://<ip-do-computador>:3001`), ver [`frontend/src/lib/api.ts`](../frontend/src/lib/api.ts).
- O campo de upload usa `accept="image/*"` e `capture="environment"`, que abre a câmera traseira no celular.

## Passo a passo

1. Suba o backend (`npm run dev` em `backend/`) e o frontend (`npm run dev` em `frontend/`) no computador.
2. Descubra o IP do computador na rede local (ex.: `ipconfig` no Windows ou `ip addr` no Linux).
3. No celular, conectado à mesma rede, abra `http://<ip-do-computador>:3000`.
4. Se o celular não conseguir acessar, verifique se o firewall do computador libera as portas 3000 e 3001.
