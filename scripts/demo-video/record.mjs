import { chromium, devices } from "playwright";
import fs from "fs";
const D = process.env.OUT;
const B = "http://localhost:3000";
const G = B + "/social/grupos/d0000000-0000-4000-8000-000000000001";
const ev = (n) => G + "/eventos/d0000000-0000-4000-8000-0000000000d" + n;
const device = { ...devices["Pixel 7"], geolocation: { latitude: 41.1496, longitude: -8.6109 }, permissions: ["geolocation"] };
const browser = await chromium.launch({ headless: false, args: ["--window-position=-2400,0"] });

// Log in and warm up every page (the dev server compiles on first visit).
const warm = await browser.newContext(device);
const w = await warm.newPage();
await w.goto(B + "/login");
await w.fill("input[type=email]", "teste@mordomia.local"); await w.fill("input[type=password]", "teste1234");
await w.getByRole("button", { name: "Entrar", exact: true }).click(); await w.waitForURL((u) => !u.pathname.startsWith("/login"));
for (const u of [B + "/", B + "/account", B + "/social", G, ev(1), ev(2), ev(3), ev(4), G + "/detalhes"]) { await w.goto(u); await w.waitForTimeout(1500); }
await warm.storageState({ path: D + "/state.json" });
await warm.close();

const ctx = await browser.newContext({ ...device, storageState: D + "/state.json" });
await ctx.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = "nextjs-portal{display:none!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
});
const p = await ctx.newPage();
// Full-resolution frames straight from the browser, each with its timestamp.
const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on("Page.screencastFrame", (frame) => {
  const file = D + "/frames/" + String(frames.length).padStart(5, "0") + ".jpg";
  fs.writeFileSync(file, Buffer.from(frame.data, "base64"));
  frames.push({ file, ts: frame.metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: 1080, maxHeight: 2200, everyNthFrame: 1 });
const t0 = Date.now();
const log = (s) => console.log(((Date.now() - t0) / 1000).toFixed(1) + "s " + s);
const wait = (ms) => p.waitForTimeout(ms);
const ready = (text) => p.getByText(text).first().waitFor({ timeout: 20000 });

async function cap(text) {
  await p.evaluate((t) => {
    let el = document.getElementById("demo-cap");
    if (!el) {
      el = document.createElement("div"); el.id = "demo-cap"; document.body.appendChild(el);
      Object.assign(el.style, { position: "fixed", left: "50%", top: "calc(env(safe-area-inset-top) + 64px)", zIndex: 2147483647,
        background: "rgba(20,20,20,.9)", color: "#fff", padding: "10px 18px", borderRadius: "999px", font: "700 15px system-ui, sans-serif",
        boxShadow: "0 8px 24px rgba(0,0,0,.3)", whiteSpace: "nowrap", pointerEvents: "none" });
    }
    el.textContent = t;
    el.animate([{ opacity: 0, transform: "translate(-50%, -10px) scale(.95)" }, { opacity: 1, transform: "translate(-50%, 0) scale(1)" }], { duration: 350, fill: "forwards", easing: "ease-out" });
  }, text);
}
async function card(sub, ms) {
  await p.evaluate((sub) => {
    const el = document.createElement("div"); el.id = "demo-card";
    el.innerHTML = '<div style="font:900 52px system-ui;letter-spacing:-1px">🎩 Mordomia</div><div style="margin-top:12px;font:600 18px system-ui;opacity:.9;max-width:300px">' + sub + "</div>";
    Object.assign(el.style, { position: "fixed", inset: "0", zIndex: 2147483647, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", color: "#fff", background: "linear-gradient(160deg,#fb923c,#c2410c 60%,#9a3412)" });
    document.body.appendChild(el);
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, fill: "forwards" });
  }, sub);
  await wait(ms);
}
const uncard = () => p.evaluate(() => { const el = document.getElementById("demo-card"); if (el) el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }).onfinish = () => el.remove(); });
const smooth = (y) => p.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
const smoothTo = (loc) => loc.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));

// Intro
await p.goto(B + "/");
await card("Os restaurantes onde foste, os que queres ir, e os jantares com os amigos.", 2600);
await uncard(); log("map");
await p.getByRole("button", { name: "Pesquisar restaurantes" }).waitFor({ timeout: 20000 });
await cap("🗺️ Os teus restaurantes no mapa"); await wait(2500);

// Search + save
log("search");
await p.getByRole("button", { name: "Pesquisar restaurantes" }).click();
await cap("🔎 Procura qualquer restaurante");
await p.getByLabel("Nome do restaurante").pressSequentially("Café Santiago Porto", { delay: 60 });
const result = p.getByRole("button", { name: /Café Santiago.*Passos Manuel/ }).first();
await result.waitFor({ timeout: 20000 }); await wait(600); await result.click();
await cap("🤤 Quero ir ou ⭐ Já fui: tu escolhes"); await wait(1300);
await p.getByRole("button", { name: "Quero ir!" }).click(); await wait(1700);

// My list
log("list");
await p.getByRole("button", { name: "Abrir menu da lista" }).click(); await wait(500);
await p.getByRole("menuitem", { name: "A minha lista" }).or(p.getByRole("button", { name: "A minha lista" })).first().click();
await cap("📋 As tuas listas, sempre à mão"); await wait(2500);

// Profile levels
log("profile");
await p.goto(B + "/account"); await ready(/Ver níveis/); await cap("🏅 Sobe de nível a cada restaurante"); await wait(1300);
await p.getByRole("button", { name: /Ver níveis/ }).click(); await wait(2100);
await p.keyboard.press("Escape"); await wait(300);

// Feed
log("feed");
await p.goto(B + "/social"); await p.getByRole("button", { name: "Guardar nas minhas listas" }).first().waitFor({ timeout: 20000 });
await cap("👀 Vê onde os amigos andam a comer"); await wait(1600);
await p.getByRole("button", { name: "Guardar nas minhas listas" }).first().click(); await wait(700);
await p.getByRole("menuitem", { name: /Quero ir/ }).click(); await wait(1200);

// Group
log("group");
await p.goto(G); await ready("Pizza night"); await cap("👥 Grupos e jantares com amigos"); await wait(2000);

// Dice
log("dice");
await p.getByRole("link", { name: /Sushi de sábado/ }).click();
await p.getByRole("button", { name: /Lançar o dado/ }).waitFor();
await cap("🎲 O dado escolhe o mordomo"); await wait(700);
await p.getByRole("button", { name: /Lançar o dado/ }).click(); await wait(3800);

// Poll
log("poll");
await p.goto(ev(2)); await ready(/17 de outubro/); await cap("🗳️ Votem nos dias que dão jeito"); await wait(900); await smooth(420); await wait(1500);

// Dated event
log("dated");
await p.goto(ev(3)); await ready("Habemus data!"); await cap("🎉 Habemus data! Com local e quem vai"); await wait(1400);
await smoothTo(p.getByText("Quem vai").first()); await wait(1300);
await smoothTo(p.locator("#price-guess")); await wait(900);
await cap("💶 Preço certo: adivinha a conta por pessoa");
await p.locator("#price-guess").pressSequentially("29,90", { delay: 110 }); await wait(300);
await p.getByRole("button", { name: "Apostar" }).click(); await wait(1300);
log("close bets");
await smoothTo(p.getByRole("button", { name: /Fechar apostas/ })); await wait(500);
await cap("🔒 O mordomo fecha as apostas…");
await p.getByRole("button", { name: /Fechar apostas/ }).click(); await wait(1000);
await p.getByRole("button", { name: "Fechar e meter a conta" }).click(); await wait(900);
await cap("🧾 …mete a conta final…");
await p.getByPlaceholder("0,00").first().pressSequentially("126", { delay: 120 }); await wait(400);
await p.getByRole("button", { name: "Continuar" }).click(); await wait(1200);
await cap("🥁 …e revela!");
await p.getByRole("button", { name: /Revelar a todos/ }).click();
await p.getByRole("button", { name: "Ver resultados" }).waitFor({ timeout: 10000 }); await wait(1700);
await p.getByRole("button", { name: "Ver resultados" }).click(); await wait(1600);

// Close event
log("close event");
await smoothTo(p.getByRole("button", { name: /Encerrar evento/ })); await wait(600);
await cap("🏁 No fim, o mordomo encerra o evento");
await p.getByRole("button", { name: /Encerrar evento/ }).click(); await wait(900);
await p.getByRole("dialog").getByRole("button", { name: "Encerrar evento" }).click();
await p.getByRole("dialog", { name: "Obrigado, mordomo" }).waitFor(); await wait(2600);
await p.getByRole("button", { name: /De nada/ }).click(); await wait(1500);

// Past + leaderboard
log("past");
await p.goto(G + "?eventos=passados"); await ready("Francesinhas no Fase"); await cap("📚 Os eventos passados ficam guardados"); await wait(2200);
await p.goto(G + "/detalhes"); await ready("Quem foi a mais mordomias"); await cap("🏆 E as classificações do grupo"); await wait(1200);
await smooth(5000); await wait(2600);

// Outro
log("outro");
await p.evaluate(() => document.getElementById("demo-cap")?.remove());
await card("Come bem. Com os teus amigos. 🍽️", 3200);
log("end");
await cdp.send("Page.stopScreencast");
// ffmpeg concat list: each frame lasts until the next one.
let list = "";
frames.forEach((frame, i) => {
  const next = frames[i + 1]?.ts ?? frame.ts + 0.04;
  list += "file '" + frame.file + "'\nduration " + Math.max(next - frame.ts, 0.001).toFixed(4) + "\n";
});
list += "file '" + frames.at(-1).file + "'\n";
fs.writeFileSync(D + "/frames.txt", list);
console.log("FRAMES", frames.length, "span", (frames.at(-1).ts - frames[0].ts).toFixed(1));
await ctx.close();
await browser.close();
