export type ViaCepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | "true";
};

/** Adapter isolado do ViaCEP: valida entrada, limita tempo e normaliza o contrato externo. */
export async function lookupViaCep(rawCep: string): Promise<ViaCepAddress> {
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Não foi possível consultar o CEP.");
    const data = (await response.json()) as ViaCepResponse;
    if (data.erro === true || data.erro === "true") throw new Error("CEP não encontrado.");
    return {
      cep: (data.cep ?? cep).replace(/\D/g, ""),
      street: data.logradouro?.trim() ?? "",
      neighborhood: data.bairro?.trim() ?? "",
      city: data.localidade?.trim() ?? "",
      state: data.uf?.trim().toUpperCase() ?? "",
      complement: data.complemento?.trim() ?? "",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A consulta do CEP demorou demais. Tente novamente.");
    }
    throw error instanceof Error ? error : new Error("Não foi possível consultar o CEP.");
  } finally {
    clearTimeout(timeout);
  }
}
