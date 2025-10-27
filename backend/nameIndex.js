// Lightweight name index helper — precomputes first-name counts for maleLead and femaleLead
// Exports:
//  init(movies) - build the index
//  getFirstNameCount(field, name) - return count (0 if none)

const index = {
  maleLead: new Map(),
  femaleLead: new Map(),
};

function normName(n) {
  return String(n || "").trim().split(/\s+/)[0].toLowerCase();
}

function init(movies) {
  index.maleLead.clear();
  index.femaleLead.clear();
  if (!Array.isArray(movies)) return;
  for (const m of movies) {
    if (!m) continue;
    const mName = m.maleLead ? normName(m.maleLead) : null;
    const fName = m.femaleLead ? normName(m.femaleLead) : null;
    if (mName) index.maleLead.set(mName, (index.maleLead.get(mName) || 0) + 1);
    if (fName) index.femaleLead.set(fName, (index.femaleLead.get(fName) || 0) + 1);
  }
}

function getFirstNameCount(field, name) {
  if (!field || !name) return 0;
  const key = String(name).trim().toLowerCase();
  if (field === 'maleLead') return index.maleLead.get(key) || 0;
  if (field === 'femaleLead') return index.femaleLead.get(key) || 0;
  return 0;
}

module.exports = { init, getFirstNameCount };
