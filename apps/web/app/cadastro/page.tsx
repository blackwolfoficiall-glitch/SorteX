import Link from "next/link";
import { Building2, Ticket } from "lucide-react";

const profiles = [
  {
    href: "/cadastro/comprador",
    title: "Sou comprador",
    description: "Quero participar de campanhas e acompanhar meus títulos.",
    icon: Ticket,
    action: "Criar conta de comprador",
    className: "bg-green-600 hover:bg-green-700",
  },
  {
    href: "/cadastro/organizador",
    title: "Sou organizador",
    description: "Quero criar e administrar campanhas pela SorteX.",
    icon: Building2,
    action: "Criar conta de organizador",
    className: "bg-violet-600 hover:bg-violet-700",
  },
];

export default function CadastroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-4xl">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-wider text-violet-600">
            Cadastro SorteX
          </p>
          <h1 className="mt-3 text-4xl font-black text-slate-950">
            Como você deseja usar a plataforma?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Escolha seu perfil para iniciar o cadastro correto.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {profiles.map((profile) => {
            const Icon = profile.icon;
            return (
              <article
                key={profile.href}
                className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
              >
                <Icon className="text-violet-600" size={36} />
                <h2 className="mt-6 text-2xl font-bold text-slate-950">
                  {profile.title}
                </h2>
                <p className="mt-3 min-h-12 text-slate-600">
                  {profile.description}
                </p>
                <Link
                  href={profile.href}
                  className={`mt-8 flex w-full justify-center rounded-2xl px-5 py-4 font-bold text-white transition ${profile.className}`}
                >
                  {profile.action}
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
