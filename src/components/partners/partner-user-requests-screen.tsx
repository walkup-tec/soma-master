import { ClipboardList } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PartnerUserRequestRow } from "@/lib/partners/partner-user-request.types";

type Props = {
  rows?: PartnerUserRequestRow[];
};

export function PartnerUserRequestsScreen({ rows = [] }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-primary">
          <ClipboardList className="size-5" />
          <span className="text-sm font-medium">Gestão</span>
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight">Solicitação Usuário</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicitações de usuários vinculadas a parceiros, produtos e bancos.
        </p>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="font-display text-base">Listagem</CardTitle>
          <CardDescription>
            Visualize as solicitações. A carga de dados será ligada em seguida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Banco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-40 text-center text-muted-foreground">
                      Nenhuma solicitação por enquanto.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.partnerName}</TableCell>
                      <TableCell>{row.productName}</TableCell>
                      <TableCell>{row.bankName}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
