"use client";

import { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
};

export default function SectionTitle({
  icon,
  title,
}: Props) {
  return (
    <div className="flex items-center gap-3">

      {icon}

      <h2 className="text-2xl font-black">
        {title}
      </h2>

    </div>
  );
}