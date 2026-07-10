import { ShieldCheck, Trophy, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-6 px-6 py-10 md:flex-row md:justify-between">

        <div className="flex items-center gap-3 text-gray-700">
          <ShieldCheck className="text-[#16A34A]" size={22} />
          <span className="font-semibold">Compra Segura</span>
        </div>

        <div className="flex items-center gap-3 text-gray-700">
          <Trophy className="text-[#2563EB]" size={22} />
          <span className="font-semibold">Pela Loteria Federal</span>
        </div>

        <div className="flex items-center gap-3 text-gray-700">
          <Sparkles className="text-[#6C3BFF]" size={22} />
          <span className="font-semibold">IA Integrada</span>
        </div>

      </div>
    </footer>
  );
}