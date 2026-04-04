#!/usr/bin/env node
/**
 * Audit Supabase — statistiques, couverture, qualité, chaînes, inventions de référence.
 *
 * Usage : node scripts/audit-db.mjs
 * Env    : .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *
 * Sortie : console (ANSI) + scripts/audit-report.json
 *
 * Métriques (aligné UI Craftree) :
 * - Badge sur les cartes / fiche = nombre de liens entrants (target_id = ce nœud),
 *   i.e. entrées « built upon » / amont direct. Ce n’est pas complexity_depth.
 * - complexity_depth = champ base, profondeur de graphe stockée (éditeur, scripts de sélection).
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env"), quiet: true });
dotenv.config({ path: join(root, ".env.local"), override: true, quiet: true });

const OUT_JSON = join(dirname(fileURLToPath(import.meta.url)), "audit-report.json");

/** ANSI (sans dépendance chalk) */
const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function logSection(title) {
  console.log(
    `\n${ansi.bold}${ansi.cyan}━━ ${title} ━━${ansi.reset}\n`
  );
}

function logLine(label, value, opts = {}) {
  const { warn = false, ok = false } = opts;
  const color = warn ? ansi.yellow : ok ? ansi.green : "";
  console.log(
    `  ${ansi.dim}${label}:${ansi.reset} ${color}${value}${ansi.reset}`
  );
}

/**
 * Inventions de référence attendues (name_en, insensible à la casse).
 * Éditer cette liste selon les besoins du projet.
 */
const ESSENTIAL_INVENTIONS_NAME_EN = [
  "Electricity",
  "Steel",
  "Semiconductor",
  "Internet",
  "Wheel",
  "Printing press",
  "Steam engine",
  "Penicillin",
  "Concrete",
  "Glass",
  "Paper",
  "Iron",
  "Plastic",
  "Computer",
  "Telephone",
  "Vaccination",
  "Railway",
  "Airplane",
  "Battery",
  "Solar cell",
  "Nuclear power",
  "Fiber optic",
  "Agriculture",
  "Bronze",
  "Antibiotics",
];

const DIMENSIONS = ["matter", "process", "tool"];
const MATERIAL_LEVELS = ["raw", "processed", "industrial", "component"];
const UNDERREP_THRESHOLD = 10;

function normNameEn(s) {
  return (s ?? "").trim().toLowerCase();
}

async function fetchAllRows(supabase, table, columns) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function linkCounts(nodeId, links) {
  let inc = 0;
  let out = 0;
  for (const l of links) {
    if (l.target_id === nodeId) inc += 1;
    if (l.source_id === nodeId) out += 1;
  }
  return { in: inc, out: out };
}

function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      `${ansi.red}Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY${ansi.reset}`
    );
    process.exit(1);
  }
  return runAudit(createClient(url, key));
}

async function runAudit(supabase) {
  console.log(
    `${ansi.bold}Craftree — audit base de données${ansi.reset} ${ansi.dim}(Supabase)${ansi.reset}\n`
  );
  console.log(
    `  ${ansi.dim}Référence : le badge du site = nombre de liens entrants (built upon).` +
      ` complexity_depth = autre métrique (profondeur en base).${ansi.reset}\n`
  );

  const [nodes, links] = await Promise.all([
    fetchAllRows(
      supabase,
      "nodes",
      "id,name,name_en,category,dimension,material_level,image_url,description_en,year_approx,wikipedia_url"
    ),
    fetchAllRows(supabase, "links", "source_id,target_id"),
  ]);

  const totalInventions = nodes.length;
  const totalLinks = links.length;

  const byDimension = Object.fromEntries(DIMENSIONS.map((d) => [d, 0]));
  byDimension.unset = 0;
  for (const n of nodes) {
    const d = n.dimension;
    if (d && byDimension[d] !== undefined) byDimension[d] += 1;
    else byDimension.unset += 1;
  }

  const byMaterialLevel = Object.fromEntries(
    MATERIAL_LEVELS.map((m) => [m, 0])
  );
  byMaterialLevel.unset = 0;
  for (const n of nodes) {
    const m = n.material_level;
    if (m && byMaterialLevel[m] !== undefined) byMaterialLevel[m] += 1;
    else byMaterialLevel.unset += 1;
  }

  const byCategory = new Map();
  for (const n of nodes) {
    const c = n.category ?? "unknown";
    byCategory.set(c, (byCategory.get(c) ?? 0) + 1);
  }

  const categoryCoverage = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      underrepresented: count < UNDERREP_THRESHOLD,
    }));

  const noImage = nodes.filter((n) => !n.image_url?.trim());
  const noDescriptionEn = nodes.filter((n) => !n.description_en?.trim());
  const noYearApprox = nodes.filter(
    (n) => n.year_approx === null || n.year_approx === undefined
  );
  const noWikipedia = nodes.filter((n) => !n.wikipedia_url?.trim());

  const orphans = [];
  for (const n of nodes) {
    const { in: inc, out: outc } = linkCounts(n.id, links);
    if (inc === 0 && outc === 0) orphans.push(n);
  }

  const nameEnPresent = new Set();
  for (const n of nodes) {
    const k = normNameEn(n.name_en);
    if (k) nameEnPresent.add(k);
  }

  const missingEssentials = ESSENTIAL_INVENTIONS_NAME_EN.filter(
    (label) => !nameEnPresent.has(normNameEn(label))
  );

  const incompleteFinalProducts = [];
  const deadRawMaterials = [];

  for (const n of nodes) {
    const { in: inc, out: outc } = linkCounts(n.id, links);
    const ml = n.material_level;

    if (ml === "raw" && outc === 0) {
      deadRawMaterials.push({
        id: n.id,
        name: n.name,
        name_en: n.name_en ?? null,
      });
    }

    if (inc === 0 && ml !== "raw") {
      const isFinalProduct = ml === "component" || outc === 0;
      if (isFinalProduct) {
        incompleteFinalProducts.push({
          id: n.id,
          name: n.name,
          name_en: n.name_en ?? null,
          dimension: n.dimension ?? null,
          material_level: ml ?? null,
        });
      }
    }
  }

  const underrepCats = categoryCoverage.filter((c) => c.underrepresented);
  const worstCat =
    underrepCats.length > 0
      ? underrepCats.reduce((a, b) => (a.count <= b.count ? a : b))
      : null;
  const addCount = worstCat
    ? Math.max(UNDERREP_THRESHOLD - worstCat.count, 1)
    : 5;

  const idsNeedingEnrich = new Set([
    ...noDescriptionEn.map((n) => n.id),
    ...noImage.map((n) => n.id),
  ]);
  const enrichLimit = Math.min(Math.max(idsNeedingEnrich.size, 5), 80);

  const report = {
    generatedAt: new Date().toISOString(),
    metricsNote: {
      uiBadge:
        "Explore card badge = count of links with target_id = this node (direct upstream / built upon).",
      complexity_depth:
        "DB field: stored graph depth; used for editor sort and scripts; not the same as the badge count.",
    },
    global: {
      totalInventions,
      totalLinks,
      byDimension,
      byMaterialLevel,
    },
    categoryCoverage,
    qualityIssues: {
      noImage: { count: noImage.length, sampleIds: noImage.slice(0, 30).map((n) => n.id) },
      noDescriptionEn: {
        count: noDescriptionEn.length,
        sampleIds: noDescriptionEn.slice(0, 30).map((n) => n.id),
      },
      orphanNodes: {
        count: orphans.length,
        sampleIds: orphans.slice(0, 30).map((n) => n.id),
      },
      noYearApprox: {
        count: noYearApprox.length,
        sampleIds: noYearApprox.slice(0, 30).map((n) => n.id),
      },
      noWikipediaUrl: {
        count: noWikipedia.length,
        sampleIds: noWikipedia.slice(0, 30).map((n) => n.id),
      },
    },
    brokenChains: {
      incompleteFinalProducts: incompleteFinalProducts.slice(0, 200),
      deadRawMaterials: deadRawMaterials.slice(0, 200),
      counts: {
        incompleteFinalProducts: incompleteFinalProducts.length,
        deadRawMaterials: deadRawMaterials.length,
      },
    },
    missingEssentials: missingEssentials.map((name_en) => ({ name_en })),
    recommendations: {
      addCommand: worstCat
        ? `npm run add -- --category ${worstCat.category} --count ${addCount}`
        : `npm run add -- --count 5`,
      enrichCommand: `npm run enrich -- --limit ${enrichLimit}`,
      fixImagesCommand: "npm run fix:images",
    },
  };

  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");

  logSection("1. STATISTIQUES GLOBALES");
  logLine("Inventions (total)", String(totalInventions), { ok: true });
  logLine("Liens (total)", String(totalLinks), { ok: true });
  console.log(`  ${ansi.dim}Par dimension :${ansi.reset}`);
  for (const d of [...DIMENSIONS, "unset"]) {
    logLine(`  • ${d}`, String(byDimension[d] ?? 0));
  }
  console.log(`  ${ansi.dim}Par material_level :${ansi.reset}`);
  for (const m of [...MATERIAL_LEVELS, "unset"]) {
    logLine(`  • ${m}`, String(byMaterialLevel[m] ?? 0));
  }

  logSection("2. COUVERTURE PAR CATÉGORIE");
  for (const row of categoryCoverage) {
    const tag = row.underrepresented
      ? `${ansi.yellow}[sous-représentée < ${UNDERREP_THRESHOLD}]${ansi.reset}`
      : `${ansi.green}OK${ansi.reset}`;
    console.log(
      `  ${row.category.padEnd(22)} ${String(row.count).padStart(5)}  ${tag}`
    );
  }

  logSection("3. PROBLÈMES DE QUALITÉ");
  logLine("Sans image (image_url vide)", String(noImage.length), {
    warn: noImage.length > 0,
  });
  logLine("Sans description_en", String(noDescriptionEn.length), {
    warn: noDescriptionEn.length > 0,
  });
  logLine("Orphelines (aucun lien entrant ni sortant)", String(orphans.length), {
    warn: orphans.length > 0,
  });
  logLine("Sans year_approx", String(noYearApprox.length), {
    warn: noYearApprox.length > 0,
  });
  logLine("Sans wikipedia_url", String(noWikipedia.length), {
    warn: noWikipedia.length > 0,
  });

  logSection("4. CHAÎNES CASSÉES");
  logLine(
    "Produits finaux sans entrée amont (0 lien entrant = badge 0 sur le site)",
    `${incompleteFinalProducts.length} (composant ou sans sortie, hors matière brute)`,
    { warn: incompleteFinalProducts.length > 0 }
  );
  if (incompleteFinalProducts.length && incompleteFinalProducts.length <= 15) {
    for (const r of incompleteFinalProducts) {
      console.log(
        `    ${ansi.dim}${r.id}${ansi.reset} — ${r.name}${r.name_en ? ` / ${r.name_en}` : ""}`
      );
    }
  } else if (incompleteFinalProducts.length) {
    console.log(
      `    ${ansi.dim}(voir audit-report.json, max 200 entrées)${ansi.reset}`
    );
  }
  logLine(
    'Matières premières (raw) sans "led_to" (aucun lien sortant)',
    String(deadRawMaterials.length),
    { warn: deadRawMaterials.length > 0 }
  );
  if (deadRawMaterials.length && deadRawMaterials.length <= 15) {
    for (const r of deadRawMaterials) {
      console.log(
        `    ${ansi.dim}${r.id}${ansi.reset} — ${r.name}${r.name_en ? ` / ${r.name_en}` : ""}`
      );
    }
  } else if (deadRawMaterials.length) {
    console.log(
      `    ${ansi.dim}(voir audit-report.json, max 200 entrées)${ansi.reset}`
    );
  }

  logSection("5. INVENTIONS FONDAMENTALES MANQUANTES");
  if (missingEssentials.length === 0) {
    console.log(`  ${ansi.green}Toutes les entrées de la liste sont présentes (name_en).${ansi.reset}`);
  } else {
    console.log(
      `  ${ansi.yellow}${missingEssentials.length} manquante(s)${ansi.reset} (recherche par name_en, insensible à la casse) :`
    );
    for (const name of missingEssentials) {
      console.log(`    • ${ansi.bold}${name}${ansi.reset}`);
    }
  }

  logSection("6. RECOMMANDATIONS");
  console.log(`  ${ansi.green}${report.recommendations.addCommand}${ansi.reset}`);
  console.log(`  ${ansi.green}${report.recommendations.enrichCommand}${ansi.reset}`);
  console.log(`  ${ansi.green}${report.recommendations.fixImagesCommand}${ansi.reset}`);
  if (worstCat) {
    console.log(
      `  ${ansi.dim}(add : catégorie la plus faible parmi les sous-représentées)${ansi.reset}`
    );
  }

  console.log(
    `\n${ansi.dim}Rapport JSON : ${OUT_JSON}${ansi.reset}\n`
  );
}

main().catch((err) => {
  console.error(`${ansi.red}${err?.message ?? err}${ansi.reset}`);
  process.exit(1);
});
