import { Plus, Wallet } from "lucide-react";

type Props = {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
};

export function EmptyState({ title, body, action, onAction }: Props) {
  return (
    <div className="empty-state">
      <span><Wallet size={25} /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button onClick={onAction}>
        <Plus size={16} />
        {action}
      </button>
    </div>
  );
}
