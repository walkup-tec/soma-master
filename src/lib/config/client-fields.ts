export type ClientFieldId =

  | "nome"

  | "cpf"

  | "rg"

  | "data_nascimento"

  | "sexo"

  | "estado_civil"

  | "telefone"

  | "whatsapp"

  | "email"

  | "tipo_logradouro"

  | "logradouro"

  | "numero_logradouro"

  | "complemento"

  | "bairro"

  | "cidade"

  | "uf"

  | "tipo_cliente"

  | "empresa"

  | "tempo_empresa"

  | "renda_mensal"

  | "possui_mei"

  | "possui_carteira_assinada"

  | "score"

  | "restricao_spc_serasa"

  | "margem_disponivel"

  | "parcelas_atraso"

  | "contratos_ativos"

  | "valor_desejado"

  | "valor_liberado"

  | "data_ultima_parcela"

  | "banco";



export type ClientFieldGroupId = "pessoais" | "profissionais" | "financeiros";



export type ClientFieldDefinition = {

  id: ClientFieldId;

  label: string;

  hint?: string;

};



export type ClientFieldGroup = {

  id: ClientFieldGroupId;

  title: string;

  fields: ClientFieldDefinition[];

};



export const CLIENT_FIELD_GROUPS: ClientFieldGroup[] = [

  {

    id: "pessoais",

    title: "Dados pessoais",

    fields: [

      { id: "nome", label: "Nome" },

      { id: "cpf", label: "CPF" },

      { id: "rg", label: "RG" },

      { id: "data_nascimento", label: "Data de nascimento" },

      { id: "sexo", label: "Sexo" },

      { id: "estado_civil", label: "Estado civil" },

      { id: "telefone", label: "Telefone" },

      { id: "whatsapp", label: "WhatsApp" },

      { id: "email", label: "Email" },

      { id: "tipo_logradouro", label: "Tipo logradouro" },

      { id: "logradouro", label: "Logradouro" },

      { id: "numero_logradouro", label: "Número (no logradouro)" },

      { id: "complemento", label: "Complemento" },

      { id: "bairro", label: "Bairro" },

      { id: "cidade", label: "Cidade" },

      { id: "uf", label: "UF" },

    ],

  },

  {

    id: "profissionais",

    title: "Dados profissionais",

    fields: [

      {

        id: "tipo_cliente",

        label: "Tipo de cliente",

        hint: "CLT, Autônomo, Aposentado, Pensionista, Profissional liberal",

      },

      { id: "empresa", label: "Empresa" },

      { id: "tempo_empresa", label: "Tempo de Empresa" },

      { id: "renda_mensal", label: "Renda mensal" },

      { id: "possui_mei", label: "Possui MEI" },

      { id: "possui_carteira_assinada", label: "Possui carteira assinada" },

    ],

  },

  {

    id: "financeiros",

    title: "Dados financeiros",

    fields: [

      { id: "score", label: "Score" },

      { id: "restricao_spc_serasa", label: "Restrição SPC/SERASA" },

      { id: "margem_disponivel", label: "Margem disponível" },

      { id: "parcelas_atraso", label: "Parcelas em atraso" },

      { id: "contratos_ativos", label: "Contratos ativos" },

      { id: "valor_desejado", label: "Valor desejado" },

      { id: "valor_liberado", label: "Valor liberado" },

      { id: "data_ultima_parcela", label: "Data última parcela", hint: "Formato dd/mm/aaaa" },

      { id: "banco", label: "Banco", hint: "Opcional em todos os produtos; opções em Configurações → Bancos" },

    ],

  },

];



export const ALL_CLIENT_FIELD_IDS = CLIENT_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.id));



/** IDs removidos ou renomeados — usado na migração de produtos salvos. */

export const LEGACY_CLIENT_FIELD_IDS: Record<string, ClientFieldId | null> = {

  endereco_completo: null,

  tempo_trabalho: "tempo_empresa",

};



export function clientFieldLabel(id: ClientFieldId): string {

  for (const group of CLIENT_FIELD_GROUPS) {

    const field = group.fields.find((f) => f.id === id);

    if (field) return field.label;

  }

  return id;

}


