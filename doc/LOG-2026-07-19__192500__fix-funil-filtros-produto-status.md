# Fix filtros produto/status no modal Público

Popover do MultiSelect abria em z-50 atrás do Dialog z-200 e o Dialog modal bloqueava cliques no portal.

Fix: Popover modal + z-[250] no funil; onInteractOutside ignora popover.
