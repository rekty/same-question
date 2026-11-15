// Blind-vote helpers. Pure functions only: the shuffle and the tally are the two
// pieces where a bug would quietly change the result, so they are testable
// without a browser or a network call.

// Fisher-Yates over a copy. `rand` is injectable so a test can pin the order.
export function shuffle(list, rand = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function letter(index) {
  return String.fromCharCode(65 + (index % 26));
}

// votes: a flat list of model ids, one entry per vote cast. Returns rows sorted
// by count, with ties broken by name so the order is stable between renders.
export function tally(votes) {
  const counts = new Map();
  for (const model of votes || []) counts.set(model, (counts.get(model) || 0) + 1);
  const total = (votes || []).length;
  const rows = [...counts.entries()]
    .map(([model, count]) => ({ model, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model));
  return { rows, total };
}

export function mergeVote(store, model) {
  const next = { ...(store || {}) };
  next[model] = (next[model] || 0) + 1;
  return next;
}

// The stored shape is { modelId: count }; the tally wants one id per vote.
export function votesFrom(store) {
  const out = [];
  for (const [model, count] of Object.entries(store || {})) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    for (let i = 0; i < n; i += 1) out.push(model);
  }
  return out;
}
