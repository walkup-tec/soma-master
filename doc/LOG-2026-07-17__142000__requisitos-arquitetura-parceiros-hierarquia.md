# LOG — Requisitos e arquitetura da área Parceiros

**Data:** 2026-07-17 14:20

## Contexto do pedido

Definição inicial da área **Parceiros**, com hierarquia recursiva pai-filho, permissões individuais de menus, cadastro completo, bancos de atuação e estados Ativo/Inativo/Bloqueado.

## Regras confirmadas

### Hierarquia

- O usuário Master é a raiz da árvore e equivale ao Substabelecido principal.
- O criador torna-se automaticamente o responsável/pai do novo parceiro.
- O responsável é fixo após a criação.
- Qualquer parceiro ativo com a permissão **Cadastrar parceiros** pode criar filhos.
- Um parceiro enxerga a si e tudo abaixo dele (filhos, netos e demais descendentes).
- Um parceiro nunca enxerga o pai, irmãos ou qualquer ramo acima/lateral.
- Tornar-se pai não remove a condição de filho dentro do ramo superior.
- A hierarquia limita somente a área/cadastros de Parceiros; nesta etapa ela não amplia a visibilidade de clientes, chat, agenda, kanban ou demais dados operacionais.
- O pai pode editar, bloquear e inativar qualquer descendente do próprio ramo, não apenas filhos diretos.

Exemplo:

```text
Master
└── Substabelecido 1
    └── Substabelecido 2
```

- Master enxerga todos.
- Substabelecido 1 enxerga Substabelecido 2 e descendentes.
- Substabelecido 2 enxerga apenas a si e seus descendentes.

### Classificação

Campos separados:

1. **Categoria do parceiro:** Substabelecido, Gerente, Suporte ou Atendente.
2. **Tipo de pessoa:** Pessoa Física ou Pessoa Jurídica.

### Estados

- `active`: aparece em Ativos e pode autenticar/operar.
- `inactive`: representa Inativo/Desativado e aparece em Inativos.
- `blocked`: aparece em Bloqueados; exige motivo obrigatório.
- Bloqueio, desbloqueio, ativação, inativação e edição devem gerar histórico de eventos com autor, data e detalhes seguros.

### Permissões

- Menus selecionados individualmente no cadastro do parceiro, organizados por seções.
- Permissões devem ser aplicadas no backend e no frontend.
- A permissão específica **Cadastrar parceiros** controla quem pode criar filhos.
- O parceiro não pode conceder a um filho menu/permissão que ele próprio não possui.
- Master tem acesso total.

### Cadastro

- Categoria
- Tipo de pessoa
- Nome
- Pessoa Física: CPF e RG
- Pessoa Jurídica: CNPJ
- E-mail
- Senha
- Telefone
- WhatsApp
- Tipo de chave PIX: CPF, Telefone, E-mail ou Aleatória
- Chave PIX
- CEP
- Endereço/logradouro
- Bairro
- Cidade
- Estado
- Complemento opcional
- Número informado manualmente
- Bancos de atuação (front inicial): Banco V8, Presença Bank, Peg Card, FY Digital, Amigoz e AKI Capital

### Listagem e navegação

Subpáginas:

- Ativos
- Inativos
- Bloqueados

Colunas:

- Nome
- Tipo de usuário/categoria
- E-mail
- CPF ou CNPJ
- Telefone
- Ações: Editar, Bloquear/Desbloquear e Inativar/Ativar

Filtros globais:

- Status
- Produção: Com Produção/Sem Produção (somente front nesta etapa)
- Bancos

## Diagnóstico do projeto atual

- Usuários atuais usam `crm.users`, com `role: master|user`.
- Permissões atuais vêm de `crm.user_category_menus`, portanto são compartilhadas pela categoria.
- O novo requisito exige permissões por usuário/parceiro e hierarquia recursiva.
- A visibilidade atual dos módulos de produção permanece inalterada, pois a hierarquia vale apenas para cadastros da área Parceiros.
- O menu já possui a seção `parceiros`, atualmente vazia (“Em breve”), sem rota/API/schema.
- Não há CEP/ViaCEP, status de conta, bloqueio com motivo nem auditoria de usuários.
- Referências de UI: `clients-screen.tsx` (filtros/tabela/paginação) e `users-management.tsx` (dialog criar/editar).
- Referência de permissões por seção: `user-categories-settings.tsx`.
- Bancos já existem em Configurações (`settings.banks` / `banks-settings.tsx`); o vínculo N:N com parceiro ainda não.
- Decisões históricas preservadas: categorias sem `isPadrao`; Master continua raiz; escopo operacional de clientes permanece por assignment.

## Arquitetura proposta

### Persistência

- Evoluir `crm.users` com dados de parceiro, `parent_user_id`, `partner_category`, `person_type` e `status` (adjacency list).
- Consultas de ramo via **CTE recursiva** sobre `parent_user_id` (sem `partner_id` em clientes/chat nesta etapa).
- Criar `crm.user_menu_permissions` para permissões individuais (menus + capability `cadastrar_parceiros`).
- Criar `crm.partner_banks` para vínculo N:N com bancos.
- Criar `crm.partner_events` append-only para histórico (criar, editar, ativar, inativar, bloquear, desbloquear).
- Índices em `parent_user_id`, `status`, documentos normalizados e vínculos de bancos.
- Login/`enrichSession` devem recusar `inactive`/`blocked` e limpar sessão inválida.

### Camadas

- `partner.types.ts`: contratos públicos e enums.
- `partner.repository.ts`: SQL e CTE recursiva de descendentes.
- `partner.service.ts`: hierarquia, autorização, validações e transações.
- `partners.server.ts`: validação de entrada e server functions.
- `viacep.client.ts`: adapter HTTP com timeout e tratamento de `erro: true`.
- UI: rota `/app/parceiros` na seção `parceiros`; abas Ativos/Inativos/Bloqueados; dialog amplo de cadastro/edição.

### Segurança

- Toda consulta/mutação deve validar se o alvo está dentro do ramo visível do ator.
- Senha somente como hash; nunca retornar hash/salt.
- CPF/CNPJ, telefone, PIX e CEP normalizados antes da persistência.
- CPF/CNPJ únicos globalmente entre parceiros.
- Bloqueado/inativo não pode autenticar.
- Prevenir ciclo de hierarquia no banco/service.
- Paginação e busca no servidor.

### ViaCEP

- Integração isolada em adapter/client, com validação prévia de 8 dígitos, timeout e tratamento de `erro: true`.
- Número permanece manual.
- Fonte oficial consultada: https://viacep.com.br/

## Ações executadas

- Mapeados autenticação, usuários, menus, sessão, sidebar e escopo de clientes.
- Consultada a documentação oficial do ViaCEP.
- Confirmadas com o usuário quatro decisões ambíguas do requisito.
- Confirmado depois: hierarquia somente na área Parceiros; pai gerencia qualquer descendente; CPF/CNPJ único global.

## Como validar quando implementado

- Master vê todos os ramos.
- Pai vê e pode gerenciar filhos/netos na área Parceiros.
- Filho não vê pai, irmãos nem outros ramos.
- A hierarquia não amplia o acesso a clientes, chat, agenda ou demais dados operacionais.
- Usuário sem permissão não abre nem chama endpoints de Parceiros.
- Bloqueio sem motivo falha; bloqueado não autentica.
- Parceiro não concede permissões que não possui.
- CEP válido preenche endereço; inválido/inexistente exibe erro sem apagar número/complemento.
- Filtros, paginação e três estados funcionam no desktop e mobile.

## Pendências

- Implementação em etapas: schema/domínio, autenticação/escopo, APIs e interface.
- Regra de “Produção” e comportamento real dos bancos serão detalhados posteriormente.

## Palavras-chave

parceiros, hierarquia pai filho, parent_user_id, CTE recursiva, descendentes, substabelecido, gerente, suporte, atendente, permissões individuais, bloqueio com motivo, ViaCEP, bancos parceiros
