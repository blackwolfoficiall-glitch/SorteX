import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect, webkit } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "");
assert.equal(origin.hostname, "127.0.0.1", "Local synthetic QA only");
assert.ok(["http:", "https:"].includes(origin.protocol));
assert.ok(process.env.TEST_SEED_PASSWORD, "Synthetic credentials required.");
const artifacts = process.env.SORTEX_MINI_DETAIL_CAPTURES;
if (artifacts) await mkdir(artifacts, { recursive: true });

const visible = "mini-qa-visible",
  empty = "mini-qa-empty",
  finished = "mini-qa-finished";
const publicPath = (id) => `/mini-campanhas/${id}`;
const ownerPath = (id) => `/dashboard/mini-campanhas/${id}`;
const endpoint = (id) => `/api/platform/mini-campaigns/${id}`;

async function readOnly(context) {
  const prohibited = [];
  await context.route("**/*", (route) => {
    const call = route.request();
    const target = new URL(call.url());
    if (
      target.origin === origin.origin &&
      ["GET", "HEAD"].includes(call.method())
    )
      return route.continue();
    prohibited.push(call.method());
    return route.abort();
  });
  return prohibited;
}

async function signIn(context, index) {
  const reply = await context.request.post("/api/auth/login", {
    data: {
      email: `organizer${index}@sortex.example.invalid`,
      password: process.env.TEST_SEED_PASSWORD,
    },
  });
  assert.equal(reply.status(), 200);
  const me = await context.request.get("/api/auth/me");
  assert.equal(me.status(), 200);
  assert.equal((await me.json()).role, "ORGANIZER");
}

async function layout(page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    await page.evaluate(() => document.documentElement.clientWidth),
  );
}

for (const [engine, type, widths] of [
  ["chromium", chromium, [1440, 820]],
  ["webkit", webkit, [390, 320]],
]) {
  if (
    process.env.SORTEX_MINI_DETAIL_BROWSER &&
    process.env.SORTEX_MINI_DETAIL_BROWSER !== engine
  )
    continue;
  const browser = await type.launch(
    engine === "chromium" && process.env.PLAYWRIGHT_CHROMIUM_BINARY
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY,
          args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
        }
      : {},
  );
  const owner = await browser.newContext({
    baseURL: origin.origin,
    ignoreHTTPSErrors: true,
    reducedMotion: "reduce",
  });
  const guest = await browser.newContext({
    baseURL: origin.origin,
    ignoreHTTPSErrors: true,
    reducedMotion: "reduce",
  });
  const foreign = await browser.newContext({
    baseURL: origin.origin,
    ignoreHTTPSErrors: true,
  });
  try {
    await signIn(owner, 1);
    await signIn(foreign, 2);
    const traffic = await readOnly(owner);
    const guestTraffic = await readOnly(guest);
    const foreignTraffic = await readOnly(foreign);
    const actual = await owner.request.get(endpoint(visible));
    assert.equal(actual.status(), 200);
    const mini = await actual.json();
    assert.equal(mini.status, "PUBLISHED");
    assert.equal(mini.soldTickets, 2);
    assert.equal(mini.maxTickets, 20);
    assert.equal(mini.orders.length, 1);
    assert.equal(mini.orders[0].status, "RESERVED");

    const privateReply = await foreign.request.get(endpoint(visible));
    assert.equal(privateReply.status(), 404);
    const foreignPage = await foreign.newPage();
    await foreignPage.goto(ownerPath(visible));
    const denied = foreignPage.getByRole("region", {
      name: "Detalhe da Mini Campanha",
    });
    await expect(denied.getByRole("alert")).toContainText(
      "Mini Campanha não encontrada",
    );
    await expect(
      denied.getByText("QA-MINI-ONLY-OWNER", { exact: false }),
    ).toHaveCount(0);
    await expect(
      denied.getByRole("button", { name: "Registrar resultado" }),
    ).toHaveCount(0);
    const guestPrivate = await guest.request.get(ownerPath(visible), {
      maxRedirects: 0,
    });
    assert.equal(guestPrivate.status(), 307);
    assert.match(guestPrivate.headers().location, /\/login\?next=/);
    for (const id of [empty, finished]) {
      const withheld = await guest.request.get(publicPath(id), {
        maxRedirects: 0,
      });
      assert.equal(withheld.status(), 404);
      assert.ok(!(await withheld.text()).includes("QA-MINI-ONLY-OWNER"));
    }

    const page = await owner.newPage();
    const publicPage = await guest.newPage();
    for (const width of widths) {
      for (const colorScheme of ["light", "dark"]) {
        const size = { width, height: width > 800 ? 960 : 844 };
        await page.setViewportSize(size);
        await publicPage.setViewportSize(size);
        await page.emulateMedia({ colorScheme });
        await publicPage.emulateMedia({ colorScheme });
        const own = page.getByRole("region", {
          name: "Detalhe da Mini Campanha",
        });
        if (width === widths[0] && colorScheme === "light") {
          await page.route(
            `**${endpoint(visible)}`,
            (route) => route.abort("failed"),
            { times: 1 },
          );
          await page.goto(ownerPath(visible));
          await expect(own.getByRole("alert")).toBeVisible();
          const retried = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === endpoint(visible),
          );
          await own.getByRole("button", { name: "Tentar novamente" }).click();
          assert.equal((await retried).status(), 200);
        } else {
          let release = () => {};
          const wait = new Promise((resolve) => {
            release = resolve;
          });
          await page.route(
            `**${endpoint(visible)}`,
            async (route) => {
              await wait;
              await route.continue();
            },
            { times: 1 },
          );
          try {
            await page.goto(ownerPath(visible));
            await expect(own.getByRole("status")).toContainText(
              "Carregando Mini Campanha",
            );
          } finally {
            release();
          }
        }
        await expect(own).toHaveCSS("color-scheme", colorScheme);
        await expect(
          own.getByRole("heading", { name: mini.name, exact: true }),
        ).toBeVisible();
        await expect(
          own.getByText(`${mini.soldTickets}/${mini.maxTickets}`, {
            exact: true,
          }),
        ).toBeVisible();
        const orders = own.getByRole("list", {
          name: "Pedidos da Mini Campanha",
        });
        await expect(orders.getByRole("listitem")).toHaveCount(1);
        await expect(
          orders.getByText("#QA-MINI-ONLY-OWNER", { exact: true }),
        ).toBeVisible();
        await expect(
          orders.getByText("Reservado", { exact: true }),
        ).toBeVisible();
        await expect(orders.getByText(/R\$\s*1,50/)).toBeVisible();
        const number = own.getByRole("spinbutton", { name: "Número vencedor" });
        const notes = own.getByRole("textbox", { name: "Observação" });
        const register = own.getByRole("button", {
          name: "Registrar resultado",
        });
        await expect(register).toBeEnabled();
        await number.focus();
        await page.keyboard.press("Tab");
        await expect(notes).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(register).toBeFocused();
        if (engine === "webkit") {
          const dock = page.getByRole("navigation", {
            name: "Navegação rápida do organizador",
          });
          const create = dock
            .getByRole("link", { name: "Criar campanha" })
            .locator(".sxorg-tab-icon");
          await expect
            .poll(async () => {
              const action = await register.boundingBox();
              const navigation = await dock.boundingBox();
              const raisedCreate = await create.boundingBox();
              return (
                Math.min(navigation.y, raisedCreate.y) -
                (action.y + action.height)
              );
            })
            .toBeGreaterThanOrEqual(4);
        }
        await layout(page);
        if (artifacts && width !== 320) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({
            path: `${artifacts}/owner-${engine}-${width}-${colorScheme}.png`,
            animations: "disabled",
          });
        }

        const offered = await publicPage.goto(publicPath(visible));
        assert.equal(offered?.status(), 200);
        const view = publicPage.getByRole("main", {
          name: "Mini Campanha pública",
        });
        await expect(view).toHaveCSS("color-scheme", colorScheme);
        await expect(
          view.getByRole("heading", { name: mini.name }),
        ).toBeVisible();
        await expect(
          view.getByRole("progressbar", { name: "Percentual reservado" }),
        ).toHaveAttribute("aria-valuenow", "10");
        await expect(
          view.getByText("18 disponíveis", { exact: true }),
        ).toBeVisible();
        await expect(view.getByText(/R\$\s*0,75/)).toBeVisible();
        await expect(
          view.getByText("Nenhum pagamento real é processado nesta etapa."),
        ).toBeVisible();
        await expect(
          view.getByRole("link", { name: "Entrar", exact: true }),
        ).toHaveAttribute(
          "href",
          `/login?next=${encodeURIComponent(publicPath(visible))}`,
        );
        await expect(
          view.getByRole("button", { name: "Reservar em modo de teste" }),
        ).toBeVisible();
        await expect(
          view.getByRole("link", { name: "Ver campanha principal" }),
        ).toHaveAttribute("href", "/campanha/campanha-piloto-homologacao");
        await expect(
          view.getByText("QA-MINI-ONLY-OWNER", { exact: false }),
        ).toHaveCount(0);
        await expect(
          view.getByText(mini.orders[0].buyer.name, { exact: true }),
        ).toHaveCount(0);
        const rules = view.locator("summary");
        await rules.focus();
        await publicPage.keyboard.press("Enter");
        await expect(
          view.getByText("Regras fictícias locais para validação visual."),
        ).toBeVisible();
        await layout(publicPage);
        if (artifacts && width !== 320) {
          await publicPage.evaluate(() => scrollTo(0, 0));
          await publicPage.screenshot({
            path: `${artifacts}/guest-${engine}-${width}-${colorScheme}.png`,
            animations: "disabled",
          });
        }
        console.log(
          `${engine} ${width}px ${colorScheme}: owner detail and actual guest/public restrictions passed.`,
        );
      }
    }

    await page.goto(ownerPath(empty));
    await expect(
      page.getByRole("button", { name: "Registrar resultado" }),
    ).toBeDisabled();
    await expect(
      page.getByText("Nenhum pedido registrado.", { exact: true }),
    ).toBeVisible();
    await page.goto(ownerPath(finished));
    await expect(
      page.getByRole("heading", { name: "Número vencedor: 7", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Registrar resultado" }),
    ).toHaveCount(0);
    assert.deepEqual(traffic, []);
    assert.deepEqual(guestTraffic, []);
    assert.deepEqual(foreignTraffic, []);
  } finally {
    for (const context of [owner, guest, foreign]) await context.close();
    await browser.close();
  }
}
