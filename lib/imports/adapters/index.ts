import { BankAdapter } from "@/lib/imports/types";
import { itauCuentaXlsxAdapter } from "@/lib/imports/adapters/itau-cuenta-xlsx";
import { solarAhorrosPdfAdapter } from "@/lib/imports/adapters/solar-ahorros-pdf";

export const ADAPTERS: BankAdapter[] = [itauCuentaXlsxAdapter, solarAhorrosPdfAdapter];
