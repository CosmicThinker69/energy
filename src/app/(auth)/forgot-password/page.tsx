import { Suspense } from "react";
import { AuthPage } from "@/components/auth";
export default function Forgot() {
  return (
    <Suspense>
      <AuthPage mode="forgot" />
    </Suspense>
  );
}
