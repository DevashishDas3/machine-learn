import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ML Agent Swarm | Distributed Intelligence Network",
  description: "Orchestrate ML pipelines with Modal GPUs and vLLM. Deploy agent swarms at scale.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-obsidian font-sans text-paper antialiased">
        {children}
      </body>
    </html>
  );
}
