import Link from "next/link";
import { Icon } from "@/components/ui";

export default function Forbidden() {
  return (
    <div className="access-gate">
      <span className="large-icon">
        <Icon name="lock" size={27} />
      </span>
      <h1>Administrator access required</h1>
      <p>This area is available only to TEMO dashboard administrators.</p>
      <Link href="/" className="button primary">
        Return to overview
      </Link>
    </div>
  );
}
