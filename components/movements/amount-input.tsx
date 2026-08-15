"use client";

import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

interface Props {
  id?: string;
  value: number | undefined;
  onChange: (value: number) => void;
}

export default function AmountInput({ id, value, onChange }: Props) {
  const [display, setDisplay] = useState(
    value ? value.toLocaleString("es-PY") : ""
  );

  useEffect(() => {
    setDisplay(value ? value.toLocaleString("es-PY") : "");
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, "");
    const numericValue = digitsOnly ? parseInt(digitsOnly, 10) : 0;

    setDisplay(digitsOnly ? numericValue.toLocaleString("es-PY") : "");
    onChange(numericValue);
  };

  return (
    <Input
      id={id}
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      className="bg-gray-600 border rounded-md p-2"
    />
  );
}
