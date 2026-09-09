import { Suspense } from "react";
import { AuthPage } from "@/components/auth";
export default function Reset() {
  return (
    <Suspense>
      <AuthPage mode="reset" />
    </Suspense>
  );
}
