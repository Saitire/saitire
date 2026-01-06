// scripts/lib/ai.js
import { safeExtractJson } from "./json.js";
import { cleanText, fallbackTitle } from "./text.js";
import { writeText } from "./llmWrite.js";

/**
 * Overkoepelende redactionele regels (voor alle schrijfprompts)
 */
const BASE_EDITORIAL_RULES = `
JE SCHRIJFT VOOR EEN SATIRISCHE NIEUWSSITE DIE KLINKT ALS ECHT NIEUWS.

Basisregels:
- Schrijf rustig, helder en leesbaar (vloeiende zinnen, normale alinea’s).
- Neem de lezer serieus: journalistieke toon, concrete setting, herkenbare NL-context.
- Humor ontstaat door serieuze vorm + bijna-geloofwaardige redenering die langzaam ontspoort.
- Geen grapstapeling, geen “punchline-na-punchline”, geen willekeurige absurditeit zonder logica.
- Elke grap moet aan iets concreets refereren (situatie, detail, citaat, beleid, gedrag).
- Geen ondertekening in de tekst (geen "— naam").
`.trim();

const SAFETY_SKIP_RULES = `
ALS de context duidelijk ernstig is (doden/ernstig gewond/geweld/(seksueel) geweld/zelfdoding/oorlog/terrorisme/rampen met slachtoffers/kinderen als slachtoffer), SKIP.

ALS JE MOET SKIPPEN:
{ "skip": true, "reason": "korte reden in het Nederlands" }
`.trim();

function clamp(s, n) {
  const t = String(s || "");
  return t.length > n ? t.slice(0, n) : t;
}

function jsonSchemaHintForArticle() {
  return `{
  "title": "string",
  "subtitle": "string",
  "content_markdown": "string"
}`;
}

async function repairJsonAI(ctx, rawText, schemaHint) {
  const prompt = `
Zet onderstaande output om naar GELDIGE JSON die exact dit schema volgt.

SCHEMA:
${schemaHint}

TEKST:
${String(rawText || "").slice(0, 12000)}

Regels:
- Output: ALLEEN geldige JSON
- Geen code fences (geen \`\`\`)
- Geen extra tekst
`.trim();

  const res = await ctx.openai.chat.completions.create({
    model: ctx.FILTER_MODEL,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const fixed = res.choices?.[0]?.message?.content || "";
  return safeExtractJson(fixed, null);
}

async function parseOrRepairJson(ctx, rawText, schemaHint) {
  let data = safeExtractJson(rawText || "", null);
  if (data) return data;
  return await repairJsonAI(ctx, rawText, schemaHint);
}

async function generateInvestigationInChunks(ctx, { basePrompt, maxChunks = 3, temperature = 0.85 }) {
  // Chunk 1: titel/subtitle + start content + continue flag
  const firstPrompt = `
${basePrompt}

BELANGRIJK: je output kan door max_tokens worden afgekapt. Daarom schrijf je in stukken.

Output als geldige JSON, exact:
{
  "title": "...",
  "subtitle": "...",
  "content_markdown_part": "ALLEEN DIT DEEL van de tekst (begin van artikel)",
  "continue": true|false
}

Regels:
- content_markdown_part bevat alleen artikeltekst (met \\n\\n en kopjes)
- continue=true als je nóg niet klaar bent
- eindig content_markdown_part op een volzin (., !, ? of …)
- GEEN \`\`\` code fences
- geen extra tekst buiten JSON
`.trim();

  const out1 = await writeText(ctx, {
    prompt: firstPrompt,
    temperature,
    maxTokens: 1024,
    useClaude: true,
  });

  const j1 = await parseOrRepairJson(
    ctx,
    out1,
    `{
  "title": "string",
  "subtitle": "string",
  "content_markdown_part": "string",
  "continue": true
}`
  );

  if (!j1?.content_markdown_part) return null;

  const title = cleanText(j1.title || "");
  const subtitle = cleanText(j1.subtitle || "");
  let content = String(j1.content_markdown_part || "").trim();
  let cont = j1.continue === true;

  // Chunk 2/3: vervolg
  for (let i = 2; i <= maxChunks && cont; i++) {
    const contPrompt = `
Je bent bezig met een onderzoeksartikel. Ga verder waar je gebleven was.

Laatste regels (context):
${content.slice(-1400)}

Schrijf het VOLGENDE deel.

Output als geldige JSON, exact:
{
  "content_markdown_part": "vervolgtekst (geen herhaling van eerdere tekst)",
  "continue": true|false
}

Regels:
- begin soepel (geen “Zoals eerder gezegd”)
- geen herhaling; ga direct door
- eindig op een volzin (., !, ? of …)
- GEEN \`\`\` code fences
- geen extra tekst buiten JSON
`.trim();

    const outN = await writeText(ctx, {
      prompt: contPrompt,
      temperature: Math.min(0.9, temperature + 0.02),
      maxTokens: 1024,
      useClaude: true,
    });

    const jN = await parseOrRepairJson(
      ctx,
      outN,
      `{
  "content_markdown_part": "string",
  "continue": true
}`
    );

    const part = String(jN?.content_markdown_part || "").trim();
    if (!part) break;

    content = `${content}\n\n${part}`.trim();
    cont = jN.continue === true;
  }

  return {
    title: title || null,
    subtitle: subtitle || null,
    content_markdown: content,
  };
}

// -------------------- HOOK / SUMMARIZE / FILTERS --------------------

export async function generateSocietalPulseHookAI(ctx) {
  const prompt = `
Bedenk één onderwerp dat NU leeft in Nederland (maatschappelijk gesprek), zonder te verwijzen naar een concrete echte gebeurtenis.
Maak er een plausibel ogende "nieuwskop" van die als haakje kan dienen voor satire.

Regels:
- Geen echte namen van slachtoffers, geen rampen, geen oorlog/terrorisme
- Mag wel gaan over instituties/systemen/gedrag (OV, woningmarkt, werkdruk, inflatie, onderwijs, zorg, social media, AI op werk, etc.)
- Het moet duidelijk NL-context hebben
- Output als geldige JSON, exact:
{
  "trend": "2-5 woorden onderwerp",
  "newsTitle": "korte kop (max 110 tekens)"
}
Geen extra tekst.
`.trim();

  const res = await ctx.openai.chat.completions.create({
    model: ctx.CLASSIFY_MODEL,
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  const data = safeExtractJson(res.choices?.[0]?.message?.content || "", null);
  if (!data?.trend || !data?.newsTitle) return null;
  return { trend: cleanText(data.trend), title: cleanText(data.newsTitle), link: null };
}

export async function summarizeSourceArticleAI(ctx, { headline, articleText }) {
  const txt = String(articleText || "").trim();
  if (!txt || txt.length < 300) return null;

  const prompt = `
Vat dit nieuwsartikel ZEER KORT samen, puur feitelijk.

Regels:
- Max ${ctx.SOURCE_SUMMARY_MAX_BULLETS} bullets
- Geen satire
- Geen meningen
- Alleen wat er feitelijk gebeurt
- Geen aannames
- In het Nederlands

Input:
KOP: "${headline}"

TEKST:
${txt.slice(0, ctx.SOURCE_TEXT_MAX_CHARS_FOR_AI)}

Output als geldige JSON:
{ "summary": ["feit 1", "feit 2", "feit 3"] }

Geen extra tekst.
`.trim();

  const res = await ctx.openai.chat.completions.create({
    model: ctx.FILTER_MODEL,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const data = safeExtractJson(res.choices?.[0]?.message?.content || "", null);
  if (!Array.isArray(data?.summary)) return null;

  return data.summary
    .slice(0, ctx.SOURCE_SUMMARY_MAX_BULLETS)
    .map(cleanText)
    .filter(Boolean);
}

export async function isLudicSuitableAI(ctx, { trend, newsTitle }) {
  const prompt = `
Bepaal of deze nieuwscontext geschikt is voor LUDIEKE satire.

NIET geschikt bij o.a.:
- ernstig letsel / ernstig gewond / zwaargewond / kritieke toestand / (ernstig) ziekenhuis
- doden / overleden / om het leven / dodelijk
- oorlog/terrorisme/aanslagen/gijzeling
- (seksueel) geweld, mishandeling, zelfdoding
- rampen met slachtoffers
- kinderen als slachtoffer

Input:
Trend: "${trend}"
Nieuwskop: "${newsTitle}"

Antwoord als geldige JSON, exact:
{ "suitable": true|false, "reason": "kort" }

Geen extra tekst.
`.trim();

  const res = await ctx.openai.chat.completions.create({
    model: ctx.FILTER_MODEL,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const data = safeExtractJson(res.choices?.[0]?.message?.content || "", { suitable: false, reason: "" });
  return { suitable: data?.suitable === true, reason: cleanText(data?.reason || "") };
}

export async function classifyCategoryAI(ctx, { trend, newsTitle }) {
  const prompt = `
Kies precies één categorie voor een satirisch nieuwsartikel.

Input:
- Trend: "${trend}"
- Nieuwskop: "${newsTitle}"

Kies exact één van deze labels:
politiek
binnenland
buitenland
tech
lifestyle
sport
cultuur

Regels:
- Antwoord met alleen het label, exact gespeld zoals hierboven
- Geen uitleg, geen extra woorden
`.trim();

  const res = await ctx.openai.chat.completions.create({
    model: ctx.CLASSIFY_MODEL,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const label = (res.choices?.[0]?.message?.content || "").trim().toLowerCase();
  const allowed = new Set(["politiek", "binnenland", "buitenland", "tech", "lifestyle", "sport", "cultuur"]);
  return allowed.has(label) ? label : "binnenland";
}

// -------------------- WRITING RULES --------------------

function getTypeRules(article_type) {
  if (article_type === "short") {
    return `
VORM (KORT NIEUWS):
- 90–150 woorden
- 2 korte alinea’s (niet 1)
- Eén centrale observatie/situatie
- Rustige opbouw → één duidelijke escalatie → droge afsluiter
- Maximaal één expliciete grap per alinea (liefst impliciet)
- Geen kopjes, geen opsommingen
- Eindig altijd op een volledige zin (laatste teken: ., !, ? of …)
`.trim();
  }

  if (article_type === "investigation") {
    return `
VORM (ONDERZOEKSREDACTIE):
- 1400–2200 woorden (mag door trims iets korter uitvallen)
- Rustig tempo, heel goed leesbaar, journalistieke toon
- Gebruik kopjes (4–6) zoals echte onderzoeksjournalistiek
- Open met een concrete onderzoeksvraag (1 alinea)
- Minstens 4 interviews/quotes met naam + rol (verzonnen mag, plausibel)
- Minstens 4 ‘bronnen’ (cijfers/rapporten/notities/lekken) (verzonnen mag, plausibel)
- Laat minstens 2 bronnen elkaar tegenspreken
- Humor: serieuze toon + bureaucratische logica + herkenbare NL-details
- Eindig droog, institutioneel, zonder moraal
- Eindig altijd op een volledige zin (laatste teken: ., !, ? of …)
`.trim();
  }

  return `
VORM (NORMAAL ARTIKEL):
- 320–520 woorden
- 3–5 alinea’s
- Elke alinea: eerst concrete setting/context, dan observatie/verdraaiing
- Maximaal één expliciete grap per alinea (liefst onderkoeld)
- Geen kopjes, geen opsommingen
- Eindig altijd op een volledige zin (laatste teken: ., !, ? of …)
`.trim();
}

function getModeRules(topic_mode) {
  return topic_mode === "societal_pulse"
    ? `CONTEXT:\n- Dit is "societal pulse": claim geen concrete echte gebeurtenis.`
    : `CONTEXT:\n- Dit is gebaseerd op een echte trending context.`;
}

// -------------------- MAIN: GENERATE ARTICLE --------------------

export async function generateArticle(ctx, {
  trend,
  newsTitle,
  newsLink,
  sourceSummary,
  category,
  editor,
  article_type,
  topic_mode,
  feedbackContext,
}) {
  const typeRules = getTypeRules(article_type);
  const modeRules = getModeRules(topic_mode);

  const summaryBlock =
    topic_mode === "trending" && Array.isArray(sourceSummary) && sourceSummary.length
      ? `FEITELIJKE SAMENVATTING (alleen context, niet kopiëren):
- ${sourceSummary.join("\n- ")}\n`
      : "";

  const feedbackBlock = feedbackContext?.trim()
    ? `REDACTIE-FEEDBACK OM TOE TE PASSEN:
${feedbackContext.trim()}
`
    : "";

  const editorVoice = Array.isArray(editor?.voice) ? editor.voice.map(cleanText).filter(Boolean) : [];
  const editorMoves = Array.isArray(editor?.signature_moves) ? editor.signature_moves.map(cleanText).filter(Boolean) : [];
  const editorTaboos = Array.isArray(editor?.taboos) ? editor.taboos.map(cleanText).filter(Boolean) : [];
  const editorCatch = Array.isArray(editor?.catchphrases) ? editor.catchphrases.map(cleanText).filter(Boolean) : [];

  const prompt = `
${BASE_EDITORIAL_RULES}

Je bent een vaste satirische redacteur/columnist.

Naam: ${editor?.name}
Rol: ${editor?.role}

STEM (volgen):
${editorVoice.length ? `- ${editorVoice.join("\n- ")}` : "- Droog, helder, herkenbaar NL, met context."}

SIGNATURE MOVES (optioneel):
${editorMoves.length ? `- ${editorMoves.join("\n- ")}` : "- Eindig droog."}

TABOES (hard):
${editorTaboos.length ? `- ${editorTaboos.join("\n- ")}` : "- Geen kwetsbare slachtoffers als mikpunt."}

Catchphrases (max 1, alleen als het past):
${editorCatch.length ? `- ${editorCatch.join("\n- ")}` : "- (geen)"}

SCHRIJF ÉÉN SATIRISCH NIEUWSARTIKEL (Speld-achtig: droog, institutioneel, logisch-absurd).

${SAFETY_SKIP_RULES}

ANDERS:

SATIRISCHE PREMISSE (VERPLICHT):
- Bepaal: WAT wordt belachelijk gemaakt (beleid/systeem/collectief gedrag/managementtaal/moraalpaniek)?
- In de eerste alinea moet duidelijk zijn waar de spot naartoe gaat (zonder knipoog).
- Het stuk moet te herleiden zijn tot:
  “Nederland lost [probleem] op door [verkeerde maar logisch gepresenteerde maatregel].”
- Elke alinea dient diezelfde premisse (geen zijpaden).

STIJL:
- Nooit de grap uitleggen.
- Droge, journalistieke toon.
- Humor via serieuze vorm + procedure + herkenbare details.
- Eindig droog en procedureel.

${modeRules}

${typeRules}

${feedbackBlock}

${summaryBlock}

INPUT:
- Thema: "${trend}"
- Haakje (kop): "${newsTitle}"
- Link (alleen context, kan null zijn): "${newsLink}"

OUTPUT (ALLEEN GELDIGE JSON):
{
  "title": "korte, scherpe kop (max 90 tekens)",
  "subtitle": "droge teaser (max 120 tekens)",
  "content_markdown": "tekst met \\n\\n tussen alinea’s (kopjes bij onderzoek). GEEN ondertekening."
}
`.trim();

  let data;

  if (article_type === "investigation") {
    // Claude chunked generation + JSON repair fallback via OpenAI filter model
    const chunked = await generateInvestigationInChunks(ctx, {
      basePrompt: prompt,
      maxChunks: 3,
      temperature: ctx.WRITE_TEMPERATURE ?? 0.85,
    });

    if (!chunked?.content_markdown) throw new Error("Geen geldige JSON uit investigation chunks");

    data = {
      title: chunked.title || "",
      subtitle: chunked.subtitle || "",
      content_markdown: chunked.content_markdown || "",
    };
  } else {
    const outText = await writeText(ctx, {
      prompt,
      temperature: ctx.WRITE_TEMPERATURE ?? 0.85,
      maxTokens: 2500,
      useClaude: false,
    });

    data = await parseOrRepairJson(ctx, outText, jsonSchemaHintForArticle());
  }

  if (!data) throw new Error("Geen geldige JSON uit generateArticle");

  if (data?.skip === true) {
    return { skip: true, reason: cleanText(data.reason || "Niet geschikt"), category };
  }

  return {
    title: cleanText(data.title || fallbackTitle(trend)),
    subtitle: cleanText(data.subtitle || "Het land reageert met urgentie en uitstel."),
    content_markdown: String(data.content_markdown || "").trim(),
    category,
  };
}

// -------------------- ACTUALITY / PEOPLE EXTRACTION --------------------

export async function extractTimelyClaimsAI(ctx, { articleTitle, articleSubtitle, articleContent }) {
  const prompt = `
Selecteer alleen claims uit dit satirische artikel die:
1) tijdgevoelig zijn (iets dat "nu" waar/actueel moet zijn), én
2) feitelijk te verifiëren zijn via nieuwsbronnen (dus niet duidelijk satirische framing).

NEEM WEL MEE (voorbeelden):
- “X is benoemd tot …”
- “Y is ontslagen / gestopt als …”
- “Wet/maatregel Z is ingevoerd / teruggedraaid”
- “Bedrijf Q heeft CEO vervangen”
- “Politicus P bekleedt nu functie F”
- “Team A heeft wedstrijd B gewonnen” (alleen bij sportuitslag)

NEEM NIET MEE:
- satirische interpretaties
- algemeenheden zonder checkbare kern
- duidelijk absurdistische zinnen die niet bedoeld zijn als feit
- meningen, hyperbool, sarcasme, beeldspraak
- vage claims zonder wie/wat

Input:
TITLE: "${articleTitle}"
SUBTITLE: "${articleSubtitle}"
BODY:
${String(articleContent || "").slice(0, 2500)}

Output als geldige JSON:
{
  "claims": [
    {
      "claim": "letterlijke, korte, checkbare claim uit de tekst",
      "query": "zoekopdracht om te verifiëren (Nederlands, 4–10 woorden)",
      "type": "coach|player|politics|ceo|role|law|policy|election|sports_result|other"
    }
  ]
}

Regels:
- Max 5 claims
- Als er geen echt checkbare tijdclaim is: { "claims": [] }
- Gebruik bij 'query' het belangrijkste eigennaam + functie/rol/onderwerp
- Geen extra tekst.
`.trim();

  const res = await ctx.openai.chat.completions.create({
    model: ctx.FILTER_MODEL,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const data = safeExtractJson(res.choices?.[0]?.message?.content || "", { claims: [] });
  return Array.isArray(data?.claims) ? data.claims.slice(0, 5) : [];
}

export async function actualityCheckAI(ctx, { claim, headlines }) {
  const prompt = `
Check actualiteit.

Claim:
"${claim}"

Recente koppen:
${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

Output:
{ "ok": true/false, "confidence": 0-100, "reason": "kort", "rewrite_instructions": "..." }

Regels:
- ok=false alleen als WAARSCHIJNLIJK onjuist/verouderd
- Onzeker: ok=true met lage confidence
- Geen extra tekst.
`.trim();

  const res = await ctx.openai.chat.completions.create({
    model: ctx.FILTER_MODEL,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  return safeExtractJson(res.choices?.[0]?.message?.content || "", { ok: true, confidence: 0, reason: "" });
}

export async function extractPersonNamesAI(ctx, { newsTitle, articleTitle, articleSubtitle, articleContent }) {
  const prompt = `
Haal alleen PERSONEN (echte mensen) uit onderstaande tekst.
Geen organisaties, landen, tv-programma's, voetbalclubs.

Input:
- Nieuwskop: "${newsTitle}"
- Titel: "${articleTitle}"
- Subtitle: "${articleSubtitle}"
- Tekst: "${String(articleContent || "").slice(0, 1400)}"

Output:
{ "people": ["Voornaam Achternaam"] }

Regels:
- Max 5
- Geen: { "people": [] }
- Geen extra tekst.
`.trim();

  const res = await ctx.openai.chat.completions.create({
    model: ctx.FILTER_MODEL,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const data = safeExtractJson(res.choices?.[0]?.message?.content || "", { people: [] });
  const people = Array.isArray(data?.people) ? data.people : [];
  return people.map((x) => cleanText(x)).filter(Boolean).slice(0, 5);
}

// -------------------- WRITERS ROOM --------------------

const WRITERS_ROOM = [
  { id: "absurdist", name: "De Absurdist", vibe: "Escalatie, krankzinnig maar logisch gebracht" },
  { id: "cynic", name: "De Cynicus", vibe: "Droog, snijdend, institutioneel cynisme" },
  { id: "builder", name: "De Bouwmeester", vibe: "Opbouw, timing, leesbaarheid" },
];

export async function writersRoomNotesAI(ctx, { title, subtitle, content, article_type, topic_mode }) {
  const reviewers = [WRITERS_ROOM[0], WRITERS_ROOM[1], WRITERS_ROOM[2]];
  const notes = [];

  for (const r of reviewers) {
    const prompt = `
${BASE_EDITORIAL_RULES}

Je bent ${r.name}. Jouw stijl: ${r.vibe}.

TAAK: geef REDACTIENOTITIES om dit satirische artikel beter te maken (leesbaarder + sterker + grappiger door vorm).
Regels:
- Max 6 bullets
- Super concreet: wijs 1–2 plekken aan die onduidelijk/te vol/te staccato zijn en zeg wat er moet veranderen
- Geef 2 mogelijke wendingen (kort, concreet, passend bij de premisse)
- Geef 1 voorstel voor een betere laatste zin (droog)
- Geen volledige herschrijving
- Geen \`\`\` fences

Context:
type=${article_type} mode=${topic_mode}

DRAFT:
TITEL: ${title}
SUBTITLE: ${subtitle}
TEKST:
${clamp(content, 2600)}

Output als geldige JSON:
{ "notes": ["...","..."] }
Geen extra tekst.
`.trim();

    const res = await ctx.openai.chat.completions.create({
      model: ctx.FILTER_MODEL,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const data = safeExtractJson(res.choices?.[0]?.message?.content || "", { notes: [] });
    const arr = Array.isArray(data?.notes) ? data.notes : [];
    notes.push({
      reviewer: r.id,
      name: r.name,
      notes: arr.map(cleanText).filter(Boolean).slice(0, 6),
    });
  }

  return notes;
}

export async function punchUpRewriteAI(ctx, args) {
  // Laat dit voorlopig OpenAI blijven (stabieler voor JSON), zeker nu investigation chunking al veel doet.
  // Je kunt dit later ook chunked maken als je wil.
  const {
    trend,
    newsTitle,
    newsLink,
    sourceSummary,
    category,
    editor,
    article_type,
    topic_mode,
    feedbackContext,
    draftTitle,
    draftSubtitle,
    draftContent,
    writersNotes,
  } = args;

  const typeRules = getTypeRules(article_type);
  const modeRules = getModeRules(topic_mode);

  const summaryBlock =
    topic_mode === "trending" && Array.isArray(sourceSummary) && sourceSummary.length
      ? `FEITELIJKE SAMENVATTING (alleen context, niet kopiëren):
- ${sourceSummary.join("\n- ")}\n`
      : "";

  const feedbackBlock = feedbackContext?.trim()
    ? `REDACTIE-FEEDBACK OM TOE TE PASSEN:
${feedbackContext.trim()}
`
    : "";

  const notesBlock = (writersNotes || [])
    .map((x) => `- ${x.name}:\n  ${Array.isArray(x.notes) ? x.notes.map((n) => `• ${n}`).join("\n  ") : ""}`)
    .join("\n");

  const prompt = `
${BASE_EDITORIAL_RULES}

Je bent de hoofdauteur. Je krijgt interne redactienotities.
HERSCHRIJF het artikel zodat het duidelijker, beter opgebouwd en Speld-achtiger wordt (droog, institutioneel, logisch-absurd).

DOELEN:
- Premisse snel helder (zonder te schreeuwen)
- Minder stapeling: schrap drukke zinnen
- Betere opbouw: context → frictie → escalatie → droge uitloop
- Verhoog absurditeit via beleid/procedures/woordvoerders
- Voeg maximaal 2 citeerbare zinnen toe (kort, snijdend)
- Upgrade de laatste zin: droog, institutioneel (geen moraal)
- Eindig altijd op een volledige zin (., !, ? of …)

${modeRules}
${typeRules}

${feedbackBlock}
${summaryBlock}

INTERN NOTES:
${notesBlock || "(geen)"}

ORIGINEEL DRAFT:
TITEL: ${draftTitle}
SUBTITLE: ${draftSubtitle}
TEKST:
${draftContent}

OUTPUT (ALLEEN GELDIGE JSON):
{
  "title": "korte, scherpe kop (max 90 tekens)",
  "subtitle": "droge teaser (max 120 tekens)",
  "content_markdown": "herschreven artikeltekst met \\n\\n tussen alinea’s (of kopjes bij onderzoek). GEEN ondertekening."
}
`.trim();

  const outText = await writeText(ctx, {
    prompt,
    temperature: Math.min(0.92, (ctx.WRITE_TEMPERATURE ?? 0.85) + 0.03),
    maxTokens: 2500,
    useClaude: false,
  });

  const data = await parseOrRepairJson(ctx, outText, jsonSchemaHintForArticle());
  if (!data) throw new Error("Geen geldige JSON uit punchUpRewriteAI");

  return {
    title: cleanText(data.title || draftTitle),
    subtitle: cleanText(data.subtitle || draftSubtitle),
    content_markdown: String(data.content_markdown || "").trim(),
    category,
  };
}

export async function finalEditorPassAI(ctx, { editor, title, subtitle, content, article_type }) {
  const voice = Array.isArray(editor?.voice) ? editor.voice.map(cleanText).filter(Boolean) : [];
  const sigMoves = Array.isArray(editor?.signature_moves) ? editor.signature_moves.map(cleanText).filter(Boolean) : [];
  const taboos = Array.isArray(editor?.taboos) ? editor.taboos.map(cleanText).filter(Boolean) : [];
  const catchphrases = Array.isArray(editor?.catchphrases) ? editor.catchphrases.map(cleanText).filter(Boolean) : [];

  const maybeCatchphrase =
    catchphrases.length && Math.random() < 0.30
      ? catchphrases[Math.floor(Math.random() * catchphrases.length)]
      : null;

  const prompt = `
${BASE_EDITORIAL_RULES}

Je bent de EINDREDACTEUR.

Naam: ${editor?.name || "Redactie"}
Rol: ${editor?.role || "Eindredactie"}

STEM (volgen):
${voice.length ? `- ${voice.join("\n- ")}` : "- Droog, helder, weinig uitleg, wel context waar nodig."}

SIGNATURE MOVES (kies er 1–2 en voer ze echt uit):
${sigMoves.length ? `- ${sigMoves.join("\n- ")}` : "- Maak de laatste zin droog en kil."}

TABOES (hard blokkeren):
${taboos.length ? `- ${taboos.join("\n- ")}` : "- Geen privépersonen, geen slachtoffers, geen haat."}

DOEL:
- Maak het strakker en leesbaarder (niet ‘drukker’)
- Snijd verklarende zinnen weg die de grap uitleggen
- Check dat elke alinea de satirische premisse dient
- Upgrade de laatste zin: droog, procedureel, moreel leeg, volledig in de context, laat het terugpakken op de strekking van het artikel
- Eindig altijd op een volledige zin (., !, ? of …)

OPTIONEEL:
- 0–1 catchphrase als het natuurlijk past
Catchphrase suggestie: ${maybeCatchphrase ? `"${maybeCatchphrase}"` : "(geen)"}

INPUT:
TYPE: ${article_type}
TITEL: ${title}
SUBTITLE: ${subtitle}
TEKST:
${clamp(content, 3800)}

Output als geldige JSON:
{
  "title": "...",
  "subtitle": "...",
  "content_markdown": "..."
}
Geen extra tekst.
`.trim();

  const outText = await writeText(ctx, {
    prompt,
    temperature: 0.7,
    maxTokens: 1800,
    useClaude: false,
  });

  const data = await parseOrRepairJson(ctx, outText, jsonSchemaHintForArticle());
  if (!data) return { title, subtitle, content_markdown: content };

  return {
    title: cleanText(data.title || title),
    subtitle: cleanText(data.subtitle || subtitle),
    content_markdown: String(data.content_markdown || content).trim(),
  };
}
