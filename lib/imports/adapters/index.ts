import { BankAdapter } from "@/lib/imports/types";
import { itauCuentaXlsxAdapter } from "@/lib/imports/adapters/itau-cuenta-xlsx";

export const ADAPTERS: BankAdapter[] = [itauCuentaXlsxAdapter];
