import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MENU_ITEMS } from "@/lib/config/menu-items";
import { createEmptyCategory } from "@/lib/config/settings-defaults";
import type { SystemSettings, UserCategory } from "@/lib/config/settings-types";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings) => void;
};

export function UserCategoriesSettings({ settings, onChange }: Props) {
  const [selectedId, setSelectedId] = useState(settings.defaultCategoryId);
  const selected = settings.categories.find((c) => c.id === selectedId) ?? settings.categories[0];

  const updateCategories = (categories: UserCategory[], defaultCategoryId = settings.defaultCategoryId) => {
    onChange({ ...settings, categories, defaultCategoryId });
  };

  const updateSelected = (patch: Partial<UserCategory>) => {
    if (!selected) return;
    updateCategories(settings.categories.map((c) => (c.id === selected.id ? { ...c, ...patch } : c)));
  };

  const setDefaultCategory = (id: string) => {
    const categories = settings.categories.map((c) => ({ ...c, isDefault: c.id === id }));
    onChange({ ...settings, defaultCategoryId: id, categories });
    toast.success("Categoria padrão atualizada.");
  };

  const addCategory = () => {
    const category = createEmptyCategory();
    category.name = "Nova categoria";
    updateCategories([...settings.categories, category]);
    setSelectedId(category.id);
  };

  const removeCategory = (id: string) => {
    if (settings.categories.length <= 1) {
      toast.error("Mantenha ao menos uma categoria.");
      return;
    }
    const categories = settings.categories.filter((c) => c.id !== id);
    const defaultCategoryId =
      settings.defaultCategoryId === id ? categories[0].id : settings.defaultCategoryId;
    updateCategories(categories, defaultCategoryId);
    setSelectedId(defaultCategoryId);
  };

  const menuGroups = ["Operação", "Comercial", "Gestão"] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="border-border/60 shadow-soft h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Categorias</CardTitle>
          <CardDescription>Defina perfis de acesso ao sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {settings.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedId(category.id)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selected?.id === category.id
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/60 hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">{category.name || "Sem nome"}</span>
              {category.isDefault ? (
                <Badge variant="secondary" className="text-[10px]">
                  Padrão
                </Badge>
              ) : null}
            </button>
          ))}
          <Button type="button" variant="outline" className="w-full" onClick={addCategory}>
            <Plus className="size-4" /> Nova categoria
          </Button>
        </CardContent>
      </Card>

      {selected ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="font-display text-base">Editar categoria</CardTitle>
              <CardDescription>Nome da categoria e menus liberados para este perfil.</CardDescription>
            </div>
            <div className="flex gap-2">
              {!selected.isDefault ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setDefaultCategory(selected.id)}>
                  <Star className="size-4" /> Definir como padrão
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => removeCategory(selected.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 max-w-md">
              <Label htmlFor="category-name">Nome da categoria</Label>
              <Input
                id="category-name"
                value={selected.name}
                onChange={(e) => updateSelected({ name: e.target.value })}
                placeholder="Ex.: Atendente, Supervisor, Master"
              />
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Menus com acesso</h3>
                <p className="text-xs text-muted-foreground">
                  Marque os módulos que usuários desta categoria podem visualizar.
                </p>
              </div>
              {menuGroups.map((group) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MENU_ITEMS.filter((m) => m.group === group).map((menu) => {
                      const checked = selected.menuIds.includes(menu.id);
                      return (
                        <label
                          key={menu.id}
                          className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              const menuIds = value
                                ? [...selected.menuIds, menu.id]
                                : selected.menuIds.filter((id) => id !== menu.id);
                              updateSelected({ menuIds });
                            }}
                          />
                          {menu.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
