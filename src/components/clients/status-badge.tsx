import { Badge } from "@/components/ui/badge";
import { normalizeStatusColor, softStatusBackground } from "@/lib/config/status-colors";

type Props = {
  label: string;
  color?: string;
  className?: string;
};

export function StatusBadge({ label, color, className }: Props) {
  const hex = normalizeStatusColor(color);
  return (
    <Badge
      variant="secondary"
      className={className}
      style={{
        backgroundColor: softStatusBackground(hex, 0.16),
        color: hex,
        borderColor: softStatusBackground(hex, 0.55),
        borderWidth: 1,
      }}
    >
      <span
        className="mr-1.5 inline-block size-2 shrink-0 rounded-full"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      {label}
    </Badge>
  );
}
