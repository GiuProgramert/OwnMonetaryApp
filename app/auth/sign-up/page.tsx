import AppLogo from "@/components/app-logo";
import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <AppLogo size={40} showWordmark className="justify-center" />
        <SignUpForm />
      </div>
    </div>
  );
}
