import { expect, test } from "@playwright/test";
import { createSyntheticCampaign } from "./fixtures/synthetic-campaign";

test("ordem das premiações persiste e aparece na campanha pública", async ({ page }) => {
  const campaign = await createSyntheticCampaign(page.request, "Ordem dos prêmios", {
    publish: true,
    fields: {
      instantPrizes: [{ exactNumber: "123", description: "Cota fictícia", value: 100, type: "PIX", quantity: 1 }],
      milestones: [{ name: "Meta fictícia", percentage: 50 }],
      customization: {
        useOrganizerDefaults: false,
        roulette: { enabled: true, rules: [{ id: "combo", minQuantity: 100, rounds: 1 }] },
      },
    },
  });
  for (const rewardSectionsOrder of [
    ["ROULETTE", "MILESTONES", "INSTANT_WIN"],
    ["INSTANT_WIN", "ROULETTE", "MILESTONES"],
  ]) {
    const saved = await page.request.patch(`/api/campaigns/${campaign.id}`, {
      data: { rewardSectionsOrder },
    });
    expect(saved.ok(), await saved.text()).toBeTruthy();
    const publicData = await page.request.get(`/api/public/campaigns/${campaign.slug}`);
    expect(publicData.ok(), await publicData.text()).toBeTruthy();
    expect((await publicData.json()).rewardSectionsOrder).toEqual(rewardSectionsOrder);
    await page.goto(`/campanha/${campaign.slug}`);
    await expect(page.locator("[data-reward-section]")).toHaveCount(3);
    await expect.poll(() =>
      page.locator("[data-reward-section]").evaluateAll((sections) =>
        sections.map((section) => ({
          key: section.getAttribute("data-reward-section"),
          top: section.getBoundingClientRect().top,
        })).sort((a, b) => a.top - b.top).map(({ key }) => key),
      ),
    ).toEqual(rewardSectionsOrder);
  }
});
