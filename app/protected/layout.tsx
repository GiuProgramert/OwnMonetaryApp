import Sidebar from "@/components/sidebar";
import { Toaster } from "react-hot-toast";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <Toaster position="top-right" />
      <div className="w-full min-h-screen flex gap-6 p-5">
        <Sidebar />

        <div className="flex-1 min-w-0 flex justify-center">
          <div className="w-full max-w-7xl flex flex-col gap-6 min-w-0">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
