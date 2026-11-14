import * as pollen from "./shared/pollen.js";
import { group, verdict, campsFromLabels } from "./shared/agree.js";

const SYSTEM =
  "Answer the user's question directly in at most 90 words. No preamble, no restating the " +
  "question, no list of caveats. Commit to a position when the question asks for one.";

// Every chip is selected when the page loads, so every entry has to be free
// (`paid_only: false` on GET /models). A paid one would 402 on the first run for a
// visitor on free Pollen and leave the answer grid half empty.
const DEFAULT_MODELS = [
  ["openai/gpt-5.4-nano", "OpenAI"],
  ["meta/muse-spark-open", "Meta"],
  ["deepseek/deepseek-v4.1-flash", "DeepSeek"],
  ["mistralai/mistral-large-3", "Mistral"],
  ["x-ai/grok-4.6", "xAI"],
  ["nvidia/nemotron-3.5-lightning", "NVIDIA"],
];

const PRESETS = [
  "Is a hot dog a sandwich?",
  "Should a startup raise prices or add a cheaper tier first?",
  "What is the single most useful thing a person can do in their twenties?",
  "Was the printing press net good for Europe in the 1500s?",
];

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

const state = {
  selected: new Set(DEFAULT_MODELS.map(([id]) => id)),
  pricing: new Map(),
  answers: [],
  running: false,
};

let pollTimer = null;

function priceOf(model) {
  const row = state.pricing.get(model);
  if (!row) return null;
  return {
    prompt: Number(row.promptTextTokens || 0),
    completion: Number(row.completionTextTokens || 0),
  };
}

function pollenCost(model, usage) {
  const price = priceOf(model);
  if (!price || !usage) return null;
  const prompt = usage.prompt_tokens || 0;
  const completion = usage.completion_tokens || 0;
  return prompt * price.prompt + completion * price.completion;
}

function fmtPollen(value) {
  if (value == null) return "";
  if (value >= 0.01) return `${value.toFixed(3)} Pollen`;
  return `${(value * 1000).toFixed(2)} mPollen`;
}

function renderModels() {
  const box = $("models");
  box.replaceChildren();
  for (const [id, label] of DEFAULT_MODELS) {
    const on = state.selected.has(id);
    const chip = el("button", `model${on ? " on" : ""}`, label);
    chip.type = "button";
    chip.dataset.model = id;
    chip.title = id;
    chip.setAttribute("aria-pressed", String(on));
    chip.addEventListener("click", () => {
      if (state.selected.has(id)) {
        if (state.selected.size <= 2) return;
        state.selected.delete(id);
      } else {
        if (state.selected.size >= 6) return;
        state.selected.add(id);
      }
      renderModels();
    });
    box.append(chip);
  }
  $("run-count").textContent = String(state.selected.size);
}

function renderPresets() {
  const box = $("presets");
  box.replaceChildren();
  for (const q of PRESETS) {
    const chip = el("button", "chip", q);
    chip.type = "button";
    chip.addEventListener("click", () => {
      $("question").value = q;
      $("question").focus();
    });
    box.append(chip);
  }
}

function card(model, label) {
  const node = el("article", "card");
  node.dataset.model = model;
  const head = el("div", "card-head");
  head.append(el("span", "who", label), el("span", "meta", "waiting"));
  const body = el("p", "text", "");
  body.dataset.role = "text";
  node.append(head, body);
  return node;
}

function setCardState(node, status, message) {
  const meta = node.querySelector(".meta");
  meta.textContent = status;
  node.dataset.status = status;
  if (message != null) node.querySelector(".text").textContent = message;
}

const SHORT = new Map(DEFAULT_MODELS);


function shortName(model) {
  return SHORT.get(model) || model.split("/").slice(-1)[0];
}

async function run() {
  if (state.running) return;
  if (!pollen.connected()) {
    openConnect("Connect your Pollen to spend one call per model.");
    return;
  }
  const question = $("question").value.trim();
  if (question.length < 3) {
    $("hint").textContent = "Write a question first.";
    return;
  }
  state.running = true;
  $("run").disabled = true;
  $("split").hidden = true;
  const chosen = DEFAULT_MODELS.filter(([id]) => state.selected.has(id));
  const box = $("answers");
  box.replaceChildren();
  state.answers = [];

  const nodes = chosen.map(([id, label]) => {
    const node = card(id, label);
    box.append(node);
    return node;
  });
  nodes.forEach((node) => setCardState(node, "asking…"));

  const settled = await Promise.all(
    chosen.map(async ([id], i) => {
      try {
        let result;
        try {
          result = await pollen.ask(id, question, { system: SYSTEM });
        } catch (first) {
          // some models refuse a small completion budget instead of trimming it
          if (/token limit|no text/i.test(first.message)) {
            result = await pollen.ask(id, question, { system: SYSTEM, maxTokens: 2400 });
          } else {
            throw first;
          }
        }
        state.answers[i] = { model: id, ok: true, text: result.text, ms: result.ms, usage: result.usage };
        const node = nodes[i];
        setCardState(node, `${(result.ms / 1000).toFixed(1)}s · ${fmtPollen(pollenCost(id, result.usage))}`, result.text);
        return true;
      } catch (error) {
        state.answers[i] = { model: id, ok: false, error: error.message };
        setCardState(nodes[i], "failed", error.message);
        return false;
      }
    }),
  );

  state.running = false;
  $("run").disabled = false;
  const ok = settled.filter(Boolean).length;
  if (!ok) {
    $("hint").textContent = "No model answered. Check the connection and try again.";
    return;
  }
  $("hint").textContent = `${ok} of ${chosen.length} answered.`;
  showCamps(localCamps());
}

function localCamps() {
  const answers = state.answers.filter((a) => a && a.ok);
  const result = group(answers);
  return {
    camps: result.camps,
    mean: result.mean,
    size: result.size,
    hint: "Camps are grouped by shared vocabulary in the answers themselves, so this part costs nothing.",
  };
}

function showCamps(result) {
  const panel = $("split");
  panel.hidden = false;
  $("camps").replaceChildren();
  result.camps.forEach((camp, index) => {
    const row = el("div", "camp");
    const head = el("div", "camp-head");
    const members = camp.items || camp;
    const only = members.length === 1 ? `Only ${shortName(members[0].model)}` : null;
    const label = camp.label || only || `Camp ${index + 1}`;
    head.append(el("strong", null, label), el("span", "camp-size", `${members.length} answer${members.length === 1 ? "" : "s"}`));
    row.append(head);
    const names = members.map((a) => shortName(a.model));
    row.append(el("p", "camp-models", names.join(" · ")));
    const snippet = members[0]?.text || "";
    row.append(el("p", "camp-snippet", snippet.slice(0, 180)));
    $("camps").append(row);
  });
  $("split-hint").textContent = result.hint;
  $("judge").hidden = result.camps.some((camp) => camp.label);
}

async function judge() {
  if (!pollen.connected()) {
    openConnect("Connect your Pollen first.");
    return;
  }
  const answers = state.answers.map((a, i) => ({ ...a, index: i })).filter((a) => a && a.ok);
  if (answers.length < 2) return;
  $("judge").disabled = true;
  $("split-hint").textContent = "One judge call reads the answers and names the camps…";
  const prompt = [
    "Below are answers from different models to the same question, numbered from 0.",
    "Give each answer a short camp label (two or three words) describing the position it takes.",
    "Answers that take the same position must get exactly the same label.",
    'Reply with JSON only: {"labels": ["...", "..."]} in order.',
    "",
    ...answers.map((a, i) => `#${i} (${a.model})\n${a.text}`),
  ].join("\n");
  try {
    const { text } = await pollen.ask("openai/gpt-5.4-nano", prompt, { maxTokens: 260, temperature: 0 });
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    const labels = parsed?.labels;
    if (!Array.isArray(labels) || labels.length !== answers.length) throw new Error("the judge did not return labels");
    const labelByIndex = new Map();
    answers.forEach((a, i) => labelByIndex.set(a.index, labels[i]));
    const grouped = campsFromLabels(
      state.answers,
      state.answers.map((a, i) => (a && a.ok && labelByIndex.has(i) ? labelByIndex.get(i) : null)),
    );
    const mean = group(state.answers.filter((a) => a && a.ok)).mean;
    showCamps({
      camps: grouped.map((c) => ({ items: c.items, label: c.label })),
      mean,
      size: answers.length,
      hint: "Camps named by one nano call that only reads the answers; it never sees the question's expected side.",
    });
  } catch (error) {
    $("split-hint").textContent = `Judge failed: ${error.message}`;
  } finally {
    $("judge").disabled = false;
  }
}

function openConnect(message) {
  const dialog = $("connect");
  if (message) $("connect-msg").textContent = message;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function syncPill() {
  const pill = $("pollen-pill");
  pill.textContent = pollen.connected() ? "Pollen connected" : "Connect Pollen";
  pill.classList.toggle("on", pollen.connected());
}

async function connectDevice() {
  $("connect-msg").textContent = "";
  if (pollTimer) clearInterval(pollTimer);
  $("device").disabled = true;
  try {
    const { userCode, verify } = await pollen.startDevice();
    const box = $("device-code");
    box.hidden = false;
    box.replaceChildren();
    box.append(el("span", "code-label", "Enter this code at the sign-in page:"), el("strong", "code-value", userCode));
    const link = el("a", "ghost wide", "Open the sign-in page");
    link.href = verify;
    link.target = "_blank";
    link.rel = "noopener";
    box.append(link);
    $("connect-msg").textContent = "Waiting for you to approve…";
    pollTimer = setInterval(async () => {
      const result = await pollen.pollDevice();
      if (result.state === "connected") {
        clearInterval(pollTimer);
        pollTimer = null;
        $("connect-msg").textContent = "Connected. This tab can spend your Pollen now.";
        syncPill();
        setTimeout(() => $("connect").close(), 1200);
      } else if (result.state === "expired" || result.state === "error") {
        clearInterval(pollTimer);
        pollTimer = null;
        $("connect-msg").textContent = result.message || "The code expired. Try again.";
      }
    }, 4000);
  } catch (error) {
    $("connect-msg").textContent = `Could not start sign-in: ${error.message}`;
  } finally {
    $("device").disabled = false;
  }
}

function useKey() {
  try {
    pollen.useKey($("sk").value);
    $("connect-msg").textContent = "Key accepted for this tab.";
    syncPill();
  } catch (error) {
    $("connect-msg").textContent = error.message;
  }
}

function share() {
  const params = new URLSearchParams({ q: $("question").value.trim() });
  params.set("m", [...state.selected].join(","));
  const url = `${location.origin}${location.pathname}#${params}`;
  navigator.clipboard?.writeText(url);
  $("hint").textContent = "Link copied. It carries the question and the models, not the answers.";
}

function fromHash() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const q = params.get("q");
  if (q) $("question").value = q;
  const m = params.get("m");
  if (m) {
    const ids = m.split(",").filter((id) => DEFAULT_MODELS.some(([known]) => known === id));
    if (ids.length >= 2) {
      state.selected = new Set(ids);
      renderModels();
    }
  }
}

function loadPricing() {
  pollen
    .models()
    .then((list) => {
      for (const model of list) {
        if (model?.name && model.pricing) state.pricing.set(model.name, model.pricing);
      }
    })
    .catch(() => {
      /* pricing is a nicety; the app still works without it */
    });
}

function init() {
  renderModels();
  renderPresets();
  fromHash();
  syncPill();
  loadPricing();
  $("run").addEventListener("click", run);
  $("judge").addEventListener("click", judge);
  $("share").addEventListener("click", share);
  $("pollen-pill").addEventListener("click", () => openConnect());
  $("device").addEventListener("click", connectDevice);
  $("use-sk").addEventListener("click", useKey);
  $("close-connect").addEventListener("click", () => $("connect").close());
  $("question").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) run();
  });
}

init();
