import Link from "next/link";

export default function Footer() {
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL;
  return (
    <footer className="border-t bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1fr_auto] md:items-end">
        <div><p className="text-3xl font-black">Sorte<span className="text-violet-700">X</span></p><p className="mt-2 text-zinc-500">Encontre sua próxima sorte.</p><p className="mt-6 text-sm text-zinc-500">© {new Date().getFullYear()} SorteX. Todos os direitos reservados.</p></div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-zinc-700" aria-label="Links institucionais"><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Política de Privacidade</Link><Link href="/contato">Contato</Link><Link href="/suporte">Suporte</Link>{instagram && <a href={instagram} rel="noreferrer" target="_blank">Instagram</a>}</nav>
      </div>
    </footer>
  );
}
