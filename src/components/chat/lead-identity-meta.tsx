import { StatusBadge } from "@/components/clients/status-badge";
import { cn } from "@/lib/utils";

export type LeadMetaChip = {
  id: string;
  label: string;
  color?: string;
};

type Props = {
  products: LeadMetaChip[];
  status: LeadMetaChip | null;
  className?: string;
};

function chipAria(products: LeadMetaChip[], status: LeadMetaChip | null) {
  const productText =
    products.length > 0 ? products.map((item) => item.label).join(", ") : "sem produto";
  const statusText = status?.label ? status.label : "sem status";
  return `Lead: ${productText}; ${statusText}`;
}

export function LeadIdentityMeta({ products, status, className }: Props) {
  const hasProducts = products.length > 0;
  const hasStatus = Boolean(status?.label);

  if (!hasProducts && !hasStatus) {
    return (
      <p className={cn("text-[11px] leading-snug text-muted-foreground", className)}>
        Sem produto e status
      </p>
    );
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1", className)}
      role="group"
      aria-label={chipAria(products, status)}
    >
      {hasProducts
        ? products.map((product) => (
            <StatusBadge
              key={product.id}
              label={product.label}
              color={product.color}
              className="max-w-full text-[10px]"
            />
          ))
        : null}
      {hasProducts && hasStatus ? (
        <span className="select-none text-[11px] text-muted-foreground/45" aria-hidden>
          ·
        </span>
      ) : null}
      {hasStatus && status ? (
        <StatusBadge
          label={status.label}
          color={status.color}
          className="max-w-full text-[10px]"
        />
      ) : null}
    </div>
  );
}
