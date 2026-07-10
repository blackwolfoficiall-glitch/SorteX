"use client";

import {
  User,
  Trophy,
  Ticket,
  Gift,
  Mail,
  Phone,
  CreditCard,
  Bell,
  Shield,
  CircleHelp,
  Smartphone,
  Lock,
  LogOut,
  ChevronRight,
  Calendar,
} from "lucide-react";

export default function PerfilComprador() {
  return (
    <main className="mx-auto max-w-md space-y-6 bg-zinc-50 p-5 pb-28">

      {/* Cabeçalho */}

      <section className="rounded-3xl bg-white p-6 shadow">

        <div className="flex items-center gap-4">

          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-100">
            <User size={40} className="text-violet-700" />
          </div>

          <div>

            <h1 className="text-2xl font-black">
              Felipe Rocha
            </h1>

            <p className="text-sm text-zinc-500">
              ID SX000001
            </p>

            <span className="mt-2 inline-block rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
              ⭐ Cliente Ouro
            </span>

          </div>

        </div>

      </section>

      {/* Estatísticas */}

      <section className="grid grid-cols-3 gap-3">

        <div className="rounded-2xl bg-white p-4 text-center shadow">
          <Ticket className="mx-auto text-violet-600" />
          <h2 className="mt-2 text-2xl font-black">120</h2>
          <p className="text-xs text-zinc-500">Cotas</p>
        </div>

        <div className="rounded-2xl bg-white p-4 text-center shadow">
          <Gift className="mx-auto text-green-600" />
          <h2 className="mt-2 text-2xl font-black">18</h2>
          <p className="text-xs text-zinc-500">Campanhas</p>
        </div>

        <div className="rounded-2xl bg-white p-4 text-center shadow">
          <Trophy className="mx-auto text-yellow-500" />
          <h2 className="mt-2 text-2xl font-black">2</h2>
          <p className="text-xs text-zinc-500">Prêmios</p>
        </div>

      </section>

      {/* Minha Conta */}

      <Card titulo="Minha Conta">

        <Linha icone={<User size={18} />} texto="Nome" />

        <Linha icone={<Mail size={18} />} texto="E-mail" />

        <Linha icone={<Phone size={18} />} texto="Telefone" />

        <Linha icone={<CreditCard size={18} />} texto="CPF" />

        <Linha icone={<Calendar size={18} />} texto="Data de nascimento" />

        <Linha icone={<Lock size={18} />} texto="Alterar senha" />

      </Card>

      {/* Pagamentos */}

      <Card titulo="Pagamentos">

        <Linha icone={<CreditCard size={18} />} texto="PIX cadastrado" />

        <Linha icone={<CreditCard size={18} />} texto="Cartões salvos" />

        <Linha icone={<Ticket size={18} />} texto="Histórico de compras" />

      </Card>

      {/* Preferências */}

      <Card titulo="Preferências">

        <Linha icone={<Bell size={18} />} texto="Notificações" />

        <Linha icone={<Gift size={18} />} texto="Campanhas favoritas" />

      </Card>

      {/* Segurança */}

      <Card titulo="Segurança">

        <Linha icone={<Shield size={18} />} texto="Verificação em duas etapas" />

        <Linha icone={<Smartphone size={18} />} texto="Dispositivos conectados" />

      </Card>

      {/* Ajuda */}

      <Card titulo="Ajuda">

        <Linha icone={<CircleHelp size={18} />} texto="Central de ajuda" />

        <Linha icone={<CircleHelp size={18} />} texto="Perguntas frequentes" />

        <Linha icone={<CircleHelp size={18} />} texto="Termos de uso" />

        <Linha icone={<CircleHelp size={18} />} texto="Política de privacidade" />

      </Card>

      {/* Conquistas */}

      <Card titulo="Conquistas">

        <div className="flex flex-wrap gap-2">

          <Badge texto="🥉 Primeira compra" />

          <Badge texto="🥈 100 cotas" />

          <Badge texto="🏆 Primeiro prêmio" />

          <Badge texto="💎 Cliente VIP" />

        </div>

      </Card>

      <button className="w-full rounded-2xl bg-red-600 py-4 font-bold text-white">
        <div className="flex items-center justify-center gap-2">
          <LogOut size={20} />
          Sair da conta
        </div>
      </button>

    </main>
  );
}

function Card({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow">
      <h2 className="mb-4 text-lg font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

function Linha({
  icone,
  texto,
}: {
  icone: React.ReactNode;
  texto: string;
}) {
  return (
    <button className="flex w-full items-center justify-between border-b py-4 last:border-0">
      <div className="flex items-center gap-3">
        {icone}
        <span>{texto}</span>
      </div>

      <ChevronRight size={18} />
    </button>
  );
}

function Badge({ texto }: { texto: string }) {
  return (
    <div className="rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
      {texto}
    </div>
  );
}