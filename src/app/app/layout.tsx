import type { Metadata } from "next";

export const metadata: Metadata = {
  other: { "arus-app-shell": "1" },
};

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
