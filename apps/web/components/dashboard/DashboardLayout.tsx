"use client";

import { ReactNode } from "react";

import Sidebar from "./Sidebar";
import Header from "./Header";

interface Props {
  children: ReactNode;
}

export default function DashboardLayout({
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-zinc-100">

      <div className="flex">

        <Sidebar />

        <main className="flex-1 p-8">

          <Header />

          <div className="mt-8">
            {children}
          </div>

        </main>

      </div>

    </div>
  );
}
