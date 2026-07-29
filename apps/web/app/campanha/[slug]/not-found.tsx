import Link from "next/link";

export default function CampaignNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 p-6 text-center">
      <div className="max-w-lg rounded-3xl border bg-white p-10 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-700">SorteX</p>
        <h1 className="mt-3 text-3xl font-black">Campanha não encontrada</h1>
        <p className="mt-3 text-zinc-600">Esta campanha não existe, não está publicada ou não está disponível no momento.</p>
        <Link href="/" className="mt-6 inline-block rounded-2xl bg-violet-700 px-6 py-3 font-bold text-white">Voltar para a página inicial</Link>
      </div>
    </main>
  );
}
