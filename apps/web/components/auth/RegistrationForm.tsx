"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import SocialAccess from "./SocialAccess";
import { AuthShell, authInputClass } from "./AuthShell";
import AddressFields, {
  emptyAddress,
} from "@/components/organizador/AddressFields";
import { authRequest } from "@/lib/auth/client";
import { uploadOrganizerFile } from "@/lib/organizers/client";
const cpfMask = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
};
const cnpjMask = (s: string) => {
  const d = s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 14);
  return d
    .replace(/^(.{2})(.)/, "$1.$2")
    .replace(/^(.{2})\.(.{3})(.)/, "$1.$2.$3")
    .replace(/^(.{2})\.(.{3})\.(.{3})(.)/, "$1.$2.$3/$4")
    .replace(/\/(.{4})(.{1,2})$/, "/$1-$2");
};
const phoneMask = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 13);
  return d.length <= 11
    ? d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4,5})(\d{4})$/, "$1-$2")
    : d;
};
export default function RegistrationForm({
  role,
  social,
}: {
  role: "BUYER" | "ORGANIZER";
  social?: { name: string | null; email: string; provider: string };
}) {
  const organizer = role === "ORGANIZER";
  const router = useRouter();
  const [personType, setPersonType] = useState<"PF" | "PJ">("PF");
  const company = organizer && personType === "PJ";
  const [form, setForm] = useState({
    name: social?.name || "",
    cpf: "",
    cnpj: "",
    organizationName: "",
    fantasyName: "",
    phone: "",
    email: "",
    password: "",
    confirmation: "",
  });
  const [address, setAddress] = useState(emptyAddress);
  const [step, setStep] = useState(1);
  const [logo, setLogo] = useState<File | null>(null);
  const [accepts, setAccepts] = useState([false, false, false]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  function next(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (step === 2 && !address.municipalityCode) {
      setError("Selecione o estado e uma cidade da lista.");
      return;
    }
    setStep((n) => n + 1);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!social && form.password !== form.confirmation) {
      setError("As senhas não conferem.");
      return;
    }
    if (accepts.some((a) => !a)) {
      setError("Confirme todos os aceites obrigatórios.");
      return;
    }
    setLoading(true);
    try {
      const { addressReference: unusedReference, ...registrationAddress } =
        address;
      void unusedReference;
      await authRequest(
        social ? "/api/auth/social/complete" : "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            ...registrationAddress,
            postalCode: address.postalCode.replace(/\D/g, ""),
            name: form.name.trim(),
            cpf: form.cpf.replace(/\D/g, ""),
            phone: form.phone.replace(/\D/g, ""),
            ...(!social
              ? {
                  email: form.email.trim().toLowerCase(),
                  password: form.password,
                  passwordConfirmation: form.confirmation,
                }
              : {}),
            role,
            ...(organizer ? { personType } : {}),
            ...(company
              ? {
                  cnpj: form.cnpj.replace(/[.\-/\s]/g, ""),
                  organizationName: form.organizationName.trim(),
                  fantasyName: form.fantasyName.trim() || undefined,
                }
              : {}),
            termsAccepted: accepts[0],
            privacyAccepted: accepts[1],
            dataProcessingAccepted: accepts[2],
          }),
        },
      );
      setCreated(true);
      if (organizer && logo) {
        try {
          if (!social)
            await authRequest("/api/auth/login", {
              method: "POST",
              body: JSON.stringify({
                email: form.email.trim().toLowerCase(),
                password: form.password,
              }),
            });
          await uploadOrganizerFile(logo, "LOGO");
        } catch {
          setError(
            "Sua conta foi criada. A logo não foi enviada; entre na conta e adicione a imagem no painel. Não é necessário cadastrar-se novamente.",
          );
          return;
        }
      }
      router.push(
        social
          ? organizer
            ? "/dashboard"
            : "/comprador"
          : organizer
            ? "/cadastro/sucesso-organizador"
            : "/cadastro/sucesso-comprador",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar a conta.",
      );
    } finally {
      setLoading(false);
    }
  }
  const field = (
    label: string,
    key: keyof typeof form,
    options: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="block text-sm font-semibold text-zinc-700">
      {label}
      <input
        className={`${authInputClass} mt-2`}
        name={key}
        value={form[key]}
        required
        {...options}
        onChange={(e) =>
          set(
            key,
            key === "cpf"
              ? cpfMask(e.target.value)
              : key === "cnpj"
                ? cnpjMask(e.target.value)
                : key === "phone"
                  ? phoneMask(e.target.value)
                  : e.target.value,
          )
        }
      />
    </label>
  );
  return (
    <AuthShell
      title={organizer ? "Conta de organizador" : "Conta de comprador"}
      description={
        organizer
          ? "Organize suas campanhas com a SorteX."
          : "Participe de campanhas e acompanhe suas cotas."
      }
    >
      {step === 1 && !social && <SocialAccess />}
      {social && (
        <p className="mb-5 rounded-xl border border-violet-100 bg-violet-50 p-3 text-xs leading-6 text-violet-900">
          Identidade confirmada com{" "}
          {social.provider === "google" ? "Google" : "Apple"}. Complete apenas
          seus dados cadastrais. Não é necessário criar uma senha.
        </p>
      )}
      <nav aria-label="Etapas do cadastro" className="sx-progress">
        {["Identificação", "Endereço", "Acesso"].map((title, i) => (
          <span
            key={title}
            aria-current={step === i + 1 ? "step" : undefined}
            className={step > i + 1 ? "sx-step-complete" : undefined}
          >
            <span className="sx-step-number">
              {step > i + 1 ? <Check size={11} /> : i + 1}
            </span>
            {title}
          </span>
        ))}
      </nav>
      <form
        onSubmit={step < 3 ? next : submit}
        className="space-y-4"
        aria-busy={loading}
        aria-describedby={error ? "registration-error" : undefined}
      >
        {step === 1 && (
          <>
            {organizer && (
              <fieldset className="sx-person-types">
                <legend className="px-1 font-semibold">
                  Tipo de organizador
                </legend>
                {(
                  [
                    ["PF", "Pessoa Física (PF)"],
                    ["PJ", "Pessoa Jurídica (PJ)"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      aria-label={label}
                      name="personType"
                      value={value}
                      checked={personType === value}
                      onChange={() => setPersonType(value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            {company && (
              <>
                {field("CNPJ", "cnpj", {
                  autoCapitalize: "characters",
                  spellCheck: false,
                  maxLength: 18,
                })}
                {field("Razão social", "organizationName", { maxLength: 200 })}
                {field("Nome fantasia (opcional)", "fantasyName", {
                  required: false,
                  maxLength: 120,
                })}
              </>
            )}
            {field(
              company
                ? "Nome completo do representante legal"
                : "Nome completo",
              "name",
              { autoComplete: "name", minLength: 2, maxLength: 120 },
            )}
            {field(company ? "CPF do representante legal" : "CPF", "cpf", {
              inputMode: "numeric",
              minLength: 14,
              maxLength: 14,
            })}
            {field("Telefone / WhatsApp", "phone", {
              type: "tel",
              autoComplete: "tel",
              minLength: 10,
            })}
          </>
        )}
        {step === 2 && (
          <>
            <p className="text-sm text-zinc-500">
              Selecione a cidade na lista para validar o código IBGE. O
              complemento é opcional.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <AddressFields
                value={address}
                onChange={setAddress}
                required
                showReference={false}
              />
            </div>
          </>
        )}
        {step === 3 && (
          <>
            {social ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
                E-mail confirmado: <strong>{social.email}</strong>
              </p>
            ) : (
              <>
                {field("E-mail", "email", {
                  type: "email",
                  autoComplete: "email",
                })}
                {field("Senha (mínimo 8 caracteres)", "password", {
                  type: "password",
                  minLength: 8,
                  autoComplete: "new-password",
                })}
                {field("Confirmar senha", "confirmation", {
                  type: "password",
                  minLength: 8,
                  autoComplete: "new-password",
                })}
              </>
            )}
            {organizer && (
              <label className="block rounded-xl border border-dashed p-4 text-sm">
                Logo do organizador (opcional)
                <span className="mt-1 block text-xs text-zinc-500">
                  PNG, JPG ou WebP. O slogan pode ser editado depois em
                  Configurações → Perfil.
                </span>
                <input
                  className="mt-3 block w-full"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setLogo(e.target.files?.[0] || null)}
                />
              </label>
            )}
            {[
              "Li e concordo com os Termos de Uso.",
              "Li e concordo com a Política de Privacidade.",
              "Autorizo o tratamento dos meus dados conforme a LGPD.",
            ].map((label, index) => (
              <label
                key={label}
                className="flex items-start gap-3 text-sm text-zinc-600"
              >
                <input
                  type="checkbox"
                  required
                  checked={accepts[index]}
                  onChange={(e) =>
                    setAccepts((current) =>
                      current.map((v, i) =>
                        i === index ? e.target.checked : v,
                      ),
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </>
        )}
        {error && (
          <p
            role="alert"
            id="registration-error"
            ref={errorRef}
            tabIndex={-1}
            className="sx-auth-alert"
          >
            {error}
          </p>
        )}
        {created ? (
          <p role="status">
            <Link href="/login" className="font-bold text-violet-700 underline">
              Conta criada — entrar
            </Link>
          </p>
        ) : (
          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setError("");
                  setStep((n) => n - 1);
                }}
                className="rounded-xl border px-4"
              >
                Voltar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="sx-auth-submit flex-1"
            >
              {loading && (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}
              {loading
                ? "Criando conta…"
                : step < 3
                  ? "Continuar"
                  : "Criar conta"}
            </button>
          </div>
        )}
        <p className="text-center text-sm text-zinc-500">
          Já possui conta?{" "}
          <Link href="/login" className="font-bold text-violet-700">
            Entrar
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
