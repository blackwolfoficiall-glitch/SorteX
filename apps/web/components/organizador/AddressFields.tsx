"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";

export type AddressValue = {
  postalCode: string;
  state: string;
  city: string;
  neighborhood: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  addressReference: string;
  municipalityCode: string;
};
export const emptyAddress: AddressValue = {
  postalCode: "",
  state: "",
  city: "",
  neighborhood: "",
  address: "",
  addressNumber: "",
  addressComplement: "",
  addressReference: "",
  municipalityCode: "",
};
type State = { id: number; code: string; name: string };
type City = { id: string; name: string };
type Catalog = { states: State[]; cities: Record<string, City[]> };
const fieldClass = "h-12 w-full rounded-xl border bg-white px-4 text-zinc-900";
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
let fallback: Promise<Catalog> | undefined;
async function catalogFallback() {
  if (!fallback)
    fallback = fetch("/data/municipalities.json", {
      signal: AbortSignal.timeout(6000),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as Catalog;
      })
      .catch((error) => {
        fallback = undefined;
        throw error;
      });
  return fallback;
}
async function locations<T>(
  path: string,
  select: (catalog: Catalog) => T,
  signal: AbortSignal,
): Promise<T> {
  try {
    const r = await fetch(path, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
    });
    if (!r.ok) throw new Error();
    return (await r.json()) as T;
  } catch (error) {
    if (signal.aborted) throw error;
    return select(await catalogFallback());
  }
}

export default function AddressFields({
  value,
  onChange,
  required = false,
  showReference = true,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  required?: boolean;
  showReference?: boolean;
}) {
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [cepMessage, setCepMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [cepRetry, setCepRetry] = useState(0);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);
  useEffect(() => {
    const controller = new AbortController();
    locations<State[]>(
      "/api/location/states",
      (c) => c.states,
      controller.signal,
    )
      .then((items) => {
        if (!controller.signal.aborted) {
          setStates(items);
          setLocationError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLocationError(
            "Não foi possível carregar os estados. Tente novamente.",
          );
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController();
    setCities([]);
    if (!value.state) {
      setCitiesLoading(false);
      return;
    }
    setCitiesLoading(true);
    locations<City[]>(
      `/api/location/states/${value.state}/cities`,
      (c) => c.cities[value.state] || [],
      controller.signal,
    )
      .then((items) => {
        if (!controller.signal.aborted) {
          setCities(items);
          setLocationError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLocationError(
            "Não foi possível carregar as cidades. Tente novamente para selecionar um município válido.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCitiesLoading(false);
      });
    return () => controller.abort();
  }, [value.state, retry]);
  useEffect(() => {
    const cep = value.postalCode.replace(/\D/g, "");
    setCepMessage("");
    if (cep.length !== 8) {
      setCepLoading(false);
      return;
    }
    const controller = new AbortController();
    const original = latest.current.value;
    setCepLoading(true);
    fetch(`/api/location/cep/${cep}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6500)]),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as Partial<AddressValue>;
      })
      .then((found) => {
        if (controller.signal.aborted) return;
        const { value: current, onChange: update } = latest.current;
        const next = { ...current };
        // Do not replace fields edited while the CEP request was in flight.
        if (
          current.state === original.state &&
          current.city === original.city &&
          found.state &&
          found.city &&
          found.municipalityCode
        ) {
          next.state = found.state;
          next.city = found.city;
          next.municipalityCode = found.municipalityCode;
        }
        if (
          current.neighborhood === original.neighborhood &&
          found.neighborhood
        )
          next.neighborhood = found.neighborhood;
        if (current.address === original.address && found.address)
          next.address = found.address;
        update(next);
        setCepMessage(
          "Confira o endereço e selecione a cidade caso necessário.",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCepMessage(
            "Consulta de CEP indisponível. Preencha manualmente; a lista de municípios continua disponível.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCepLoading(false);
      });
    return () => controller.abort();
  }, [value.postalCode, cepRetry]);
  const set = (field: keyof AddressValue, next: string) =>
    onChange({ ...value, [field]: next });
  return (
    <>
      <Field label="CEP">
        <Input
          required={required}
          className={fieldClass}
          value={value.postalCode}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
            set("postalCode", digits.replace(/^(\d{5})(\d)/, "$1-$2"));
          }}
        />
      </Field>
      <SearchCombobox
        label="Estado"
        value={value.state}
        displayValue={
          states.find((s) => s.code === value.state)?.name || value.state
        }
        loading={!states.length && !locationError}
        options={states.map((s) => ({
          value: s.code,
          label: `${s.code} — ${s.name}`,
        }))}
        onSelect={(state) =>
          onChange({ ...value, state, city: "", municipalityCode: "" })
        }
      />
      <SearchCombobox
        label="Cidade"
        value={value.city}
        displayValue={value.city}
        loading={citiesLoading}
        disabled={!value.state}
        options={cities.map((c) => ({
          value: c.name,
          label: c.name,
          id: c.id,
        }))}
        onSelect={(city, id) =>
          onChange({ ...value, city, municipalityCode: id || "" })
        }
      />
      <Field label="Bairro">
        <Input
          required={required}
          maxLength={120}
          className={fieldClass}
          value={value.neighborhood}
          onChange={(e) => set("neighborhood", e.target.value)}
        />
      </Field>
      <Field label="Logradouro">
        <Input
          required={required}
          minLength={3}
          maxLength={200}
          autoComplete="address-line1"
          className={fieldClass}
          value={value.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </Field>
      <Field label="Número">
        <Input
          required={required}
          maxLength={30}
          className={fieldClass}
          value={value.addressNumber}
          onChange={(e) => set("addressNumber", e.target.value)}
        />
      </Field>
      <Field label="Complemento (opcional)">
        <Input
          maxLength={120}
          autoComplete="address-line2"
          className={fieldClass}
          value={value.addressComplement}
          onChange={(e) => set("addressComplement", e.target.value)}
        />
      </Field>
      {showReference && (
        <Field label="Ponto de referência (opcional)">
          <Input
            className={fieldClass}
            value={value.addressReference}
            onChange={(e) => set("addressReference", e.target.value)}
          />
        </Field>
      )}
      {cepLoading && <p role="status">Consultando CEP…</p>}
      {cepMessage && (
        <p role="status" className="text-sm text-zinc-600 md:col-span-2">
          {cepMessage}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setCepRetry((n) => n + 1)}
          >
            Consultar CEP novamente
          </button>
        </p>
      )}
      {locationError && (
        <p role="alert" className="text-sm text-red-700 md:col-span-2">
          {locationError}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRetry((n) => n + 1)}
          >
            Recarregar municípios
          </button>
        </p>
      )}
    </>
  );
}

export function SearchCombobox({
  label,
  value,
  displayValue,
  options,
  onSelect,
  loading,
  disabled,
}: {
  label: string;
  value: string;
  displayValue: string;
  options: Array<{ value: string; label: string; id?: string }>;
  onSelect: (value: string, id?: string) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const filtered = useMemo(
    () => options.filter((o) => normalize(o.label).includes(normalize(query))),
    [options, query],
  );
  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, query, open]);
  function select(index: number) {
    const option = filtered[index];
    if (!option) return;
    onSelect(option.value, option.id);
    setOpen(false);
    setQuery("");
  }
  return (
    <div className="relative min-w-0 text-sm text-zinc-700">
      <label htmlFor={id} className="mb-2 block font-semibold">
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={
          open && filtered[active] ? `${id}-${active}` : undefined
        }
        aria-busy={loading}
        autoComplete="off"
        disabled={disabled}
        className={fieldClass}
        placeholder={
          disabled
            ? "Selecione o estado primeiro"
            : `Pesquise ${label.toLowerCase()}`
        }
        value={open ? query : displayValue}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActive(0);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive((n) =>
              Math.max(
                0,
                Math.min(
                  filtered.length - 1,
                  n + (e.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          }
          if (e.key === "Home" && open) {
            e.preventDefault();
            setActive(0);
          }
          if (e.key === "End" && open) {
            e.preventDefault();
            setActive(filtered.length - 1);
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            select(active);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {open && (
        <ul
          id={`${id}-list`}
          ref={list}
          role="listbox"
          aria-label={label}
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-xl border bg-white p-1 shadow-xl"
        >
          {filtered.map((o, index) => (
            <li
              id={`${id}-${index}`}
              role="option"
              aria-selected={value === o.value}
              key={o.id || o.value}
              className={`cursor-pointer rounded-lg px-3 py-3 ${index === active ? "bg-violet-100" : "hover:bg-violet-50"}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(index)}
            >
              {o.label}
            </li>
          ))}
          {!filtered.length && (
            <li role="presentation" className="p-3">
              {loading ? "Carregando…" : "Nenhum resultado. Tente outra busca."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 text-sm font-semibold text-zinc-700">
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
