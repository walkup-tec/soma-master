# Funil de prospecção — módulos (não robô de atendimento)

**Data:** 2026-07-19  
**Contexto:** Redesign do construtor de fluxo para funil de atividades/prospecção.

## Pedido

Módulos: Iniciar (imediato/agendado + badge), Pausa, Público (filtros CRM + tags + import + contagem), Disparo (modal campanha WABA → `mozart.pmo@gmail.com`), Feedback (3 saídas), Fim, E-mail Mkt (assunto/corpo + `{{nome}}` etc.).

## Solução

1. Tipos em `funnel.types.ts` — kinds novos; draft padrão start → audience → disparo → feedback → 3 fins.
2. Canvas React Flow + palette + editor por módulo.
3. Badge **Agendado** no nó Iniciar até `startedAt`.
4. Modal Público: filtros iguais ao CRM (busca, produtos, status, período, atendimento, agenda), tags (UI pronta), Excel, contagem via `countBulkClientsFn`.
5. Modal Disparo: espelha API Alternativa; **Gerar Campanha** → `POST …/integrations/soma/alternativa-campaigns`.
6. Contagem do Público a montante alimenta `plannedSendCount` no Disparo.
7. E-mail Mkt: variáveis inseríveis no assunto ou corpo conforme foco.

## Arquivos

- `src/lib/marketing/funnel.types.ts`
- `src/components/marketing/funnel/*`
- `src/lib/waba/waba-alternativa-campaign.adapter.ts`
- `src/lib/waba/waba-alternativa-campaign.server.ts`
- `src/components/marketing/marketing-panels.tsx`

## Validação

- Abrir Marketing → Funis de prospecção → Novo Funil.
- Configurar Público e ver contagem; abrir Disparo e conferir qtd. sugerida.
- Gerar Campanha exige `WABA_API_BASE_URL` + `SOMA_WABA_INTEGRATION_KEY` no Soma e endpoint no WABA.

## Pendências (runtime)

- Motor de execução (agendamento, pausa, feedback clique/chat).
- Tags no CRM (hoje só lista no funil).
- Sincronizar telefones do público como leads da campanha na execução.

## Palavras-chave

`funil-prospeccao`, `funnel-audience`, `funnel-disparo`, `alternativa-campaigns`, `email-mkt`, `feedback-clique`
