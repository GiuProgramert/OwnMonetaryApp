import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

interface Props {
  /** Columnas de la tabla real, sin contar la de acciones. */
  columns?: number;
  rows?: number;
}

export default function TableSkeleton({ columns = 5, rows = 5 }: Props) {
  const cells = Array.from({ length: columns });

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {cells.map((_, index) => (
                <TableHead key={index}>
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
              <TableHead>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {cells.map((_, index) => (
                  <TableCell key={index}>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex gap-2">
                    <Button className="h-10 w-10 p-0 bg-transparent">
                      <Skeleton className="h-10 w-10" />
                    </Button>
                    <Button className="h-10 w-10 p-0 bg-transparent">
                      <Skeleton className="h-10 w-10" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <Card key={rowIndex} className="min-w-0 overflow-hidden shadow-none">
            <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-2 space-y-0">
              <Skeleton className="h-4 w-32" />
              <div className="flex shrink-0 gap-1">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-10 w-10" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 p-4 pt-0">
              {Array.from({ length: Math.min(columns, 3) }).map((_, index) => (
                <div key={index} className="flex justify-between gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
