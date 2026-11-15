import React, { useState } from "react";
import {
  Modal,
  FlatList,
  Text,
  View,
  TextInput,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cities, states, search } from "../domain/registration";
import { client } from "../auth/runtime";
import { Button, s, Notice } from "./ui";
type Option = { id: string; name: string };
export function LocationPicker({
  uf,
  city,
  onChange,
}: {
  uf: string;
  city: string;
  onChange: (value: {
    state: string;
    city: string;
    municipalityCode: string;
  }) => void;
}) {
  const [open, setOpen] = useState<"state" | "city" | null>(null),
    [query, setQuery] = useState(""),
    [options, setOptions] = useState<Option[]>([]),
    [fallback, setFallback] = useState(false);
  async function show(kind: "state" | "city") {
    setQuery("");
    setFallback(false);
    setOpen(kind);
    setOptions(
      kind === "state"
        ? states.map((x) => ({ id: x.code, name: x.name + " · " + x.code }))
        : cities[uf] || [],
    );
    try {
      await client.publicRequest(
        kind === "state"
          ? "/locations/states"
          : `/locations/states/${uf}/cities`,
      );
    } catch {
      setFallback(true);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Button
        secondary
        title={uf ? `Estado: ${uf}` : "Selecionar estado"}
        onPress={() => void show("state")}
      />
      <Button
        secondary
        title={city ? `Cidade: ${city}` : "Selecionar cidade"}
        disabled={!uf}
        onPress={() => void show("city")}
      />
      <Modal
        visible={!!open}
        animationType="slide"
        onRequestClose={() => setOpen(null)}
      >
        <SafeAreaView style={[s.page, { padding: 20, gap: 14 }]}>
          <Text style={s.title}>
            {open === "state" ? "Estado" : "Município"}
          </Text>
          <TextInput
            autoFocus
            accessibilityLabel="Pesquisar localidade"
            placeholder="Digite nome ou sigla"
            style={s.input}
            value={query}
            onChangeText={setQuery}
          />
          {fallback && (
            <Notice message="Consulta indisponível. Usando catálogo IBGE local versionado." />
          )}
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={search(options, query)}
            keyExtractor={(x) => x.id}
            ListEmptyComponent={<Text style={s.muted}>Nenhum resultado.</Text>}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.name}
                style={{ paddingVertical: 17 }}
                onPress={() => {
                  onChange(
                    open === "state"
                      ? { state: item.id, city: "", municipalityCode: "" }
                      : {
                          state: uf,
                          city: item.name,
                          municipalityCode: item.id,
                        },
                  );
                  setOpen(null);
                }}
              >
                <Text style={s.text}>{item.name}</Text>
              </Pressable>
            )}
          />
          <Button
            secondary
            title="Fechar seleção"
            onPress={() => setOpen(null)}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
