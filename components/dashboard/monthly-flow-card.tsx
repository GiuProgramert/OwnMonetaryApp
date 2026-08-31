import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonthlyFlow } from "@/lib/services/dashboard";
import MonthlyFlowChart from "@/components/dashboard/monthly-flow-chart";
import { DashboardFilter } from "@/lib/schemas/dashboard";

interface Props {
  filter: DashboardFilter;
}

export default async function MonthlyFlowCard({ filter }: Props) {
  const flow = await getMonthlyFlow(filter);

  if (flow.length <= 1) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución mensual</CardTitle>
        <CardDescription>Ingresos, egresos y balance neto por mes.</CardDescription>
      </CardHeader>
      <CardContent>
        <MonthlyFlowChart flow={flow} />
      </CardContent>
    </Card>
  );
}
