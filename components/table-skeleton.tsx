import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export default function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Skeleton className="h-4 w-24 bg-gray-600" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-32 bg-gray-600" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-20 bg-gray-600" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-20 bg-gray-600" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-20 bg-gray-600" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-24 bg-gray-600" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32 bg-gray-600" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 bg-gray-600" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20 bg-gray-600" />
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button className="h-10 w-10 p-0 bg-transparent">
                  <Skeleton className="h-10 w-10 bg-gray-600" />
                </Button>
                <Button className="h-10 w-10 p-0 bg-transparent">
                  <Skeleton className="h-10 w-10 bg-gray-600" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
