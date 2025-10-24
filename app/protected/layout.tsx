import Sidebar from "@/components/sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-6 items-center">
        <div className="w-full">
          <div className="w-full min-h-screen mx-auto flex gap-6 p-5">
            <Sidebar />

            <div className="flex-1 flex flex-col gap-20">
              {children}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
