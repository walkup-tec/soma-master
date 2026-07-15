import { useCallback } from "react";
import {
  ClientActionModals,
  type ClientActionKind,
} from "@/components/clients/client-action-modals";
import { ClientAttendanceDialog } from "@/components/clients/client-attendance-dialog";
import type { ClientActivityFlags, ClientListItem } from "@/lib/clients/client.types";

type Props = {
  actionClient: ClientListItem | null;
  actionKind: ClientActionKind | null;
  onClose: () => void;
  onClientPatch: (clientId: string, patch: Partial<ClientListItem>) => void;
};

export function ClientListActionLayer({
  actionClient,
  actionKind,
  onClose,
  onClientPatch,
}: Props) {
  const updateClientActivity = useCallback(
    (clientId: string, flags: Partial<ClientActivityFlags>) => {
      onClientPatch(clientId, flags);
    },
    [onClientPatch],
  );

  const handleAttendanceOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose();
    },
    [onClose],
  );

  const handleStatusChange = useCallback(
    (clientId: string, status: string) => {
      onClientPatch(clientId, { status });
    },
    [onClientPatch],
  );

  return (
    <>
      <ClientActionModals
        client={actionClient}
        action={actionKind}
        onClose={onClose}
        onActivityChange={updateClientActivity}
      />

      <ClientAttendanceDialog
        clientId={actionClient?.id ?? null}
        open={actionKind === "attendance" && Boolean(actionClient)}
        onOpenChange={handleAttendanceOpenChange}
        onActivityChange={updateClientActivity}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}
