import { Suspense } from "react";
import { AuthPage } from "@/components/auth";
export default function Login() {
  return (
    <Suspense>
      <AuthPage mode="login" />
    </Suspense>
  );
}
