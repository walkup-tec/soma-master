# LOG — Fix import-protection em Configurações

## Contexto

Overlay Vite: `Import was denied in client environment` — `configuracoes.tsx` importava `@tanstack/react-start/server` (`getSession`) e repos de chat no route do client tree.

## Solução

- Loader ChatBot via `getChatbotSettingsLoaderFn` em `chat.server.ts` (createServerFn POST)
- `configuracoes.tsx` só chama a RPC
- `chat.tsx`: `getSystemSettingsFn` em vez de `loadSystemSettingsFromDisk` direto

## Validação

- `/src/routes/app/configuracoes.tsx` → 200 (sem import-protection)
- login 200

## Keywords

import-protection, getSession, createServerFn, configuracoes, chatbot
