import MobileNav from "@/components/mobile-nav";
import Sidebar from "@/components/sidebar";
import { Toaster } from "react-hot-toast";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh overflow-x-hidden">
      <Toaster position="top-right" />

      <div className="flex w-full gap-4 p-3 pb-28 sm:p-4 md:gap-6 md:p-5 md:pb-5">
        <Sidebar />

        <div className="flex-1 min-w-0 flex justify-center">
          <div className="w-full max-w-7xl flex flex-col gap-6 min-w-0">
            {children}
          </div>
        </div>
      </div>

      <MobileNav />
    </main>
  );
}
