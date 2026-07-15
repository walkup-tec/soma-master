import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MASTER_CATEGORY_ID } from "@/lib/auth/master-user";
import { resolveCategoryHomeMenuId } from "@/lib/config/category-utils";
import { MENU_GROUPS, MENU_ITEMS, type MenuItemId } from "@/lib/config/menu-items";
import type { SettingsSaveSection } from "@/lib/config/settings.repository";
import { createEmptyCategory } from "@/lib/config/settings-defaults";
import type { SystemSettings, UserCategory } from "@/lib/config/settings-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  settings: SystemSettings;
  onChange: (settings: SystemSettings, section?: SettingsSaveSection) => Promise<SystemSettings>;
};

export function UserCategoriesSettings({ settings, onChange }: Props) {
  const [categories, setCategories] = useState<UserCategory[]>(settings.categories);
  const [selectedId, setSelectedId] = useState(settings.categories[0]?.id ?? "");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  useEffect(() => {
    setCategories(settings.categories);
    setSelectedId((current) => {
      if (current && settings.categories.some((category) => category.id === current)) return current;
      return settings.categories[0]?.id ?? "";
    });
    setCheckedIds((current) => current.filter((id) => settings.categories.some((c) => c.id === id)));
  }, [settings.categories]);

  useEffect(() => {
    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    };
  }, []);

  const selected = categories.find((c) => c.id === selectedId) ?? categories[0];
  const deletableCheckedIds = useMemo(
    () => checkedIds.filter((id) => id !== MASTER_CATEGORY_ID),
    [checkedIds],
  );

  const persistCategories = async (
    nextCategories: UserCategory[],
    options?: { successMessage?: string; quiet?: boolean },
  ) => {
    setCategories(nextCategories);
    categoriesRef.current = nextCategories;
    if (!options?.quiet) setSaving(true);
    try {
      const saved = await onChange({ ...settings, categories: nextCategories }, "categories");
      if (saved?.categories) {
        setCategories(saved.categories);
        categoriesRef.current = saved.categories;
        setSelectedId((current) => {
          if (current && saved.categories.some((category) => category.id === current)) return current;
          return saved.categories[0]?.id ?? "";
        });
        setCheckedIds((current) =>
          current.filter((id) => saved.categories.some((category) => category.id === id)),
        );
      }
      if (!options?.quiet) {
        toast.success(options?.successMessage ?? "Categorias salvas.");
      }
      return saved;
    } catch (error) {
      setCategories(settings.categories);
      categoriesRef.current = settings.categories;
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as categorias.");
      throw error;
    } finally {
      if (!options?.quiet) setSaving(false);
    }
  };

  const updateSelected = (patch: Partial<UserCategory>, options?: { debounceName?: boolean }) => {
    if (!selected) return;
    const nextCategories = categories.map((category) =>
      category.id === selected.id ? { ...category, ...patch } : category,
    );
    setCategories(nextCategories);
    categoriesRef.current = nextCategories;

    if (options?.debounceName && "name" in patch) {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      nameDebounceRef.current = setTimeout(() => {
        void persistCategories(categoriesRef.current, { quiet: true });
      }, 450);
      return;
    }

    void persistCategories(nextCategories, {
      quiet: "menuIds" in patch || "homeMenuId" in patch,
    });
  };

  const addCategory = () => {
    const category = createEmptyCategory();
    category.name = "Nova categoria";
    const nextCategories = [...categories, category];
    setSelectedId(category.id);
    void persistCategories(nextCategories, { successMessage: "Categoria criada." });
  };

  const toggleChecked = (id: string, checked: boolean) => {
    setCheckedIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  };

  const requestDeleteIds = (ids: string[]) => {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.includes(MASTER_CATEGORY_ID)) {
      toast.error("A categoria Master não pode ser excluída.");
    }
    const removable = uniqueIds.filter((id) => id !== MASTER_CATEGORY_ID);
    if (removable.length === 0) return;

    if (categories.length - removable.length < 1) {
      toast.error("Mantenha ao menos uma categoria.");
      return;
    }

    setPendingDeleteIds(removable);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteIds?.length) return;
    const idsToRemove = [...pendingDeleteIds];
    const removeSet = new Set(idsToRemove);
    const nextCategories = categories.filter((category) => !removeSet.has(category.id));

    if (nextCategories.length < 1) {
      toast.error("Mantenha ao menos uma categoria.");
      setPendingDeleteIds(null);
      return;
    }

    setPendingDeleteIds(null);
    if (selectedId && removeSet.has(selectedId)) {
      setSelectedId(nextCategories[0]?.id ?? "");
    }
    setCheckedIds((current) => current.filter((id) => !removeSet.has(id)));

    try {
      await persistCategories(nextCategories, {
        successMessage:
          idsToRemove.length > 1
            ? `${idsToRemove.length} categorias excluídas.`
            : "Categoria excluída.",
      });
    } catch {
      // toast already shown in persistCategories
    }
  };

  const deleteDialogCount = pendingDeleteIds?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="border-border/60 shadow-soft h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Categorias</CardTitle>
            <CardDescription>
              Marque uma ou mais para excluir em lote. Clique no nome para editar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {categories.map((category) => {
              const isSelected = selected?.id === category.id;
              const isChecked = checkedIds.includes(category.id);
              const isMaster = category.id === MASTER_CATEGORY_ID;

              return (
                <div
                  key={category.id}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                    isSelected
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    disabled={isMaster || saving}
                    onCheckedChange={(value) => toggleChecked(category.id, Boolean(value))}
                    aria-label={`Selecionar ${category.name || "categoria"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedId(category.id)}
                    className={`min-w-0 flex-1 rounded-md px-1 py-1 text-left text-sm ${
                      isSelected ? "font-medium" : ""
                    }`}
                  >
                    <span className="block truncate">{category.name || "Sem nome"}</span>
                    {isMaster ? (
                      <span className="block text-[11px] text-muted-foreground">Protegida</span>
                    ) : null}
                  </button>
                </div>
              );
            })}

            <div className="flex flex-col gap-2 pt-2">
              {deletableCheckedIds.length > 0 ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={saving}
                  onClick={() => requestDeleteIds(deletableCheckedIds)}
                >
                  <Trash2 className="size-4" />
                  Excluir selecionadas ({deletableCheckedIds.length})
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="w-full" disabled={saving} onClick={addCategory}>
                <Plus className="size-4" /> Nova categoria
              </Button>
            </div>
          </CardContent>
        </Card>

        {selected ? (
          <Card className="border-border/60 shadow-soft">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="font-display text-base">Editar categoria</CardTitle>
                <CardDescription>
                  Defina os menus que usuários desta categoria terão ao serem cadastrados com ela.
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={saving || selected.id === MASTER_CATEGORY_ID}
                title={
                  selected.id === MASTER_CATEGORY_ID
                    ? "A categoria Master não pode ser excluída"
                    : "Excluir categoria"
                }
                onClick={() => requestDeleteIds([selected.id])}
              >
                <Trash2 className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-md">
                <Label htmlFor="category-name">Nome da categoria</Label>
                <Input
                  id="category-name"
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value }, { debounceName: true })}
                  placeholder="Ex.: Master, Atendente, Gerente"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Menus com acesso</h3>
                  <p className="text-xs text-muted-foreground">
                    Usuários cadastrados nesta categoria verão apenas estes módulos.
                  </p>
                </div>
                {MENU_GROUPS.map((group) => (
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
                              disabled={saving}
                              onCheckedChange={(value) => {
                                const menuIds = value
                                  ? [...selected.menuIds, menu.id]
                                  : selected.menuIds.filter((id) => id !== menu.id);
                                const homeMenuId = resolveCategoryHomeMenuId(
                                  menuIds,
                                  selected.homeMenuId,
                                );
                                updateSelected({ menuIds, homeMenuId });
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

              <div className="space-y-2 max-w-md">
                <Label htmlFor="category-home">Tela Inicial</Label>
                <Select
                  value={resolveCategoryHomeMenuId(selected.menuIds, selected.homeMenuId)}
                  disabled={saving || selected.menuIds.length === 0}
                  onValueChange={(value) =>
                    updateSelected({ homeMenuId: value as MenuItemId })
                  }
                >
                  <SelectTrigger id="category-home">
                    <SelectValue placeholder="Selecione a tela inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    {MENU_ITEMS.filter((menu) => selected.menuIds.includes(menu.id)).map((menu) => (
                      <SelectItem key={menu.id} value={menu.id}>
                        {menu.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Primeira tela aberta após o login deste tipo de usuário. Só lista menus com
                  permissão nesta categoria.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AlertDialog
        open={pendingDeleteIds !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIds(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialogCount > 1 ? `Excluir ${deleteDialogCount} categorias?` : "Excluir categoria?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogCount > 1
                ? "As categorias selecionadas serão removidas. Usuários vinculados ficam sem categoria até serem reatribuídos."
                : "Esta categoria será removida. Usuários vinculados ficam sem categoria até serem reatribuídos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
