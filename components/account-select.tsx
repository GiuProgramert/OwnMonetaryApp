"use client";

import { Account } from "@/lib/schemas/accounts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  id?: string;
  accounts: Pick<Account, "id" | "name" | "color">[];
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
}

export default function AccountSelect({
  id,
  accounts,
  value,
  onChange,
  placeholder = "Selecciona una cuenta",
  allLabel,
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value="all">{allLabel}</SelectItem>}
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <div className="flex items-center gap-2">
              <div
                style={{ backgroundColor: account.color }}
                className="w-3 h-3 rounded-full shrink-0"
              />
              <span>{account.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
