import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientRowActions } from "@/components/clients/client-row-actions";
import { StatusBadge } from "@/components/clients/status-badge";
import type { ClientActionKind } from "@/components/clients/client-action-modals";
import type { ClientListItem } from "@/lib/clients/client.types";
import { formatLocalDateLabel } from "@/lib/dates/local-date";

type ProductBadgeInfo = { label: string; color: string };

type Props = {
  items: Array<ClientListItem & { contactDate?: string }>;
  productMeta: (productId: string) => ProductBadgeInfo;
  statusLabel: (statusId: string) => string;
  statusColor?: (statusId: string) => string;
  onAction: (client: ClientListItem, action: ClientActionKind) => void;
  dimmed?: boolean;
  /** Exibe coluna com a data de contato da agenda (Remarketing). */
  showContactDate?: boolean;
  /** Quando omitido (ex.: Agenda), a coluna de seleção fica ocultada. */
  selectedIds?: Set<string>;
  allFilteredSelected?: boolean;
  onToggleRow?: (clientId: string, checked: boolean) => void;
  onTogglePage?: (checked: boolean) => void;
};

function primaryValue(client: ClientListItem) {
  return client.nome ?? client.cpf ?? client.telefone ?? client.id;
}

function productIdsOf(client: ClientListItem): string[] {
  return client.productIds?.length ? client.productIds : [client.productId];
}

export function ClientsDataTable({
  items,
  productMeta,
  statusLabel,
  statusColor,
  onAction,
  dimmed,
  showContactDate = false,
  selectedIds,
  allFilteredSelected = false,
  onToggleRow,
  onTogglePage,
}: Props) {
  const selectionEnabled = Boolean(selectedIds && onToggleRow && onTogglePage);
  const pageIds = items.map((item) => item.id);
  const allPageChecked =
    selectionEnabled &&
    pageIds.length > 0 &&
    (allFilteredSelected || pageIds.every((id) => selectedIds!.has(id)));
  const somePageChecked =
    selectionEnabled && pageIds.some((id) => selectedIds!.has(id)) && !allPageChecked;

  return (
    <div className={dimmed ? "pointer-events-none opacity-60" : undefined}>
      <Table>
        <TableHeader>
          <TableRow>
            {selectionEnabled ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageChecked ? true : somePageChecked ? "indeterminate" : false}
                  onCheckedChange={(value) => onTogglePage?.(Boolean(value))}
                  aria-label="Selecionar página"
                />
              </TableHead>
            ) : null}
            <TableHead>Cliente</TableHead>
            {showContactDate ? <TableHead>Agenda</TableHead> : null}
            <TableHead>Produto</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[140px] text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((client) => {
            const checked =
              selectionEnabled && (allFilteredSelected || selectedIds!.has(client.id));
            return (
              <TableRow key={client.id}>
                {selectionEnabled ? (
                  <TableCell>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => onToggleRow?.(client.id, Boolean(value))}
                      aria-label={`Selecionar ${primaryValue(client)}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell className="font-medium">{primaryValue(client)}</TableCell>
                {showContactDate ? (
                  <TableCell className="text-muted-foreground">
                    {client.contactDate ? formatLocalDateLabel(client.contactDate) : "—"}
                  </TableCell>
                ) : null}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {productIdsOf(client).map((id) => {
                      const meta = productMeta(id);
                      return <StatusBadge key={id} label={meta.label} color={meta.color} />;
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={statusLabel(client.status)}
                    color={statusColor?.(client.status)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <ClientRowActions client={client} onAction={onAction} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
