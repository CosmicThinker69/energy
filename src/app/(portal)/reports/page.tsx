import { Reports } from "@/components/reports";
import { reports } from "@/lib/reports";
export default function Page() {
  return (
    <Reports reports={reports.map(({ sections, ...metadata }) => metadata)} />
  );
}
