import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  month: string;
  onChange: (delta: number) => void;
};

export function PeriodControl({ month, onChange }: Props) {
  return (
    <div className="period-control">
      <button aria-label="Bulan sebelumnya" onClick={() => onChange(-1)}>
        <ChevronLeft size={19} />
      </button>
      <span>
        {new Date(month + "-01T12:00:00").toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        })}
      </span>
      <button aria-label="Bulan berikutnya" onClick={() => onChange(1)}>
        <ChevronRight size={19} />
      </button>
    </div>
  );
}
