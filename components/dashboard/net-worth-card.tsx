import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccounts } from "@/lib/services/accounts";
import { formatCurrency } from "@/lib/dashboard/format";

export default async function NetWorthCard() {
  const accounts = await getAccounts();
  const total = accounts.reduce((sum, account) => sum + account.current_balance, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">Patrimonio total</CardTitle>
        <CardDescription>Saldo actual, no depende del período seleccionado.</CardDescription>
      </CardHeader>
      <CardContent className="text-xl font-semibold">{formatCurrency(total)}</CardContent>
    </Card>
  );
}
