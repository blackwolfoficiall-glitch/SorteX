import assert from "node:assert/strict";
import test from "node:test";
import { SortexClient } from "../src/api/client";
import {
  draftCoverRevision,
  uploadOrganizerDraftCover,
  validateNativeDraftCover,
} from "../src/domain/organizer-draft-cover";
import type { OrganizerDraftRecord } from "../src/domain/organizer-draft";

const draft: OrganizerDraftRecord = {
  id: "draft-1",
  organizerId: "owner-1",
  title: "Synthetic",
  status: "DRAFT",
  publishedAt: null,
  coverImageRevision: null,
};
const updated = { ...draft, coverImageRevision: "123456789012abcd" };
const asset = {
  uri: "file:///tmp/private.png",
  name: "Nome pessoal.png",
  size: 200,
  mimeType: "image/png",
};

test("draft cover URI, type and known size must match the native upload contract", () => {
  assert.deepEqual(validateNativeDraftCover(asset), {
    uri: asset.uri,
    name: "capa.png",
    type: "image/png",
  });
  assert.equal(
    validateNativeDraftCover({
      ...asset,
      mimeType: undefined,
      name: "Imagem.JPEG",
    }).type,
    "image/jpeg",
  );
  for (const invalid of [
    { uri: "https://invalid.test/photo" },
    { mimeType: "image/heic" },
    { name: "image.gif", mimeType: undefined },
    { size: undefined },
    { size: 0 },
    { size: 20 * 1024 * 1024 + 1 },
  ])
    assert.throws(() => validateNativeDraftCover({ ...asset, ...invalid }));
});

test("only the active organizer's never-published draft exposes a writable cover revision", () => {
  assert.equal(draftCoverRevision(draft, "owner-1"), "none");
  assert.equal(draftCoverRevision(updated, "owner-1"), "123456789012abcd");
  assert.equal(draftCoverRevision(updated, "owner-2"), null);
  for (const change of [
    { status: "PUBLISHED" },
    { status: "PAUSED" },
    { publishedAt: "2026-11-25T00:00:00.000Z" },
    { coverImageRevision: "private/key.jpg" },
    { coverImageRevision: undefined },
  ])
    assert.equal(
      draftCoverRevision({ ...updated, ...change }, "owner-1"),
      null,
    );
});

function fixture(
  reads: OrganizerDraftRecord[],
  afterRead?: (index: number) => void,
) {
  const paths: string[] = [];
  let rev: number | null = 1;
  const user = { id: "owner-1", role: "ORGANIZER" } as NonNullable<
    ReturnType<SortexClient["snapshot"]>["user"]
  >;
  let index = 0;
  const client = {
    snapshot: () => ({ user, status: "signedIn" as const }),
    activeSessionRevision: () => rev,
    request: async <T>(path: string) => {
      paths.push(path);
      const result = reads[index++];
      afterRead?.(index);
      return result as T;
    },
    requestMultipart: async <T>(
      path: string,
      data: FormData,
      revision: number,
    ) => {
      paths.push(path);
      assert.equal(data.get("target"), "COVER");
      assert.equal(data.get("expectedDraftCoverRevision"), "none");
      assert.equal(revision, 1);
      return updated as T;
    },
  };
  const form = (expected: string) => {
    const body = new FormData();
    body.append("target", "COVER");
    body.append("expectedDraftCoverRevision", expected);
    return body;
  };
  return {
    paths,
    client,
    form,
    setRevision: (next: number | null) => {
      rev = next;
    },
  };
}

test("upload rechecks readiness using identical ownership, draft status and saved revision", async () => {
  const f = fixture([draft, updated]);
  assert.equal(
    await uploadOrganizerDraftCover(f.client, "owner-1", 1, draft, f.form),
    updated,
  );
  assert.deepEqual(f.paths, [
    "/campaigns/draft-1",
    "/campaigns/draft-1/images",
    "/campaigns/draft-1",
  ]);
});

test("new cover in another tab or a same-account session change prevents stale write", async () => {
  const changed = fixture([updated]);
  await assert.rejects(
    uploadOrganizerDraftCover(
      changed.client,
      "owner-1",
      1,
      draft,
      changed.form,
    ),
    /A capa mudou/,
  );
  assert.equal(changed.paths.length, 1);
  const switched = fixture([draft], () => switched.setRevision(2));
  await assert.rejects(
    uploadOrganizerDraftCover(
      switched.client,
      "owner-1",
      1,
      draft,
      switched.form,
    ),
    /A sessão mudou/,
  );
  assert.equal(switched.paths.length, 1);
});

test("no confirmation escapes logout after write or a mismatching readback", async () => {
  const switched = fixture([draft, updated], (index) => {
    if (index === 2) switched.setRevision(null);
  });
  await assert.rejects(
    uploadOrganizerDraftCover(
      switched.client,
      "owner-1",
      1,
      draft,
      switched.form,
    ),
    /A sessão mudou/,
  );
  const changed = fixture([
    draft,
    { ...draft, coverImageRevision: "9876543210abcdef" },
  ]);
  await assert.rejects(
    uploadOrganizerDraftCover(
      changed.client,
      "owner-1",
      1,
      draft,
      changed.form,
    ),
    /mudou após o envio/,
  );
});

test("authenticated multipart uses generated boundary, not JSON or query parameters", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const user = { id: "owner-1", role: "ORGANIZER" };
  const client = new SortexClient(
    "https://api.example.test",
    {
      read: async () => null,
      write: async () => {},
      clear: async () => {},
    },
    async (url, init) => {
      requests.push({ url: String(url), init });
      const data = String(url).endsWith("/auth/login")
        ? { user, accessToken: "private-access", refreshToken: "test-refresh" }
        : String(url).endsWith("/auth/me")
          ? user
          : updated;
      return new Response(JSON.stringify(data), { status: 200 });
    },
  );
  await client.login("organizer@example.test", "synthetic");
  const revision = client.activeSessionRevision()!;
  const body = new FormData();
  body.append("target", "COVER");
  await client.requestMultipart("/campaigns/draft-1/images", body, revision);
  const request = requests.at(-1)!;
  assert.equal(
    request.url,
    "https://api.example.test/campaigns/draft-1/images",
  );
  assert.equal(request.init?.method, "POST");
  assert.equal(request.init?.body, body);
  const headers = new Headers(request.init?.headers);
  assert.equal(headers.get("content-type"), null);
  assert.equal(headers.get("authorization"), "Bearer private-access");
  await assert.rejects(
    client.requestMultipart("/campaigns/draft-1/images", body, revision + 1),
    /A sessão mudou/,
  );
  assert.equal(requests.length, 3);
});
