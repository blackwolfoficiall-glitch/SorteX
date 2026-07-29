import { expect, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);

test("foto do prêmio por meta é enviada, persistida, exibida e removida", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const suffix=Date.now();
  const create=await page.request.post("/api/campaigns",{data:{
    title:`Homologação foto da meta ${suffix}`,
    slug:`homologacao-foto-meta-${suffix}`,
    regulation:"Campanha de homologação.",
    category:"AUTOMOBILE",
    mainPrizeName:"Prêmio principal",
    mainPrizeDescription:"Prêmio de homologação.",
    estimatedPrizeValue:1000,
    totalNumbers:1000,
    numberPrice:1,
    minimumPurchase:1,
    maximumPurchasePerBuyer:1000,
    numberSelectionMode:"RANDOM",
    drawDate:new Date(Date.now()+7*86400000).toISOString(),
    drawTime:"20:00",
    drawBasis:"MANUAL_RESULT",
    salesStartAt:new Date().toISOString(),
  }});
  expect(create.ok(),await create.text()).toBeTruthy();
  const campaign=await create.json() as {id:string;slug:string};
  const upload=await page.request.post(`/api/campaigns/${campaign.id}/images`,{multipart:{
    target:"MILESTONE",
    files:{name:"premio-meta.png",mimeType:"image/png",buffer:png},
  }});
  expect(upload.ok(),await upload.text()).toBeTruthy();
  const uploaded=await upload.json() as {uploadedMediaUrl:string};
  expect(uploaded.uploadedMediaUrl).toMatch(new RegExp(`/public/campaigns/media/${campaign.id}/milestone/.+\\.png$`));
  const imageCrop={desktop:{x:30,y:45,zoom:1.2},mobile:{x:60,y:25,zoom:1.35}};
  const milestone={name:"Moto de homologação",description:"Prêmio com foto real.",percentage:50,imageUrl:uploaded.uploadedMediaUrl,imageCrop};
  const save=await page.request.patch(`/api/campaigns/${campaign.id}`,{data:{
    milestones:[milestone],
    titleColorMode:"CUSTOM",
    customTitleColor:"#7C00FF",
    titleCompositionMode:"SEGMENTS",
    rewardSectionsOrder:["ROULETTE","INSTANT_WIN","MILESTONES"],
    titleSegments:[
      {text:"BMW",color:"#0066FF",order:0},
      {text:"OU 500 MIL",color:"#FFFFFF",order:1},
    ],
  }});
  expect(save.ok(),await save.text()).toBeTruthy();
  const persisted=await page.request.get(`/api/campaigns/${campaign.id}`);
  const persistedCampaign=await persisted.json() as {
    milestonePrizes:Array<{imageUrl:string|null;imageCrop:typeof imageCrop|null}>;
    titleColorMode:string;
    customTitleColor:string;
    titleCompositionMode:string;
    titleSegments:Array<{text:string;color:string;order:number}>;
    rewardSectionsOrder:string[];
  };
  expect(persistedCampaign.milestonePrizes[0].imageUrl).toBe(uploaded.uploadedMediaUrl);
  expect(persistedCampaign.milestonePrizes[0].imageCrop).toEqual(imageCrop);
  expect(persistedCampaign.titleColorMode).toBe("CUSTOM");
  expect(persistedCampaign.customTitleColor).toBe("#7C00FF");
  expect(persistedCampaign.titleCompositionMode).toBe("SEGMENTS");
  expect(persistedCampaign.titleSegments).toEqual([
    {text:"BMW",color:"#0066FF",order:0},
    {text:"OU 500 MIL",color:"#FFFFFF",order:1},
  ]);
  expect(persistedCampaign.rewardSectionsOrder).toEqual([
    "ROULETTE",
    "INSTANT_WIN",
    "MILESTONES",
  ]);
  const filename=uploaded.uploadedMediaUrl.split("/").pop()!;
  expect((await page.request.get(`/api/campaigns/${campaign.id}/media/milestone/${filename}`)).ok()).toBeTruthy();
  const cover=await page.request.post(`/api/campaigns/${campaign.id}/images`,{multipart:{
    target:"COVER",
    files:{name:"capa-homologacao.png",mimeType:"image/png",buffer:png},
  }});
  expect(cover.ok(),await cover.text()).toBeTruthy();

  await page.goto(`/dashboard/campanhas/${campaign.id}/editar`);
  for (let step = 0; step < 2; step += 1) {
    await page.getByRole("button", { name: "Salvar e continuar" }).click();
    await expect(
      page.getByRole("heading", { name: `Etapa ${step + 2} de 7` }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Prêmios por Meta" }),
  ).toBeVisible();
  await expect(page.getByAltText("Foto do prêmio Moto de homologação")).toBeVisible();
  const removePhoto = page.getByRole("button",{name:"Remover foto"});
  await expect(removePhoto).toBeVisible();
  await removePhoto.click();
  await expect(page.getByText("Adicionar foto")).toBeVisible();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/campaigns/${campaign.id}`) &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button",{name:"Salvar rascunho"}).click();
  expect((await saveResponse).ok()).toBeTruthy();
  const removed=await page.request.get(`/api/campaigns/${campaign.id}`);
  expect((await removed.json() as {milestonePrizes:Array<{imageUrl:string|null}>}).milestonePrizes[0].imageUrl).toBeNull();
});
