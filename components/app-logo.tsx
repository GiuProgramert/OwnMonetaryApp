import Image from "next/image";

import { cn } from "@/lib/utils";

type AppLogoProps = {
  /** Lado del isotipo en píxeles. */
  size?: number;
  /** Muestra el nombre de la app al lado del isotipo. */
  showWordmark?: boolean;
  className?: string;
};

export default function AppLogo({
  size = 24,
  showWordmark = false,
  className,
}: AppLogoProps) {
  return (
    <span className={cn("flex items-center gap-2 min-w-0", className)}>
      <Image
        src="/icon.svg"
        alt="OwnMonetaryApp"
        width={size}
        height={size}
        priority
        className="shrink-0"
      />
      {showWordmark && (
        <span className="font-semibold truncate">OwnMonetaryApp</span>
      )}
    </span>
  );
}
