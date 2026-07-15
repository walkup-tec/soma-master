import { DatePickerField } from "@/components/ui/date-picker-field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import type { LeadDistribution } from "@/lib/clients/client.types";
import type { UserCategory } from "@/lib/config/settings-types";

export type DistributionUser = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  distributionType: LeadDistribution["type"];
  onDistributionTypeChange: (type: LeadDistribution["type"]) => void;
  categoryIds: string[];
  onCategoryIdsChange: (ids: string[]) => void;
  userIds: string[];
  onUserIdsChange: (ids: string[]) => void;
  categories: UserCategory[];
  users: DistributionUser[];
  /** YYYY-MM-DD opcional — Agendamento Contato para os leads. */
  scheduleContactDate?: string;
  onScheduleContactDateChange?: (isoDate: string) => void;
};

export function LeadDistributionForm({
  distributionType,
  onDistributionTypeChange,
  categoryIds,
  onCategoryIdsChange,
  userIds,
  onUserIdsChange,
  categories,
  users,
  scheduleContactDate = "",
  onScheduleContactDateChange,
}: Props) {
  return (
    <div className="space-y-4">
      <Label>Distribuição de leads</Label>
      <RadioGroup
        value={distributionType}
        onValueChange={(value) => onDistributionTypeChange(value as LeadDistribution["type"])}
      >
        <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
          <RadioGroupItem value="all" />
          <span className="text-sm">Para todos os usuários</span>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
          <RadioGroupItem value="category" />
          <span className="text-sm">Para categoria(s) específica(s)</span>
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
          <RadioGroupItem value="users" />
          <span className="text-sm">Para usuário(s) específico(s)</span>
        </label>
      </RadioGroup>

      {distributionType === "category" ? (
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={categoryIds.includes(category.id)}
                onCheckedChange={(checked) => {
                  onCategoryIdsChange(
                    checked
                      ? [...categoryIds, category.id]
                      : categoryIds.filter((id) => id !== category.id),
                  );
                }}
              />
              {category.name}
            </label>
          ))}
        </div>
      ) : null}

      {distributionType === "users" ? (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-3">
          {users.map((user) => (
            <label key={user.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={userIds.includes(user.id)}
                onCheckedChange={(checked) => {
                  onUserIdsChange(
                    checked ? [...userIds, user.id] : userIds.filter((id) => id !== user.id),
                  );
                }}
              />
              {user.name} ({user.email})
            </label>
          ))}
        </div>
      ) : null}

      {onScheduleContactDateChange ? (
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <Label htmlFor="schedule-contact-date">Agendamento Contato</Label>
          <p className="text-xs text-muted-foreground">
            Opcional. Agenda o contato nesta data para os usuários da distribuição (Agenda, Remarketing e
            Kanban de cada um). Os leads também entram na lista de Clientes.
          </p>
          <DatePickerField
            id="schedule-contact-date"
            value={scheduleContactDate}
            onChange={onScheduleContactDateChange}
            placeholder="Selecionar data do contato"
            allowClear
            className="w-full"
          />
        </div>
      ) : null}
    </div>
  );
}

export function buildLeadDistribution(
  type: LeadDistribution["type"],
  categoryIds: string[],
  userIds: string[],
): LeadDistribution {
  if (type === "all") return { type: "all" };
  if (type === "category") return { type: "category", categoryIds };
  return { type: "users", userIds };
}

export function isDistributionValid(
  type: LeadDistribution["type"],
  categoryIds: string[],
  userIds: string[],
): boolean {
  if (type === "category") return categoryIds.length > 0;
  if (type === "users") return userIds.length > 0;
  return true;
}
