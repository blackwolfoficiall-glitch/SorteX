"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  color: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.25 }}
      className={`${color} rounded-3xl p-6 shadow-2xl text-white overflow-hidden relative`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm opacity-80">{title}</p>

          <h2 className="text-4xl font-black mt-3">
            {value}
          </h2>

          <p className="text-sm opacity-80 mt-4">
            {subtitle}
          </p>
        </div>

        <div className="text-5xl opacity-20">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}