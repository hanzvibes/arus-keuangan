import { Plus } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
};

export function ScreenTitle({ title, subtitle, action, onAction }: Props) {
  return (
    <div className="screen-title">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && (
        <button onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
