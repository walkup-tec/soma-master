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
  | "endereco_completo"
  | "tipo_cliente"
  | "empresa"
  | "tempo_trabalho"
  | "renda_mensal"
  | "possui_mei"
  | "possui_carteira_assinada"
  | "score"
  | "restricao_spc_serasa"
  | "margem_disponivel"
  | "parcelas_atraso"
  | "contratos_ativos"
  | "valor_desejado"
  | "valor_liberado";

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
      { id: "endereco_completo", label: "Endereço completo" },
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
      { id: "tempo_trabalho", label: "Tempo de trabalho" },
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
    ],
  },
];

export const ALL_CLIENT_FIELD_IDS = CLIENT_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.id));

export function clientFieldLabel(id: ClientFieldId): string {
  for (const group of CLIENT_FIELD_GROUPS) {
    const field = group.fields.find((f) => f.id === id);
    if (field) return field.label;
  }
  return id;
}
