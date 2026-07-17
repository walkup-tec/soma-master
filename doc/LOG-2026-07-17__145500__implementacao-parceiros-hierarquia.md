# LOG — Implementação da área Parceiros com hierarquia

**Data:** 2026-07-17 14:55

## Contexto

Implementação completa da primeira etapa da área **Parceiros**, conforme requisitos confirmados:

- hierarquia recursiva pai-filho restrita aos cadastros de Parceiros;
- Master como raiz;
- criador como responsável/pai fixo;
- categorias Substabelecido, Gerente, Suporte e Atendente;
- tipo de pessoa PF/PJ;
- permissões individuais de menus;
- estados Ativo, Inativo e Bloqueado;
- bloqueio obrigatório com motivo e histórico;
- filtros de status, produção e bancos;
- cadastro completo, PIX, endereço e ViaCEP.

## Solução implementada

### Banco e hierarquia

- Nova tabela `crm.partner_profiles`, ligada 1:1 a `crm.users`.
- `parent_user_id` implementa adjacency list; consultas usam CTE recursiva.
- Master e usuários existentes são migrados idempotentemente para perfis.
- CPF/CNPJ possui índice único global.
- `crm.user_menu_permissions` armazena menus individuais.
- `crm.partner_banks` armazena vínculo N:N com os bancos do front.
- `crm.partner_events` mantém histórico append-only.
- DDL idempotente é executado no boot por `ensurePartnerSchema`.

### Segurança e regras

- Pai lista e gerencia qualquer descendente do próprio ramo.
- Filho não acessa pai, irmãos ou outros ramos.
- O responsável é definido automaticamente pelo ator e não pode ser alterado no formulário.
- Parceiro só cria filhos se estiver ativo e possuir `can_create_partners`.
- Parceiro não concede menu que ele próprio não possui; Master concede qualquer menu.
- CPF e CNPJ validados por dígitos verificadores e únicos globalmente.
- E-mail único; senha inicial mínima de 8 caracteres.
- Senhas continuam usando o hash seguro já adotado pelo projeto.
- Login e revalidação de sessão recusam parceiros inativos/bloqueados.
- Motivo do bloqueio é obrigatório e persistido no histórico.

### Interface

- Nova rota `/app/parceiros` e item na seção Parceiros da sidebar.
- Abas responsivas: Ativos, Inativos e Bloqueados, com contadores.
- Busca por nome, e-mail, documento ou telefone.
- Filtros por Produção e múltiplos Bancos.
- Paginação server-side.
- Colunas: Nome, Tipo de usuário, E-mail, CPF/CNPJ, Telefone, Status e Ações.
- Ações: Editar, Histórico, Ativar, Inativar e Bloquear.
- Dialog completo para PF/PJ, contato, PIX, endereço, bancos e permissões.
- Layout responsivo com scroll seguro em tabela, tabs e formulário.

### ViaCEP

- Adapter server-side desacoplado com timeout de 5 segundos.
- Valida CEP com 8 dígitos e trata `erro: true`.
- Preenche logradouro, bairro, cidade e UF; número permanece manual.
- Documentação oficial consultada: https://viacep.com.br/

## Arquivos criados

- `src/lib/db/ensure-partner-schema.ts`
- `src/lib/partners/partner.types.ts`
- `src/lib/partners/partner.constants.ts`
- `src/lib/partners/partner.repository.ts`
- `src/lib/partners/partner.service.ts`
- `src/lib/partners/partners.server.ts`
- `src/lib/partners/viacep.adapter.ts`
- `src/components/partners/partner-form-dialog.tsx`
- `src/components/partners/partners-screen.tsx`
- `src/routes/app/parceiros.tsx`

## Arquivos alterados

- `src/lib/db/postgres.ts`
- `src/lib/auth/auth.server.ts`
- `src/lib/config/menu-items.ts`
- `src/lib/config/menu-nav.tsx`
- `src/components/app-topbar.tsx`
- `src/routeTree.gen.ts`
- `doc/memoria.md`

## Comandos e validações

1. `npm run build`
   - primeira tentativa: client compilou; SSR bloqueou `viacep.client.ts` porque o sufixo `.client` é reservado a código browser-only;
   - causa corrigida renomeando para `viacep.adapter.ts`;
   - build final client + SSR: **OK**.
2. ESLint nos arquivos criados/alterados: **OK, zero erros**.
3. TypeScript filtrado nos arquivos do domínio Parceiros: **nenhum erro novo**.
   - erros globais antigos de sessão/`BufferSource` permanecem fora deste escopo.
4. Servidor local `npm run dev`: iniciou e respondeu `GET /login` com HTTP 200.
5. Boot conectado ao Postgres executou o schema de Parceiros sem erro; apenas notices idempotentes de objetos já existentes.
6. Servidor local encerrado após a validação.

## Observações de segurança

- Nenhuma credencial, chave PIX real ou segredo foi incluído no código/log.
- ViaCEP não recebe dados além do CEP.
- A hierarquia não amplia o acesso a clientes, chat, agenda, kanban ou produção.
- Produção e bancos estão preparados no front/persistência, mas regras comerciais continuam pendentes conforme solicitado.

## Pendências

- Teste funcional autenticado no navegador após deploy.
- Detalhar regra real de “Com Produção/Sem Produção”.
- Detalhar operação comercial dos bancos.

## Palavras-chave

parceiros, pai filho, hierarquia recursiva, parent_user_id, CTE, permissões individuais, bloqueio, histórico, ViaCEP, CPF CNPJ, bancos, produção
