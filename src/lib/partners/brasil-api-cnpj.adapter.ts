export type BrazilApiCompany = {
  cnpj: string;
  legalName: string;
  tradeName: string;
  email: string;
  phone: string;
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement: string;
  number: string;
  registrationStatus: string;
};

type BrazilApiCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  email?: string | null;
  ddd_telefone_1?: string;
  cep?: string;
  descricao_tipo_de_logradouro?: string;
  logradouro?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  complemento?: string;
  numero?: string;
  descricao_situacao_cadastral?: string;
};

class PermanentCnpjLookupError extends Error {}

function retryDelayMs(response?: Response): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(2_000, Math.max(250, seconds * 1_000));
  }
  return 300 + Math.floor(Math.random() * 200);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizedStreet(data: BrazilApiCnpjResponse): string {
  const street = data.logradouro?.trim() ?? "";
  const streetType = data.descricao_tipo_de_logradouro?.trim() ?? "";
  if (
    !streetType ||
    street.toLocaleUpperCase("pt-BR").startsWith(streetType.toLocaleUpperCase("pt-BR"))
  ) {
    return street;
  }
  return `${streetType} ${street}`.trim();
}

/** Adapter da BrasilAPI: valida, limita tempo, repete falhas transitórias e normaliza o contrato. */
export async function lookupBrazilApiCnpj(rawCnpj: string): Promise<BrazilApiCompany> {
  const cnpj = rawCnpj.replace(/\D/g, "");
  if (cnpj.length !== 14) throw new Error("Informe um CNPJ com 14 dígitos.");

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });

      if (response.status === 400) {
        throw new PermanentCnpjLookupError("CNPJ inválido ou mal formatado.");
      }
      if (response.status === 404) {
        throw new PermanentCnpjLookupError("CNPJ não encontrado na Receita Federal.");
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 0) {
          await wait(retryDelayMs(response));
          continue;
        }
        throw new Error("A consulta de CNPJ está temporariamente indisponível.");
      }
      if (!response.ok) {
        throw new PermanentCnpjLookupError("Não foi possível consultar o CNPJ.");
      }

      const data = (await response.json()) as BrazilApiCnpjResponse;
      const returnedCnpj = String(data.cnpj ?? "").replace(/\D/g, "");
      if (returnedCnpj !== cnpj || !data.razao_social?.trim()) {
        throw new Error("A consulta retornou dados empresariais inválidos.");
      }

      return {
        cnpj: returnedCnpj,
        legalName: data.razao_social.trim(),
        tradeName: data.nome_fantasia?.trim() ?? "",
        email: data.email?.trim().toLowerCase() ?? "",
        phone: String(data.ddd_telefone_1 ?? "")
          .replace(/\D/g, "")
          .slice(0, 11),
        cep: String(data.cep ?? "")
          .replace(/\D/g, "")
          .slice(0, 8),
        street: normalizedStreet(data),
        neighborhood: data.bairro?.trim() ?? "",
        city: data.municipio?.trim() ?? "",
        state: data.uf?.trim().toUpperCase() ?? "",
        complement: data.complemento?.trim() ?? "",
        number: data.numero?.trim() ?? "",
        registrationStatus: data.descricao_situacao_cadastral?.trim() ?? "",
      };
    } catch (error) {
      if (error instanceof PermanentCnpjLookupError) throw error;
      lastError = error;
      if (attempt === 0) {
        await wait(retryDelayMs());
        continue;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error("A consulta do CNPJ demorou demais. Tente novamente.");
  }
  throw new Error("Não foi possível consultar o CNPJ agora. Tente novamente.");
}
