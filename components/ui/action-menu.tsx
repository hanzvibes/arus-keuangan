"use client";

import { DropdownMenu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

export function ActionMenu({ label, actions }: {
  label: string;
  actions: { label: string; icon?: ReactNode; destructive?: boolean; onSelect: () => void }[];
}) {
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button className="row-menu-trigger" aria-label={label}><MoreHorizontal size={20} /></button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="native-action-menu" align="end" sideOffset={6} collisionPadding={12}>
        {actions.map(action => <DropdownMenu.Item key={action.label} className={action.destructive ? "destructive" : undefined} onSelect={action.onSelect}>
          {action.label}{action.icon}
        </DropdownMenu.Item>)}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
