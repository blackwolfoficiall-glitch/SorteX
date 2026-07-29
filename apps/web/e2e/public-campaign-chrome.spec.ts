import { expect, test } from "@playwright/test";

test("cabeçalho, menu, Meus Títulos e rodapé funcionam na campanha pública", async ({ page, request }) => {
  const response = await request.get("/api/public/campaigns");
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json() as Array<{ slug: string; organizer: { verified: boolean } }> | { items?: Array<{ slug: string; organizer: { verified: boolean } }> };
  const campaigns = Array.isArray(payload) ? payload : payload.items || [];
  test.skip(campaigns.length === 0, "Não existe campanha pública para homologação.");

  await page.goto(`/campanha/${campaigns[0].slug}`);
  await expect(page.getByTestId("campaign-hero").getByText("SorteX", { exact: true })).toHaveCount(0);
  const header=page.getByTestId("public-campaign-header");
  await expect(header).toBeVisible();
  await expect(header.getByRole("button", { name: "Meus Títulos" })).toBeVisible();
  const organizerCard=page.getByTestId("organizer-card");
  await expect(organizerCard).toBeVisible();
  await expect(organizerCard.getByText("Organizador verificado", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Organizador verificado", { exact: true })).toHaveCount(campaigns[0].organizer.verified ? 1 : 0);
  const organizerLogo=organizerCard.getByTestId("organizer-logo");
  if(await organizerLogo.count()){
    await expect(organizerLogo).toBeVisible();
    await expect.poll(()=>organizerLogo.evaluate(image=>(image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(organizerCard.locator("[aria-label^='Avatar de']")).toHaveCount(0);
    await expect(organizerCard.getByTestId("organizer-name")).toHaveCount(0);
    const logoBox=await organizerLogo.boundingBox();
    const mobileViewport=(page.viewportSize()?.width??1280)<640;
    const configuredSize=Number(await organizerCard.getAttribute("data-logo-size"))||100;
    const scale=configuredSize/100;
    expect(logoBox?.width).toBeGreaterThanOrEqual((mobileViewport?90:130)*scale);
    expect(logoBox?.width).toBeLessThanOrEqual((mobileViewport?140:200)*scale);
    expect(logoBox?.height).toBeLessThanOrEqual((mobileViewport?64:80)*scale);
  }else {
    await expect(organizerCard.locator("[aria-label^='Avatar de']")).toHaveCount(1);
    await expect(organizerCard.getByTestId("organizer-name")).toBeVisible();
  }

  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu da campanha" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Meus títulos" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Ver ganhadores" })).toHaveAttribute("href", /\/o\/.*view=winners/);
  await expect(menu.getByRole("link", { name: "Auditoria" })).toHaveAttribute("href", /\/o\/.*view=audit/);
  await expect(menu.getByRole("link", { name: "Campanhas" })).toHaveAttribute("href", /\/o\/.*view=campaigns/);
  await menu.getByRole("link", { name: "Campanhas" }).click();
  await expect(page).toHaveURL(/\/o\/.*view=campaigns/);
  await expect(page.getByRole("heading", { name: "Campanhas", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Voltar para a campanha/ }).click();
  await expect(page).toHaveURL(new RegExp(`/campanha/${campaigns[0].slug}`));

  for (const item of [
    { link: "Ver ganhadores", heading: "Ganhadores" },
    { link: "Auditoria", heading: "Auditoria" },
    { link: "Contato", heading: "Contato" },
  ]) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("dialog", { name: "Menu da campanha" }).getByRole("link", { name: item.link }).click();
    await expect(page.getByRole("heading", { name: item.heading, exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Voltar para a campanha/ }).click();
    await expect(page).toHaveURL(new RegExp(`/campanha/${campaigns[0].slug}`));
  }

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("dialog", { name: "Menu da campanha" }).getByRole("link", { name: "Afiliados" }).click();
  await expect(page).toHaveURL(/\/afiliado\?/);
  await expect(page.getByRole("heading", { name: /Entrar|Seu painel de crescimento/ })).toBeVisible();
  await page.goto(`/campanha/${campaigns[0].slug}`);

  await page.getByTestId("public-campaign-header").getByRole("button", { name: "Meus Títulos" }).click();
  await expect(page.getByRole("dialog", { name: "Meus Títulos" })).toBeVisible();
  await expect(page.getByText("Entre para consultar seus títulos nesta campanha.")).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();

  await expect(page.getByText("© SorteX 2026 — Todos os direitos reservados.")).toBeVisible();
  await expect(page.getByText("Resultado registrado")).toHaveCount(0);
  await expect(page.getByText("Compra protegida")).toBeVisible();
  await expect(page.getByText("Auditoria realizada")).toBeVisible();
  await page.getByRole("button", { name: "Informações" }).click();
  await expect(page.getByRole("link", { name: "Excluir dados" })).toHaveAttribute("href", /\/privacidade\?returnTo=.*#exclusao-de-dados/);
  await page.getByRole("button", { name: "Formas de pagamento" }).click();
  await expect(page.getByRole("button", { name: "Informações" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("PIX", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar ao topo" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("identidade usa fallback seguro e metas exibem progresso relativo real", async ({ page, request }) => {
  const response=await request.get("/api/public/campaigns");
  expect(response.ok(),await response.text()).toBeTruthy();
  const payload=await response.json() as Array<{slug:string;soldNumbers:number;totalNumbers:number;organizer:{logoUrl:string|null};milestonePrizes:Array<{percentage:number}>}>|{items?:Array<{slug:string;soldNumbers:number;totalNumbers:number;organizer:{logoUrl:string|null};milestonePrizes:Array<{percentage:number}>}>};
  const campaigns=Array.isArray(payload)?payload:payload.items||[];
  const withoutLogo=campaigns.find(item=>!item.organizer.logoUrl);
  if(withoutLogo){
    await page.goto(`/campanha/${withoutLogo.slug}`);
    await expect(page.getByTestId("organizer-fallback")).toBeVisible();
    await expect(page.getByTestId("organizer-name")).toBeVisible();
    await expect(page.getByTestId("organizer-logo")).toHaveCount(0);
  }
  const withMilestones=campaigns.find(item=>item.milestonePrizes.length>0);
  test.skip(!withMilestones,"Não existe campanha pública com prêmio por meta para homologação.");
  await page.goto(`/campanha/${withMilestones!.slug}`);
  const cards=page.getByTestId("milestone-card");
  await expect(cards).toHaveCount(withMilestones!.milestonePrizes.length);
  const rendered=await cards.evaluateAll(elements=>elements.map(element=>Number(element.getAttribute("data-milestone-percentage"))));
  expect(rendered).toEqual([...rendered].sort((first,second)=>first-second));
  const firstTarget=rendered[0];
  const soldPercentage=withMilestones!.totalNumbers>0?Math.min(100,withMilestones!.soldNumbers/withMilestones!.totalNumbers*100):0;
  const expectedWidth=Math.min(100,soldPercentage/firstTarget*100);
  const actualWidth=await cards.first().getByTestId("milestone-progress").evaluate(element=>{const track=element.parentElement?.getBoundingClientRect().width||1;return element.getBoundingClientRect().width/track*100});
  expect(actualWidth).toBeCloseTo(expectedWidth,0);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test("alinhamentos da marca, falha da imagem e estados das metas são determinísticos", async ({ page, request }) => {
  const listResponse=await request.get("/api/public/campaigns");
  const listPayload=await listResponse.json() as Array<{slug:string;organizer:{logoUrl:string|null}}>|{items?:Array<{slug:string;organizer:{logoUrl:string|null}}>} ;
  const campaigns=Array.isArray(listPayload)?listPayload:listPayload.items||[];
  const source=campaigns.find(item=>item.organizer.logoUrl);
  test.skip(!source,"Não existe campanha pública com logo para homologação.");
  const campaignResponse=await request.get(`/api/public/campaigns/${source!.slug}`);
  const campaign=await campaignResponse.json() as Record<string,unknown>&{organizer:Record<string,unknown>&{brand?:Record<string,unknown>|null};slug:string};
  const existingAppearance=(campaign.organizer.brand?.appearanceConfig||{}) as Record<string,unknown>;
  for(const position of ["LEFT","CENTER","RIGHT"] as const){
    const body={...campaign,organizer:{...campaign.organizer,brand:{...(campaign.organizer.brand||{}),appearanceConfig:{...existingAppearance,logoPosition:position,logoSize:100}}}};
    await page.route(`**/api/public/campaigns/${source!.slug}`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)}),{times:1});
    await page.goto(`/campanha/${source!.slug}`);
    const card=page.getByTestId("organizer-card");
    await expect(card).toHaveAttribute("data-logo-position",position);
    const centers=await card.evaluate(element=>{const logo=element.querySelector('[data-testid="organizer-logo"]')!.getBoundingClientRect();const container=element.firstElementChild!.getBoundingClientRect();return{logo:logo.left+logo.width/2,container:container.left+container.width/2}});
    if(position==="LEFT")expect(centers.logo).toBeLessThan(centers.container);
    if(position==="CENTER")expect(Math.abs(centers.logo-centers.container)).toBeLessThan(2);
    if(position==="RIGHT")expect(centers.logo).toBeGreaterThan(centers.container);
  }
  const renderedWidths:number[]=[];
  for(const size of [60,100,180]){
    const body={...campaign,organizer:{...campaign.organizer,brand:{...(campaign.organizer.brand||{}),appearanceConfig:{...existingAppearance,logoPosition:"CENTER",logoSize:size}}}};
    await page.route(`**/api/public/campaigns/${source!.slug}`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)}),{times:1});
    await page.goto(`/campanha/${source!.slug}`);
    const card=page.getByTestId("organizer-card");
    await expect(card).toHaveAttribute("data-logo-size",String(size));
    renderedWidths.push(await page.getByTestId("organizer-logo").evaluate(element=>element.getBoundingClientRect().width));
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }
  expect(renderedWidths[0]).toBeLessThan(renderedWidths[1]);
  expect(renderedWidths[1]).toBeLessThan(renderedWidths[2]);
  const invalidLogoBody={...campaign,organizer:{...campaign.organizer,logoUrl:"/imagem-inexistente.png"}};
  await page.route(`**/api/public/campaigns/${source!.slug}`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(invalidLogoBody)}),{times:1});
  await page.goto(`/campanha/${source!.slug}`);
  await expect(page.getByTestId("organizer-fallback")).toBeVisible();
  await expect(page.getByTestId("organizer-name")).toBeVisible();

  const milestoneBase={description:"Descrição de homologação",imageUrl:null,imageCrop:null,videoUrl:null,estimatedValue:1000,reachedAt:null,drawnAt:null,eligibleTicketCount:null,winner:null};
  const milestoneBody={...campaign,title:"BMW OU 500 MIL",titleColorMode:"CUSTOM",customTitleColor:"#7C00FF",titleCompositionMode:"SEGMENTS",titleSegments:[{text:"BMW",color:"#0066FF",order:0},{text:"OU 500 MIL",color:"#FFFFFF",order:1}],soldNumbers:420,totalNumbers:1000,customization:{...((campaign as {customization?:Record<string,unknown>}).customization||{}),useOrganizerDefaults:false,configuration:{...(((campaign as {customization?:{configuration?:Record<string,unknown>}}).customization?.configuration)||{}),buttonColor:"#2563EB"}},milestonePrizes:[
    {...milestoneBase,id:"locked",name:"Meta 80",percentage:80,status:"WAITING",scheduledAt:null},
    {...milestoneBase,id:"drawn",name:"Meta 20",percentage:20,status:"DRAWN",scheduledAt:null,drawnAt:"2026-07-20T15:00:00.000Z",winner:{name:"Comprador M.",city:"Salvador",number:"12345"}},
    {...milestoneBase,id:"next",name:"Meta 50",percentage:50,status:"WAITING",scheduledAt:null,imageUrl:(campaign as {coverImageUrl?:string|null}).coverImageUrl,imageCrop:{desktop:{x:30,y:45,zoom:1.2},mobile:{x:60,y:25,zoom:1.35}}},
    {...milestoneBase,id:"released",name:"Meta 30",percentage:30,status:"RELEASED",scheduledAt:null},
    {...milestoneBase,id:"scheduled",name:"Meta 40",percentage:40,status:"WAITING",scheduledAt:"2026-08-01T18:30:00.000Z"},
  ]};
  await page.route(`**/api/public/campaigns/${source!.slug}`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(milestoneBody)}),{times:1});
  await page.goto(`/campanha/${source!.slug}`);
  const states=await page.getByTestId("milestone-card").evaluateAll(cards=>cards.map(card=>({percentage:Number(card.getAttribute("data-milestone-percentage")),state:card.getAttribute("data-milestone-state")})));
  expect(states).toEqual([
    {percentage:20,state:"DRAWN"},
    {percentage:30,state:"RELEASED"},
    {percentage:40,state:"SCHEDULED"},
    {percentage:50,state:"NEXT"},
    {percentage:80,state:"LOCKED"},
  ]);
  const nextCard=page.getByTestId("milestone-card").filter({hasText:"Meta 50"});
  const relativeProgress=await nextCard.getByTestId("milestone-progress").evaluate(element=>element.getBoundingClientRect().width/(element.parentElement?.getBoundingClientRect().width||1)*100);
  expect(relativeProgress).toBeCloseTo(84,0);
  await expect(nextCard.getByTestId("milestone-progress")).toHaveCSS("background-color","rgb(37, 99, 235)");
  await expect(page.getByLabel("Linha do tempo das metas")).toHaveCount(0);
  await expect(page.getByText("Próxima",{exact:true})).toHaveCount(0);
  await expect(page.getByTestId("milestone-progress")).toHaveCount(milestoneBody.milestonePrizes.length);
  await expect(page.locator("h1 span").filter({hasText:"BMW"}).first()).toHaveCSS("color","rgb(0, 102, 255)");
  const milestoneImage=nextCard.locator("img").first();
  if((campaign as {coverImageUrl?:string|null}).coverImageUrl){
    await expect(milestoneImage).toBeVisible();
    await expect(milestoneImage).toHaveCSS("object-position",page.viewportSize()!.width>=640?"30% 45%":"60% 25%");
  }
  await expect(page.getByText("Ganhador: Comprador M.")).toBeVisible();
});

test("combos públicos não expõem o inventário privado da roleta", async ({ page, request }) => {
  const response = await request.get("/api/public/campaigns");
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json() as Array<{ slug: string; customization?: { configuration?: { roulette?: Record<string, unknown> } } }> | { items?: Array<{ slug: string; customization?: { configuration?: { roulette?: Record<string, unknown> } } }> };
  const campaigns = Array.isArray(payload) ? payload : payload.items || [];
  const campaign = campaigns.find((item) => {
    const roulette = item.customization?.configuration?.roulette;
    return roulette?.enabled === true && Array.isArray(roulette.rules) && roulette.rules.length > 0;
  });
  test.skip(!campaign, "Não existe campanha pública com roleta ativa para homologação.");
  const roulette = campaign!.customization!.configuration!.roulette!;
  expect(roulette).not.toHaveProperty("items");
  expect(JSON.stringify(roulette)).not.toContain("probability");
  expect(JSON.stringify(roulette)).not.toContain("quantity");

  await page.goto(`/campanha/${campaign!.slug}`);
  const section = page.getByTestId("roulette-combos");
  await expect(section.getByRole("heading", { name: "Roletas instantâneas" })).toBeVisible();
  await expect(section.getByText(/prêmios disponíveis/i)).toHaveCount(0);
  const combo = section.getByRole("button", { name: /Combo de .* títulos com .* giro/ }).first();
  await expect(combo).toBeVisible();
  await combo.click();
  await expect(combo).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("roulette-purchase-summary")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("respeita as seis ordens possíveis das três premiações", async ({ page, request }) => {
  const listResponse=await request.get("/api/public/campaigns");
  const listPayload=await listResponse.json() as Array<{slug:string}>|{items?:Array<{slug:string}>};
  const source=(Array.isArray(listPayload)?listPayload:listPayload.items||[])[0];
  test.skip(!source,"Não existe campanha pública para homologação.");
  const response=await request.get(`/api/public/campaigns/${source!.slug}`);
  const campaign=await response.json() as Record<string,unknown>&{customization?:{configuration?:Record<string,unknown>};instantPrizes?:unknown[];milestonePrizes?:unknown[]};
  const base={
    ...campaign,
    instantPrizes:[{id:"instant-order",exactNumber:"123",value:100,description:"Cota teste",type:"PIX",quantity:1,status:"AVAILABLE",foundCount:0,winnerCity:null,foundAt:null,imageUrl:null}],
    milestonePrizes:[{id:"milestone-order",name:"Meta teste",description:null,imageUrl:null,imageCrop:null,videoUrl:null,estimatedValue:null,percentage:50,scheduledAt:null,status:"WAITING",reachedAt:null,drawnAt:null,eligibleTicketCount:0,winner:null}],
    customization:{...(campaign.customization||{}),useOrganizerDefaults:false,configuration:{...(campaign.customization?.configuration||{}),buttonColor:"#FDE68A",roulette:{enabled:true,rules:[{id:"roulette-order",minQuantity:100,rounds:1}]}}},
  };
  const permutations=[
    ["INSTANT_WIN","MILESTONES","ROULETTE"],
    ["INSTANT_WIN","ROULETTE","MILESTONES"],
    ["MILESTONES","INSTANT_WIN","ROULETTE"],
    ["MILESTONES","ROULETTE","INSTANT_WIN"],
    ["ROULETTE","INSTANT_WIN","MILESTONES"],
    ["ROULETTE","MILESTONES","INSTANT_WIN"],
  ];
  for(const rewardSectionsOrder of permutations){
    await page.route(`**/api/public/campaigns/${source!.slug}`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({...base,rewardSectionsOrder})}),{times:1});
    await page.goto(`/campanha/${source!.slug}`);
    await expect(page.getByTestId("roulette-combos-badge")).toHaveCSS("background-color","rgb(253, 230, 138)");
    await expect(page.getByTestId("roulette-combos-badge")).toHaveCSS("color","rgb(17, 24, 39)");
    const visualOrder=await page.locator("[data-reward-section]").evaluateAll(elements=>elements.map(element=>({key:element.getAttribute("data-reward-section"),top:element.getBoundingClientRect().top})).sort((first,second)=>first.top-second.top).map(item=>item.key));
    expect(visualOrder).toEqual(rewardSectionsOrder);
    expect(new Set(visualOrder).size).toBe(3);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }
  const activityScenarios=[
    {instant:true,milestones:false,roulette:false,expected:["INSTANT_WIN"]},
    {instant:false,milestones:true,roulette:false,expected:["MILESTONES"]},
    {instant:false,milestones:false,roulette:true,expected:["ROULETTE"]},
    {instant:true,milestones:false,roulette:true,expected:["ROULETTE","INSTANT_WIN"]},
    {instant:true,milestones:true,roulette:false,expected:["INSTANT_WIN","MILESTONES"]},
    {instant:false,milestones:false,roulette:false,expected:[]},
  ];
  for(const scenario of activityScenarios){
    const body={...base,rewardSectionsOrder:["ROULETTE","INSTANT_WIN","MILESTONES"],instantPrizes:scenario.instant?base.instantPrizes:[],milestonePrizes:scenario.milestones?base.milestonePrizes:[],customization:{...base.customization,configuration:{...base.customization.configuration,roulette:{...base.customization.configuration.roulette,enabled:scenario.roulette}}}};
    await page.route(`**/api/public/campaigns/${source!.slug}`,route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)}),{times:1});
    await page.goto(`/campanha/${source!.slug}`);
    const active=await page.locator("[data-reward-section]").evaluateAll(elements=>elements.map(element=>({key:element.getAttribute("data-reward-section"),top:element.getBoundingClientRect().top})).sort((first,second)=>first.top-second.top).map(item=>item.key));
    expect(active).toEqual(scenario.expected);
  }
});
