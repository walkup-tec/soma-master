# LOG — Reimplantação do zero: SV → Soma

## Pedido

Apagar projeto Soma; copiar Sinal Verde; manter só logos/favicon, `.env` e cores do `styles.css`; adaptar o necessário; avisar quando testar.

## Preservado

- Backup: `D:\Soma-reimplant-preserve-20260716-142637`
- `.env.local` (Supabase Soma + SESSION_SECRET)
- `public/brand/*`, favicons Soma, `src/assets/brand/*`
- `src/styles.css` (cores magenta `#be1c6a` / lima / azul)
- `src/components/logo.tsx` + `src/lib/theme/soma-theme.ts`
- `.git` → remote `soma-master`

## Feito

1. Wipe `D:\Soma` (mantido `.git`)
2. Robocopy código de `D:\CRM-SinalVerde` (sem `.git`/`.env` SV)
3. Restaurado env/logos/cores/logo/theme/`__root`
4. Porta **3090**, cookie `soma-promotora-session`, textos Soma Promotora no login
5. `node_modules`: cópia física falhou (locks Windows) → **junction temporária** para `D:\CRM-SinalVerde\node_modules` para subir o app

## Acesso

- URL: http://127.0.0.1:3090/login
- Login master (seed SV + alias): `walkup@walkuptec.com.br` ou `mozart@sinalverde.com` (senha do seed/env)

## Pendência obrigatória

Substituir junction por `node_modules` físico próprio (quando sem locks):  
`robocopy D:\CRM-SinalVerde\node_modules D:\Soma\node_modules /E /COPY:DAT`

## Keywords

reimplant, sinal-verde, soma, logos, env, cores, junction temporaria
