# Submission form values — quest #19183

Paste these into
[the app submission form](https://github.com/pollinations/pollinations/issues/new?template=app-submission.yml).
The title becomes `[App Submission] Same Question` automatically.

| Field | Value |
|---|---|
| **App Name** | `Same Question` |
| **App Description** | `Ask OpenAI, Meta, DeepSeek, Mistral, xAI and NVIDIA the same question, then read all six answers side by side with each one's latency and real Pollen cost.` |
| **App URL** | `https://rekty.github.io/same-question/` |
| **GitHub Repository URL** | `https://github.com/rekty/same-question` |
| **Screenshot** | `assets/screenshot.png` (1920×1040, real run) |
| **App Category** | `chat` |
| **Platform** | `web` |
| **App Language** | `en` |
| **Discord Username** | *(optional — leave empty)* |
| **Quest** | `#19183` |

Description length: 153 characters (limit is 200). All six models re-checked on 2026-11-15:
`paid_only: false`, health `healthy`, still listed by `GET /models?type=text`.

## Pollinations integration (evidence)

If the form or a maintainer asks for a free-text evidence section, use this:

```
Static site only: index.html, app.js, style.css, shared/*.js. No backend, no
server-side secret, no database.

- Six labs, one prompt. DEFAULT_MODELS in app.js maps one model per lab:
  openai/gpt-5.4-nano, meta/muse-spark-open, deepseek/deepseek-v4.1-flash,
  mistralai/mistral-large-3, x-ai/grok-4.6, nvidia/nemotron-3.5-lightning — all free
  according to GET /models, so every chip runs on free Pollen.
  Any two to six can be toggled.
- Calls. Each card is one browser POST to
  https://gen.pollinations.ai/v1/chat/completions with a shared 90-word system
  prompt. There is no cache and no merged "consensus" answer.
- Payment. Every request carries the reader's own sk_ key (Bring your own
  Pollen). The key is kept in this tab's sessionStorage and sent only to
  gen.pollinations.ai; the owner never pays for a reader's run.
- Real cost shown. GET /models supplies per-token prices and each card prints
  the Pollen that answer actually cost, computed from the usage block the API
  returns. In the screenshot, six answers cost 0.07, 0.12, 2.39 … mPollen.
- Splitting. The "where they split" grouping is local (Jaccard over content
  words + union-find) and costs nothing; naming the camps is one optional
  gpt-5.4-nano call that sees only the answers.
- Shareable question. "Copy link" stores the question and chosen models in the
  URL hash; answers are never in the link because they cost the next reader
  their own Pollen.
- Credit. The page footer links to pollinations.ai, and the README carries the
  "Made with pollinations.ai" badge.
- Tests. `node --test` → 7/7 passing (grouping, verdict wording, judge labels).
```

## Verified before filling the form

- `https://rekty.github.io/same-question/` returns HTTP 200 and renders the
  question box, six lab toggles, "Ask all 6" and the credit footer.
- Real run on **2026-11-15** through the device flow (App Key
  `pk_TRM5Aq2QwxGsVj12`, Text only): 6/6 answered — OpenAI 0.6s · 0.07 mPollen,
  Meta 6.8s · 3.38 mPollen, DeepSeek 7.5s · 0.19 mPollen, Mistral 6.2s · 0.11
  mPollen, xAI 18.3s · 0.24 mPollen, NVIDIA 7.2s · 0.13 mPollen. Total under
  0.005 Pollen.
- Camp naming on the same run: 3 answers "not sandwich", 2 "yes sandwich",
  1 "commonly sandwich" — one judge call, labels only.
- `assets/screenshot.png` is that run, captured 2026-11-15 at 1920×1080.
- `node --test` in the repository: 7 pass, 0 fail.

## Checklist

- [x] App live and URL matches the live site
- [x] Screenshot is a real screen (16:9-ish, 1920×1040)
- [x] `Quest` field: `#19183`
- [x] README badge present
- [x] Visible pollinations.ai link in the page footer
