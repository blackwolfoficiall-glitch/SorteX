import { expect, test } from "@playwright/test";

const mode = process.env.SORTEX_SALES_WINDOW_PAIR;
if (!["legacy", "matched", "legacy-baseline"].includes(mode ?? ""))
  throw new Error("Este teste exige um par explícito do ambiente sintético local.");

const fixtures = [
  ["future", "NOT_STARTED", "As vendas ainda não começaram."],
  ["ended", "SALES_ENDED", "As vendas foram encerradas."],
  ["drawn", "DRAW_TIME_REACHED", "O horário do sorteio já chegou."],
  ["open", "OPEN", ""],
] as const;

test("buyer controls match the real upstream sales window through the Next BFF", async ({ page, request }) => {
  for (const [name, status, notice] of fixtures) {
    const slug = `synthetic-window-${name}`;
    const detail = await request.get(`/api/public/campaigns/${slug}`);
    const inventory = await request.get(`/api/public/campaigns/${slug}/availability`);
    expect(detail.status()).toBe(200);
    expect(inventory.status()).toBe(200);
    const campaign = await detail.json();
    const capacity = await inventory.json();
    expect(campaign.id).toBe(capacity.campaignId);
    if (mode === "matched") {
      expect(campaign.salesWindow.status).toBe(status);
      expect(capacity.salesWindow.status).toBe(status);
    } else {
      expect(campaign).not.toHaveProperty("salesWindow");
      expect(capacity).not.toHaveProperty("salesWindow");
    }
    await page.goto(`/campanha/${slug}`, { waitUntil: "domcontentloaded" });
    const panel = page.locator("[data-purchase-panel]");
    const reserve = panel.getByRole("button", { name: "Reservar títulos", exact: true });
    if (mode === "legacy-baseline" || status === "OPEN") {
      await expect(reserve).toBeEnabled();
    } else {
      await expect(panel).toHaveAttribute("role", "status");
      await expect(panel).toHaveText(notice);
      await expect(reserve).toHaveCount(0);
      if (page.viewportSize()!.width < 768)
        await expect(page.getByRole("button", { name: notice, exact: true })).toBeDisabled();
    }
  }
});
