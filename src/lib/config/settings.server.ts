import { createServerFn } from "@tanstack/react-start";
import { getSession } from "@tanstack/react-start/server";
import { sessionConfig } from "@/lib/auth/session-config";
import { saveBankOperationalGuidePdf } from "@/lib/config/bank-guide-media.service";
import {
  loadSystemSettingsFromDisk,
  saveSystemSettingsToDisk,
  type SettingsSaveSection,
} from "@/lib/config/settings.repository";
import { normalizeSettings } from "@/lib/config/settings-defaults";
import type { SystemSettings } from "@/lib/config/settings-types";

const SECTIONS = new Set<SettingsSaveSection>([
  "categories",
  "products",
  "banks",
  "attendanceStatuses",
  "all",
]);

function parseSaveInput(data: unknown): { settings: SystemSettings; section: SettingsSaveSection } {
  if (!data || typeof data !== "object") {
    throw new Error("Configurações inválidas.");
  }

  const body = data as Record<string, unknown>;

  // Novo formato: { settings, section }
  if (body.settings && typeof body.settings === "object") {
    const section = (body.section as SettingsSaveSection | undefined) ?? "all";
    if (!SECTIONS.has(section)) {
      throw new Error("Seção de configuração inválida.");
    }
    return {
      settings: normalizeSettings(body.settings as SystemSettings),
      section,
    };
  }

  // Legado: payload era o próprio SystemSettings
  if (Array.isArray(body.categories)) {
    return {
      settings: normalizeSettings(body as unknown as SystemSettings),
      section: "all",
    };
  }

  throw new Error("Configurações inválidas.");
}

export const getSystemSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  return loadSystemSettingsFromDisk();
});

export const saveSystemSettingsFn = createServerFn({ method: "POST" })
  .inputValidator(parseSaveInput)
  .handler(async ({ data }) => {
    const session = await getSession(sessionConfig);
    if (!session.data?.userId || session.data.role !== "master") {
      throw new Error("Apenas usuários master podem alterar configurações.");
    }
    return saveSystemSettingsToDisk(data.settings, data.section);
  });

export const uploadBankOperationalGuideFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Upload inválido.");
    const body = data as Record<string, unknown>;
    const fileName = String(body.fileName || "").trim();
    const base64 = String(body.base64 || "").trim();
    if (!fileName || !base64) throw new Error("Informe o PDF do roteiro.");
    return { fileName, base64 };
  })
  .handler(async ({ data }) => {
    const session = await getSession(sessionConfig);
    if (!session.data?.userId || session.data.role !== "master") {
      throw new Error("Apenas usuários master podem enviar roteiros.");
    }
    const buffer = Buffer.from(data.base64, "base64");
    return saveBankOperationalGuidePdf({ buffer, fileName: data.fileName });
  });
