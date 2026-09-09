import { Suspense } from "react";
import { AuthPage } from "@/components/auth";
export default function Register() {
  return (
    <Suspense>
      <AuthPage mode="register" />
    </Suspense>
  );
}
