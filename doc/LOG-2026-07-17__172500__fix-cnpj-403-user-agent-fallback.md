# Fix consulta CNPJ: 403 por User-Agent do Node + fallback Minha Receita

## Contexto

Em produção, buscar o CNPJ 57.802.327/0001-02 no formulário PJ exibia
"Não foi possível consultar o CNPJ.".

## Causa raiz

A borda da BrasilAPI (Cloudflare/Vercel) responde **403 quando o User-Agent é o
padrão do Node/undici** (`node`). Como a consulta roda na server function, toda
busca falhava. Evidência:

- `curl` com UA de navegador → 200.
- `node -e "fetch(...)"` sem UA custom → **403**.
- `node fetch` com `user-agent: Mozilla/5.0 (compatible; SomaCRM/1.0; ...)` → 200.
- O CNPJ em si é válido (empresa MMS Marketing, situação INAPTA).

## Solução

Em `src/lib/partners/brasil-api-cnpj.adapter.ts`:

1. Header `user-agent` explícito identificando o cliente
   (`Mozilla/5.0 (compatible; SomaCRM/1.0; +https://app.somaconecta.com.br)`).
2. Fallback de provedor: alterna entre `brasilapi.com.br/api/cnpj/v1/{cnpj}` e
   `minhareceita.org/{cnpj}` (mesma fonte de dados, mesmo formato de payload),
   até 4 tentativas com backoff/jitter para 403/429/5xx/timeout/rede.
3. 400/404 continuam permanentes (CNPJ inválido/não encontrado) sem retry.

## Arquivos alterados

- `src/lib/partners/brasil-api-cnpj.adapter.ts`
- `doc/memoria.md`

## Validações

- Node fetch com UA custom na BrasilAPI: 200.
- Node fetch em minhareceita.org: 200.
- Prettier + ESLint: OK. `npm run build` (client/SSR): OK.

## Palavras-chave

`CNPJ 403`, `user-agent node fetch`, `BrasilAPI Cloudflare`, `minhareceita fallback`,
`lookupBrazilApiCnpj`
