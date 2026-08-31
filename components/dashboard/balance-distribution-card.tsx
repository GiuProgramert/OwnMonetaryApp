import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccountsBalanceDistribution } from "@/lib/services/dashboard";
import BalancePieChart from "@/components/dashboard/balance-pie-chart";

export default async function BalanceDistributionCard() {
  const { slices, total, hasNonPositive } = await getAccountsBalanceDistribution();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución del saldo actual</CardTitle>
        <CardDescription>
          No depende del rango de fechas seleccionado: muestra el saldo actual de cada cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cuentas creadas.</p>
        ) : (
          <BalancePieChart slices={slices} total={total} hasNonPositive={hasNonPositive} />
        )}
      </CardContent>
    </Card>
  );
}
