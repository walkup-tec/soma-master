import { loadLocalEnvFile } from "@/lib/db/load-env-file";

export type MailMode = "smtp" | "off";

export type MailConfig = {
  mode: MailMode;
  from: string;
  appUrl: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function getMailConfig(): MailConfig {
  loadLocalEnvFile();

  const modeRaw = (process.env.MAIL_MODE ?? "off").trim().toLowerCase();
  const mode: MailMode = modeRaw === "smtp" ? "smtp" : "off";
  const port = Number(process.env.SMTP_PORT ?? "465");

  return {
    mode,
    from: (process.env.MAIL_FROM ?? "").trim(),
    appUrl: (process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "http://localhost:8080")
      .trim()
      .replace(/\/$/, ""),
    smtp: {
      host: (process.env.SMTP_HOST ?? "").trim(),
      port: Number.isFinite(port) && port > 0 ? port : 465,
      secure: parseBool(process.env.SMTP_SECURE, true),
      user: (process.env.SMTP_USER ?? "").trim(),
      // SMP_PASS = typo comum no painel; aceitar como fallback sem logar o valor.
      pass: (process.env.SMTP_PASS ?? process.env.SMP_PASS ?? "").trim(),
    },
  };
}

export function assertSmtpReady(config: MailConfig): void {
  if (config.mode !== "smtp") {
    throw new Error("Envio de e-mail desativado (MAIL_MODE diferente de smtp).");
  }
  if (!config.from) throw new Error("MAIL_FROM não configurado.");
  if (!config.smtp.host) throw new Error("SMTP_HOST não configurado.");
  if (!config.smtp.user || !config.smtp.pass) {
    throw new Error("SMTP_USER / SMTP_PASS não configurados.");
  }
}
