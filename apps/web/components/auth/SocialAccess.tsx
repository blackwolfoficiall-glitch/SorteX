"use client";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
type Availability = {
  google: { enabled: boolean };
  apple: { enabled: boolean };
};
export default function SocialAccess() {
  const [providers, setProviders] = useState<Availability | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/social/providers", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!data.google || !data.apple) throw new Error();
        setProviders(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <div className="social-access">
      <div className="grid gap-3 sm:grid-cols-2">
        {(["google", "apple"] as const).map((provider) => {
          const enabled = Boolean(providers?.[provider].enabled);
          const label = `Continuar com ${provider === "google" ? "Google" : "Apple"}`;
          return enabled ? (
            <a
              className="social-button"
              key={provider}
              href={`/api/auth/social/${provider}/start`}
            >
              <ProviderIcon provider={provider} />
              {label}
            </a>
          ) : (
            <button
              className="social-button"
              type="button"
              disabled
              aria-describedby="social-availability"
              key={provider}
            >
              <ProviderIcon provider={provider} />
              {label}
            </button>
          );
        })}
      </div>
      <p
        id="social-availability"
        role="status"
        className="mt-3 text-xs leading-5 text-zinc-500"
      >
        {!providers && !failed ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle size={12} className="animate-spin" />
            Verificando opções de acesso…
          </span>
        ) : failed ? (
          "Não foi possível consultar o acesso social. Você pode continuar com e-mail."
        ) : !providers?.google.enabled || !providers?.apple.enabled ? (
          "As opções desabilitadas aguardam configuração do provedor. O acesso por e-mail está disponível."
        ) : (
          "Você escolhe seu perfil e completa os dados necessários após autenticar."
        )}
      </p>
      <div className="my-6 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[.15em] text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        ou continue com e-mail
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
    </div>
  );
}
function ProviderIcon({ provider }: { provider: "google" | "apple" }) {
  return provider === "google" ? (
    <span aria-hidden="true" className="text-lg font-bold text-blue-600">
      G
    </span>
  ) : (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="currentColor"
    >
      <path d="M17.1 12.6c0-2 1.6-3 1.7-3.1-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.7 0-1.7-.7-2.8-.7-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.8.7 1 1.5 2.1 2.7 2 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.7-1-2.7-3.9ZM15.2 6.5c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.6 1.3-.6.6-1.1 1.6-1 2.6 1 .1 2-.5 2.7-1.2Z" />
    </svg>
  );
}
