#!/usr/bin/env node

// ============================================
// CRAFTREE — Invention Verifier
// ============================================
// Batch-verifies inventions (Supabase or local seed) using Claude API.
// Checks: classification, links coherence, factual accuracy.
// Flags issues for manual review — never modifies data.
//
// Usage:
//   node scripts/verify-inventions.mjs --limit 50
//   node scripts/verify-inventions.mjs --limit 50 --category energy
//   node scripts/verify-inventions.mjs --seed --limit 20   # même graphe que src/data/seed-data.json
//   node scripts/verify-inventions.mjs --unverified-only --limit 100
//   node scripts/verify-inventions.mjs --id "acier,verre,beton"
//   node scripts/verify-inventions.mjs --dry-run --limit 10
//
// Flags:
//   --limit N           Number of inventions to verify (default: 50)
//   --category X        Only verify inventions in this category
//   --seed              Lire fiches + liens depuis seed-data.json (aligné app sans Supabase ou JSON local)
//   --unverified-only   Skip already-verified inventions
//   --id "a,b,c"        Verify specific inventions by ID
//   --dry-run           Preview what would be verified, don't call API
//   --fix               Auto-fix simple issues (missing fields only, never overwrites)
//
// Output:
//   Console report + saves to Supabase table `verification_logs` (sauf en --seed)
//
// Cost estimate: ~$0.01 per 10 inventions (Haiku)
// ============================================

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { CRAFTREE_SCOPE_FOR_LLM_EN } from "./craftree-prompt-scope.mjs";
import { readDB } from "./seed-helpers.mjs";
import {
  normalizeNodeRowFromSupabase,
  normalizeSeedNodeForVerify,
  getLinksFromSeed,
} from "./verify-node-normalize.mjs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import readline from "readline";

// --- Config ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-haiku-4-5-20251001";
const BATCH_SIZE = 10;

// --- CLI args ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const LIMIT = parseInt(getArg("limit") || "50");
const CATEGORY = getArg("category");
const IDS = getArg("id")?.split(",").map((s) => s.trim());
const UNVERIFIED_ONLY = hasFlag("unverified-only");
const DRY_RUN = hasFlag("dry-run");
const AUTO_FIX = hasFlag("fix");
const USE_SEED = hasFlag("seed");

/** Cache seed pour --seed (évite de relire le fichier à chaque lien). */
let cachedSeedData = null;
function getCachedSeedData() {
  if (!cachedSeedData) cachedSeedData = readDB();
  return cachedSeedData;
}

// ============================================
// 1. FETCH INVENTIONS TO VERIFY
// ============================================

async function fetchVerifiedIdsForFilter() {
  const verifiedIds = [];
  if (!UNVERIFIED_ONLY || IDS) return verifiedIds;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn(
      "  ⚠️  --unverified-only : NEXT_PUBLIC_SUPABASE_URL absent — filtre verification_logs ignoré."
    );
    return verifiedIds;
  }
  const { data: logs, error: logErr } = await supabase
    .from("verification_logs")
    .select("invention_id");
  if (logErr) {
    console.warn(
      `  ⚠️  verification_logs: ${logErr.message} — all rows treated as unverified.`
    );
    return verifiedIds;
  }
  return (logs || [])
    .map((r) => r.invention_id)
    .filter((id) => id != null && id !== "");
}

async function getInventionsToVerify() {
  const verifiedIds = await fetchVerifiedIdsForFilter();

  if (USE_SEED) {
    const seedData = getCachedSeedData();
    let list = (seedData.nodes || []).filter(
      (n) => n.name_en != null && String(n.name_en).trim() !== ""
    );
    list = list.map((n) => normalizeSeedNodeForVerify(n));
    if (IDS?.length) {
      const wanted = new Set(IDS);
      list = list.filter((n) => wanted.has(n.id));
    } else {
      if (CATEGORY) {
        list = list.filter((n) => n.category === CATEGORY);
      }
      if (UNVERIFIED_ONLY && verifiedIds.length > 0) {
        const skip = new Set(verifiedIds);
        list = list.filter((n) => !skip.has(n.id));
      }
      list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      list = list.slice(0, LIMIT);
    }
    return list;
  }

  let query = supabase
    .from("nodes")
    .select("*")
    .not("name_en", "is", null);

  if (IDS) {
    query = query.in("id", IDS);
  } else {
    if (CATEGORY) {
      query = query.eq("category", CATEGORY);
    }
    if (UNVERIFIED_ONLY && verifiedIds.length > 0) {
      query = query.not("id", "in", `(${verifiedIds.join(",")})`);
    }
    query = query.limit(LIMIT);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => normalizeNodeRowFromSupabase(row));
}

async function resolveLinksForInvention(inventionId) {
  if (USE_SEED) {
    return getLinksFromSeed(inventionId, getCachedSeedData());
  }
  return getLinksForInvention(inventionId);
}

async function getLinksForInvention(inventionId) {
  // Get built_upon (what this invention needs) — DB columns are snake_case
  const { data: builtUpon } = await supabase
    .from("links")
    .select(
      "source_id, nodes!links_source_id_fkey(id, name_en, dimension, material_level)"
    )
    .eq("target_id", inventionId);

  // Get led_to (what this invention enables)
  const { data: ledTo } = await supabase
    .from("links")
    .select(
      "target_id, nodes!links_target_id_fkey(id, name_en, dimension, material_level)"
    )
    .eq("source_id", inventionId);

  const mapNode = (l, key) => {
    const raw = l[key];
    if (!raw) {
      return {
        id: null,
        name: "(unknown node)",
        dimension: null,
        material_level: null,
      };
    }
    const n = normalizeNodeRowFromSupabase(raw);
    return {
      id: n.id,
      name: n.name_en,
      dimension: n.dimension,
      material_level: n.material_level,
    };
  };

  return {
    builtUpon: (builtUpon || []).map((l) =>
      mapNode(l, "nodes")
    ),
    ledTo: (ledTo || []).map((l) => mapNode(l, "nodes")),
  };
}

// ============================================
// 2. VERIFICATION PROMPT
// ============================================

function formatMaterialLevelForPrompt(inv) {
  const v = inv.material_level ?? inv.materialLevel;
  if (v != null && v !== "") return String(v);
  if (inv.dimension === "matter") {
    return "MISSING (matter rows must set material_level to raw|processed|industrial|component)";
  }
  return "null (required for process/tool; DB stores null when dimension is not matter)";
}

function formatTagsForPrompt(inv) {
  const t = inv.tags;
  if (Array.isArray(t) && t.length > 0) return JSON.stringify(t);
  return "none";
}

function formatLinkRow(l) {
  const dim = l.dimension ?? "?";
  const ml =
    l.material_level != null && l.material_level !== ""
      ? l.material_level
      : "null";
  return `  - ${l.name} (${dim} / material_level=${ml})`;
}

/** One-line preview in CLI (examples list). */
function formatMaterialLevelShort(inv) {
  const v = inv.material_level ?? inv.materialLevel;
  if (v != null && v !== "") return v;
  if (inv.dimension === "matter") return "?";
  return "null";
}

function buildVerificationPrompt(invention, links) {
  return `You are a quality auditor for Craftree, a technology tree database that models inventions as fabrication recipes.

${CRAFTREE_SCOPE_FOR_LLM_EN}

Review this invention card and identify any issues. Be strict but fair about field quality, descriptions, and link coherence — not about whether the topic is "only" a natural resource or a broad discovery: those belong in Craftree when they play a role in the graph.

INVENTION:
- ID: ${invention.id}
- Name (EN): ${invention.name_en}
- Name (FR): ${invention.name}
- Description (EN): ${invention.description_en || "MISSING"}
- Description (FR): ${invention.description || "MISSING"}
- Dimension: ${invention.dimension || "MISSING"} (should be: matter, process, or tool)
- Material level: ${formatMaterialLevelForPrompt(invention)}
- Category (single enum): ${invention.category ?? "MISSING"}
- Tags (search keywords): ${formatTagsForPrompt(invention)}
- Year: ${invention.year_approx ?? "MISSING"}
- Origin: ${invention.origin || "MISSING"}
- Wikipedia: ${invention.wikipedia_url || "MISSING"}
- Image: ${invention.image_url ? "present" : "MISSING"}

LINKS — Built upon (inputs needed to make this):
${links.builtUpon.length > 0 ? links.builtUpon.map(formatLinkRow).join("\n") : "  NONE"}

LINKS — Led to (what this invention enables):
${links.ledTo.length > 0 ? links.ledTo.map(formatLinkRow).join("\n") : "  NONE"}

CHECK EACH OF THESE:

1. CLASSIFICATION: Is the dimension correct? A matter is something physical that gets consumed/transformed. A process is a technique (not an object). A tool is a reusable object.
   material_level applies only when dimension is matter (raw / processed / industrial / component). For process or tool, material_level must be null in the database.

2. LINKS COHERENCE:
   - Are the "built upon" links realistic? Does this invention actually need these inputs?
   - Are there obvious MISSING inputs? (e.g., Steel should need Iron ore + Carbon/Coal + a Furnace)
   - Are any links WRONG? (inputs that don't make sense)
   - Are the "led to" links reasonable?
   - Is this invention an orphan (no links at all)?

3. FACTUAL ACCURACY:
   - Is the description factually correct?
   - Is the year approximately right?
   - Is the origin (inventor/country) correct?

4. COMPLETENESS:
   - Are any critical fields missing for this node's role (matter / process / tool)?
   - Distinguish "too niche for Craftree" from "foundational natural resource or process that enables many links": the latter is valid by design.

5. DUPLICATES: Could this be a duplicate or variant of another common invention? (e.g., "Stainless steel" when "Steel" already exists)

Use status "should_delete" only for clear duplicates or cards that are truly incoherent in the recipe graph — not because the subject is water, fire, ores, or another natural / foundational node that Craftree intentionally models.

Respond ONLY with valid JSON:
{
  "score": 0-10,
  "status": "ok" | "needs_review" | "needs_fix" | "should_delete",
  "issues": [
    {
      "type": "classification" | "missing_link" | "wrong_link" | "factual" | "missing_field" | "too_niche" | "duplicate",
      "severity": "low" | "medium" | "high",
      "field": "field_name or null",
      "message": "Brief description of the issue",
      "suggested_fix": "What should be changed (or null)"
    }
  ],
  "missing_inputs": ["list of inventions that should be in built_upon but aren't"],
  "wrong_inputs": ["list of current built_upon links that seem wrong"],
  "summary": "One sentence summary of this card's quality"
}

If everything looks good, return score 8-10, status "ok", and empty issues array.
Be concise. No explanations outside the JSON.`;
}

// ============================================
// 3. RUN VERIFICATION
// ============================================

const CARD_LINE = "  " + "─".repeat(58);

/** Coupe un texte long pour le terminal (largeur ~76 car. de contenu). */
function wrapForTerminal(text, firstIndent, contIndent, maxWidth = 76) {
  if (text == null || text === "") return "";
  const s = String(text).replace(/\s+/g, " ").trim();
  if (s.length <= maxWidth) return s;
  const words = s.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join(`\n${contIndent}`);
}

function statusEmoji(status) {
  if (status === "ok") return "✅";
  if (status === "needs_review") return "🔍";
  if (status === "needs_fix") return "🔧";
  if (status === "should_delete") return "🗑️";
  return "⚠️";
}

async function verifyBatch(inventions) {
  const results = [];

  for (const inv of inventions) {
    try {
      const links = await resolveLinksForInvention(inv.id);
      const prompt = buildVerificationPrompt(inv, links);

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.log("");
        console.log(CARD_LINE);
        console.log(`  ⚠️  ${inv.name_en}`);
        console.log(`     🆔 ${inv.id}`);
        console.log("     Pas de JSON valide dans la réponse du modèle.");
        results.push({
          invention_id: inv.id,
          name: inv.name_en,
          score: null,
          status: "error",
          issues: [{ message: "Failed to parse verification response" }],
          raw_response: text,
        });
        continue;
      }

      let verification;
      try {
        verification = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        console.log("");
        console.log(CARD_LINE);
        console.log(`  ⚠️  ${inv.name_en}  ·  JSON invalide`);
        console.log(`     🆔 ${inv.id}`);
        console.log(
          `     ${wrapForTerminal(parseErr.message, "", "     ", 72)}`
        );
        results.push({
          invention_id: inv.id,
          name: inv.name_en,
          score: null,
          status: "error",
          issues: [{ message: parseErr.message }],
        });
        continue;
      }

      results.push({
        invention_id: inv.id,
        name: inv.name_en,
        ...verification,
      });

      const stEmoji = statusEmoji(verification.status);
      const summaryRaw = verification.summary || verification.status || "";
      const summaryText = wrapForTerminal(summaryRaw, "", "     ", 72);

      console.log("");
      console.log(CARD_LINE);
      console.log(`  📌 ${inv.name_en}`);
      console.log(`     🆔 ${inv.id}`);
      console.log(`     ${stEmoji}  Note ${verification.score ?? "?"}/10`);
      if (summaryText) {
        const sumLines = summaryText.split("\n");
        console.log(`     📝  ${sumLines[0]}`);
        for (let si = 1; si < sumLines.length; si++) {
          console.log(`         ${sumLines[si]}`);
        }
      }

      if (verification.issues?.length > 0) {
        console.log("");
        console.log(
          `     📋 ${verification.issues.length} point(s) :`
        );
        for (const issue of verification.issues) {
          const sev =
            issue.severity === "high"
              ? "🔴"
              : issue.severity === "medium"
                ? "🟡"
                : "⚪";
          const msg = wrapForTerminal(
            issue.message || "",
            "",
            "        ",
            70
          );
          console.log(
            `        ${sev} [${issue.type ?? "?"}] ${msg.split("\n").join("\n        ")}`
          );
          if (issue.suggested_fix) {
            const fix = wrapForTerminal(
              issue.suggested_fix,
              "",
              "           ",
              68
            );
            console.log(`           💡 ${fix.split("\n").join("\n           ")}`);
          }
        }
      }
      console.log("");
    } catch (err) {
      console.log("");
      console.log(CARD_LINE);
      console.log(`  ❌ ${inv.name_en}`);
      console.log(`     🆔 ${inv.id}`);
      console.log(
        `     ${wrapForTerminal(err.message, "", "     ", 72)}`
      );
      console.log("");
      results.push({
        invention_id: inv.id,
        name: inv.name_en,
        score: null,
        status: "error",
        issues: [{ message: err.message }],
      });
    }
  }

  return results;
}

// ============================================
// 4. SAVE RESULTS
// ============================================

async function ensureVerificationTable() {
  // Try to create the table if it doesn't exist
  // This will silently fail if it already exists
  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS verification_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        invention_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
        score INTEGER,
        status TEXT,
        issues JSONB,
        missing_inputs TEXT[],
        wrong_inputs TEXT[],
        summary TEXT,
        verified_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_logs(status);
      CREATE INDEX IF NOT EXISTS idx_verification_invention ON verification_logs(invention_id);
    `,
  });

  // If RPC doesn't exist, that's fine — the table might already exist
  if (error && !error.message.includes("already exists")) {
    console.log(
      "  ℹ️  Could not auto-create verification_logs table."
    );
    console.log(
      "     Run the SQL from verify-setup.sql in Supabase SQL Editor."
    );
  }
}

async function saveResults(results) {
  if (DRY_RUN) return;
  if (USE_SEED) {
    console.log("");
    console.log("  ℹ️  Mode --seed : aucune écriture dans `verification_logs` (console uniquement).");
    console.log("");
    return;
  }

  const rows = results
    .filter((r) => r.status !== "error")
    .map((r) => ({
      invention_id: r.invention_id,
      score: r.score,
      status: r.status,
      issues: r.issues || [],
      missing_inputs: r.missing_inputs || [],
      wrong_inputs: r.wrong_inputs || [],
      summary: r.summary || null,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("verification_logs")
    .upsert(rows, { onConflict: "invention_id" });

  if (error) {
    console.log("");
    console.log(`  ⚠️  Sauvegarde Supabase impossible : ${error.message}`);
    console.log("     Les résultats restent affichés ci-dessus.");
    console.log("");
  } else {
    console.log("");
    console.log(`  💾  ${rows.length} résultat(s) enregistré(s) dans Supabase.`);
    console.log("");
  }
}

// ============================================
// 5. REPORT
// ============================================

function printReport(results) {
  const R = "═".repeat(56);
  console.log("\n");
  console.log(R);
  console.log("  📊  RAPPORT DE VÉRIFICATION");
  console.log(R);

  const total = results.length;
  const ok = results.filter((r) => r.status === "ok").length;
  const review = results.filter((r) => r.status === "needs_review").length;
  const fix = results.filter((r) => r.status === "needs_fix").length;
  const del = results.filter((r) => r.status === "should_delete").length;
  const err = results.filter((r) => r.status === "error").length;
  const avgScore =
    results
      .filter((r) => r.score !== null)
      .reduce((sum, r) => sum + r.score, 0) /
    (results.filter((r) => r.score !== null).length || 1);

  console.log("");
  console.log("  📈  Synthèse");
  console.log("  " + "─".repeat(40));
  console.log(`     Fiches analysées     : ${total}`);
  console.log(`     Note moyenne         : ${avgScore.toFixed(1)} / 10`);
  console.log("");
  console.log(`     ✅ OK                 : ${ok}`);
  console.log(`     🔍 À relire            : ${review}`);
  console.log(`     🔧 À corriger          : ${fix}`);
  console.log(`     🗑️  Suppression suggérée : ${del}`);
  if (err > 0) {
    console.log(`     ⚠️  Erreurs (parse/API) : ${err}`);
  }

  // Most common issue types
  const issueTypes = {};
  for (const r of results) {
    for (const issue of r.issues || []) {
      const t = issue.type || "undefined";
      issueTypes[t] = (issueTypes[t] || 0) + 1;
    }
  }

  if (Object.keys(issueTypes).length > 0) {
    console.log("");
    console.log("  🏷️  Types de problèmes les plus fréquents");
    console.log("  " + "─".repeat(40));
    const sorted = Object.entries(issueTypes).sort((a, b) => b[1] - a[1]);
    for (const [type, count] of sorted) {
      console.log(`     · ${type}  →  ${count}`);
    }
  }

  // High severity issues
  const highSev = results.filter((r) =>
    (r.issues || []).some((i) => i.severity === "high")
  );
  if (highSev.length > 0) {
    console.log("");
    console.log("  🔴  Priorité — gravité haute");
    console.log("  " + "─".repeat(40));
    for (const r of highSev) {
      const highIssues = r.issues.filter((i) => i.severity === "high");
      for (const issue of highIssues) {
        console.log("");
        console.log(`     📌 ${r.name}`);
        const msg = wrapForTerminal(issue.message || "", "", "        ", 68);
        console.log(`        ${msg.split("\n").join("\n        ")}`);
        if (issue.suggested_fix) {
          const fixTxt = wrapForTerminal(
            issue.suggested_fix,
            "",
            "           ",
            64
          );
          console.log(`        💡 ${fixTxt.split("\n").join("\n           ")}`);
        }
      }
    }
  }

  // Inventions to delete
  if (del > 0) {
    console.log("");
    console.log("  🗑️  Fiches candidates à suppression");
    console.log("  " + "─".repeat(40));
    for (const r of results.filter((r) => r.status === "should_delete")) {
      const sum = wrapForTerminal(r.summary || "", "", "     ", 68);
      console.log(`     · ${r.name}`);
      console.log(`       ${sum.split("\n").join("\n       ")}`);
      console.log("");
    }
  }

  // Missing inputs across all inventions
  const allMissing = results
    .filter((r) => r.missing_inputs?.length > 0)
    .flatMap((r) =>
      r.missing_inputs.map((m) => ({ invention: r.name, missing: m }))
    );

  if (allMissing.length > 0) {
    console.log("");
    console.log("  📦  Entrées manquantes (idées de nœuds à ajouter)");
    console.log("  " + "─".repeat(40));
    const missingCounts = {};
    for (const m of allMissing) {
      missingCounts[m.missing] = (missingCounts[m.missing] || 0) + 1;
    }
    const sortedMissing = Object.entries(missingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    for (const [name, count] of sortedMissing) {
      console.log(
        `     · ${name}  (${count} fiche${count > 1 ? "s" : ""})`
      );
    }

    const topMissing = sortedMissing
      .slice(0, 10)
      .map(([name]) => name)
      .join(",");
    console.log("");
    console.log("  💡  Commande suggérée :");
    console.log(`     npm run add -- --name "${topMissing}"`);
  }

  console.log("\n" + R + "\n");
}

// ============================================
// 6. CONFIRMATION + MAIN
// ============================================

function confirm(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(message + " (y/n) ", (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

async function main() {
  console.log("🔍 Craftree Invention Verifier");
  console.log("━".repeat(50));
  if (USE_SEED) {
    console.log(
      "📁 Source : src/data/seed-data.json (graphe local — aligné sur l’app sans Supabase)"
    );
  } else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url) {
      try {
        console.log(`🗄️  Source : Supabase → ${new URL(url).hostname}`);
      } catch {
        console.log("🗄️  Source : Supabase");
      }
    } else {
      console.warn(
        "⚠️  NEXT_PUBLIC_SUPABASE_URL manquant. Lancez avec --seed pour vérifier le JSON local, ou configurez .env.local."
      );
    }
  }

  // Fetch inventions
  const inventions = await getInventionsToVerify();

  if (inventions.length === 0) {
    console.log("No inventions to verify with the given filters.");
    process.exit(0);
  }

  // Calculate cost
  const batches = Math.ceil(inventions.length / BATCH_SIZE);
  const estimatedCost = inventions.length * 0.001;

  console.log(`
╔══════════════════════════════════════════╗
║         VÉRIFICATION DES FICHES         ║
╚══════════════════════════════════════════╝

📋 Inventions à vérifier : ${inventions.length}
📦 Lots de ${BATCH_SIZE} → ${batches} appels Claude (Haiku)
💰 Coût estimé : ~$${estimatedCost.toFixed(3)}
⏱️  Durée estimée : ~${Math.ceil(inventions.length / 10)} min
${CATEGORY ? `🏷️  Catégorie : ${CATEGORY}` : ""}
${USE_SEED ? "📁 Mode --seed (fiches + liens = seed-data.json)" : ""}
${UNVERIFIED_ONLY ? "✨ Uniquement les non-vérifiées" : ""}
${DRY_RUN ? "🔍 DRY RUN — aperçu uniquement" : ""}

Exemples d'inventions :
${inventions
  .slice(0, 5)
  .map(
    (i) =>
      `  - ${i.name_en} (${i.dimension || "?"} / ${formatMaterialLevelShort(i)})`
  )
  .join("\n")}
${inventions.length > 5 ? `  ... et ${inventions.length - 5} autres` : ""}
`);

  if (DRY_RUN) {
    console.log("🔍 Dry run — listing all inventions that would be verified:");
    for (const inv of inventions) {
      console.log(`  - ${inv.id}: ${inv.name_en}`);
    }
    process.exit(0);
  }

  const ok = await confirm("Continuer ?");
  if (!ok) {
    console.log("❌ Annulé.");
    process.exit(0);
  }

  // Process in batches
  const allResults = [];
  for (let i = 0; i < inventions.length; i += BATCH_SIZE) {
    const batch = inventions.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log("");
    console.log("  " + "═".repeat(56));
    console.log(
      `  📦  Lot ${batchNum} / ${batches}  ·  ${batch.length} fiche(s)`
    );
    console.log("  " + "═".repeat(56));

    const results = await verifyBatch(batch);
    allResults.push(...results);

    // Brief pause between batches to avoid rate limiting
    if (i + BATCH_SIZE < inventions.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Save results
  await saveResults(allResults);

  // Print report
  printReport(allResults);

  const actualCost = allResults.filter((r) => r.status !== "error").length * 0.001;
  console.log(`  💰  Coût estimé API : ~$${actualCost.toFixed(3)}`);
  console.log("");
  console.log("  ✨  Terminé.");
  console.log("");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
