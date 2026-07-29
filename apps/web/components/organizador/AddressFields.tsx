"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

export type AddressValue = { postalCode: string; state: string; city: string; neighborhood: string; address: string; addressNumber: string; addressComplement: string; addressReference: string; municipalityCode: string };
type State = { id: number; code: string; name: string };
type City = { id: string; name: string };
const fieldClass = "h-12 rounded-xl bg-white px-4";
const citiesCache = new Map<string, City[]>();
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function AddressFields({ value, onChange }: { value: AddressValue; onChange: (next: AddressValue) => void }) {
  const [states, setStates] = useState<State[]>([]);
  const [loadedCities, setLoadedCities] = useState<Record<string, City[]>>({});
  const [cepLoading, setCepLoading] = useState(false);
  const [message, setMessage] = useState("");
  const consultedCep = useRef("");

  useEffect(() => {
    fetch("/api/location/states").then(async (response) => { if (!response.ok) throw new Error(); return (await response.json()) as State[]; }).then(setStates).catch(() => setMessage("Não foi possível carregar os estados agora."));
  }, []);
  useEffect(() => {
    if (!value.state) return;
    const cached = citiesCache.get(value.state);
    if (cached || loadedCities[value.state]) return;
    const controller = new AbortController();
    fetch(`/api/location/states/${value.state}/cities`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return (await response.json()) as City[]; })
      .then((items) => {
        citiesCache.set(value.state, items);
        setLoadedCities((current) => ({ ...current, [value.state]: items }));
      })
      .catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Não foi possível carregar as cidades agora."); });
    return () => controller.abort();
  }, [loadedCities, value.state]);
  useEffect(() => {
    const cep = value.postalCode.replace(/\D/g, "");
    if (cep.length !== 8 || consultedCep.current === cep) return;
    consultedCep.current = cep;
    const controller = new AbortController();
    setCepLoading(true); setMessage("");
    fetch(`/api/location/cep/${cep}`, { signal: controller.signal })
      .then(async (response) => { const payload = (await response.json()) as Partial<AddressValue> & { message?: string }; if (!response.ok) throw new Error(payload.message); return payload; })
      .then((found) => onChange({ ...value, state: found.state || value.state, city: found.city || value.city, neighborhood: found.neighborhood || value.neighborhood, address: found.address || value.address, municipalityCode: found.municipalityCode || value.municipalityCode }))
      .catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error && error.message ? error.message : "Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente."); })
      .finally(() => setCepLoading(false));
    return () => controller.abort();
  }, [value.postalCode]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (field: keyof AddressValue, next: string) => onChange({ ...value, [field]: next });
  const cities = citiesCache.get(value.state) || loadedCities[value.state] || [];
  return <>
    <Field label="CEP"><div className="relative"><Input className={`${fieldClass} pr-11`} value={value.postalCode} inputMode="numeric" placeholder="00000-000" maxLength={9} onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").slice(0, 8); set("postalCode", digits.replace(/^(\d{5})(\d)/, "$1-$2")); }} />{cepLoading && <LoaderCircle aria-label="Consultando CEP" className="absolute right-4 top-3 animate-spin text-violet-700" size={20} />}</div></Field>
    <SearchCombobox label="Estado" value={value.state} displayValue={states.find((state) => state.code === value.state)?.name || value.state} loading={!states.length} options={states.map((state) => ({ value: state.code, label: `${state.code} — ${state.name}` }))} onSelect={(state) => onChange({ ...value, state, city: "", municipalityCode: "" })} />
    <SearchCombobox label="Cidade" value={value.city} displayValue={value.city} loading={Boolean(value.state && !cities.length)} disabled={!value.state} placeholder={value.state ? "Pesquise uma cidade" : "Selecione o estado primeiro"} options={cities.map((city) => ({ value: city.name, label: city.name, id: city.id }))} onSelect={(city, id) => onChange({ ...value, city, municipalityCode: id || "" })} />
    <Field label="Bairro"><Input className={fieldClass} value={value.neighborhood} onChange={(event) => set("neighborhood", event.target.value)} /></Field>
    <Field label="Logradouro"><Input className={fieldClass} value={value.address} onChange={(event) => set("address", event.target.value)} /></Field>
    <Field label="Número"><Input className={fieldClass} value={value.addressNumber} onChange={(event) => set("addressNumber", event.target.value)} /></Field>
    <Field label="Complemento (opcional)"><Input className={fieldClass} value={value.addressComplement} onChange={(event) => set("addressComplement", event.target.value)} /></Field>
    <Field label="Ponto de referência (opcional)"><Input className={fieldClass} value={value.addressReference} onChange={(event) => set("addressReference", event.target.value)} /></Field>
    {message && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 md:col-span-2">{message}</p>}
  </>;
}

function SearchCombobox({ label, value, displayValue, options, onSelect, loading, disabled, placeholder }: { label: string; value: string; displayValue: string; options: Array<{ value: string; label: string; id?: string }>; onSelect: (value: string, id?: string) => void; loading?: boolean; disabled?: boolean; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const term = normalize(query); return term ? options.filter((option) => normalize(option.label).includes(term)) : options; }, [options, query]);
  return <Field label={label}><div className="relative"><button type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" className={`${fieldClass} flex w-full items-center justify-between border text-left disabled:bg-zinc-100 disabled:text-zinc-400`} onClick={() => setOpen((current) => !current)}><span className="truncate">{displayValue || placeholder || `Selecione ${label.toLowerCase()}`}</span>{loading ? <LoaderCircle className="animate-spin" size={18} /> : <Search size={18} />}</button>{open && <div className="absolute z-30 mt-2 w-full rounded-2xl border bg-white p-2 shadow-xl"><Input autoFocus aria-label={`Pesquisar ${label.toLowerCase()}`} className="h-11" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Pesquisar ${label.toLowerCase()}`} /><ul role="listbox" className="mt-2 max-h-56 overflow-y-auto overscroll-contain">{filtered.map((option) => <li key={`${option.value}-${option.id || ""}`}><button type="button" role="option" aria-selected={value === option.value} className="w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-violet-50 focus:bg-violet-50" onClick={() => { onSelect(option.value, option.id); setOpen(false); setQuery(""); }}>{option.label}</button></li>)}{!filtered.length && <li className="px-3 py-4 text-sm text-zinc-500">Nenhuma cidade encontrada.</li>}</ul></div>}</div></Field>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-zinc-700">{label}<div className="mt-2">{children}</div></label>;
}
