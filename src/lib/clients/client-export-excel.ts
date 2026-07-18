import * as XLSX from "xlsx";
import {
  ALL_CLIENT_FIELD_IDS,
  clientFieldLabel,
  type ClientFieldId,
} from "@/lib/config/client-fields";
import { normalizeWhatsAppPhone } from "@/lib/chat/phone";
import type { BulkExportClientRecord } from "@/lib/clients/client-bulk.repository";

/**
 * WhatsApp no formato EVO: só dígitos com DDI 55 (ex.: 5511987654321).
 * Sem +, espaços ou máscara — pronto para sendText / número da Evolution.
 */
export function formatWhatsAppForEvo(raw: string | null | undefined): string {
  const source = String(raw || "").trim();
  if (!source) return "";
  return normalizeWhatsAppPhone(source);
}

function pickWhatsAppRaw(data: Record<string, string>): string {
  return String(data.whatsapp || data.telefone || "").trim();
}

export function buildClientsExportWorkbook(input: {
  clients: BulkExportClientRecord[];
  productNameById: Record<string, string>;
  statusLabelById: Record<string, string>;
}): XLSX.WorkBook {
  const fieldIds = ALL_CLIENT_FIELD_IDS as ClientFieldId[];
  const headers = [
    "ID",
    "Status",
    "Produto",
    "Criado em",
    ...fieldIds.map((id) => clientFieldLabel(id)),
  ];

  const whatsappColIndex = headers.indexOf(clientFieldLabel("whatsapp"));

  const aoa: string[][] = [headers];
  for (const client of input.clients) {
    const row: string[] = [
      client.id,
      input.statusLabelById[client.status] || client.status || "",
      input.productNameById[client.productId] || client.productId || "",
      client.createdAt
        ? new Date(client.createdAt).toLocaleString("pt-BR")
        : "",
    ];
    for (const fieldId of fieldIds) {
      if (fieldId === "whatsapp") {
        row.push(formatWhatsAppForEvo(pickWhatsAppRaw(client.data)));
      } else {
        row.push(String(client.data[fieldId] ?? ""));
      }
    }
    aoa.push(row);
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // Garante coluna WhatsApp como texto (evita notação científica no Excel).
  if (whatsappColIndex >= 0) {
    for (let r = 1; r < aoa.length; r += 1) {
      const addr = XLSX.utils.encode_cell({ r, c: whatsappColIndex });
      const cell = sheet[addr];
      if (!cell) continue;
      const value = String(cell.v ?? "");
      cell.t = "s";
      cell.v = value;
      cell.z = "@";
      cell.w = value;
    }
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Clientes");
  return book;
}

export function workbookToBase64(book: XLSX.WorkBook): string {
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(buffer).toString("base64");
}
