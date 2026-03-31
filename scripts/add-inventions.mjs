#!/usr/bin/env node
/**
 * Ajoute de nouvelles inventions (Haiku, sans web search).
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import {
  readDB,
  writeDB,
  slugify,
  sleep,
  cleanDescription,
  normalizeYearApprox,
  normalizeCategory,
  normalizeTechNodeType,
  normalizeEra,
  normalizeOriginNatureTypes,
  normalizeDimensionMaterialLevel,
  uniqueLinkId,
  idToPrettyName,
} from './seed-helpers.mjs';
import {
  createServiceSupabaseClient,
  upsertNodes,
  upsertLinks,
  updateNodeImageUrl,
} from './supabase-seed-sync.mjs';
import { fetchWikipediaImageUrl } from './wikimedia-fetch.mjs';

config({ path: '.env.local' });
config({ path: '.env' });

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 5;
const MAX_TOKENS = 8000;
const PAUSE_MS = 2000;

function parseArgs() {
  const argv = process.argv.slice(2);
  let count = null;
  let category = null;
  let nameArg = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count' && argv[i + 1]) {
      count = parseInt(argv[++i], 10);
    } else if (a === '--category' && argv[i + 1]) {
      category = argv[++i];
    } else if (a === '--name' && argv[i + 1]) {
      nameArg = argv[++i];
    }
  }
  return { count, category, nameArg };
}

function findOrphanIds(db) {
  const ids = new Set(db.nodes.map((n) => n.id));
  const orphans = new Set();
  for (const l of db.links) {
    if (!ids.has(l.source_id)) orphans.add(l.source_id);
    if (!ids.has(l.target_id)) orphans.add(l.target_id);
  }
  return [...orphans];
}

function buildSuggestPrompt(existingNamesJoined, count, categoryFilter) {
  return `Voici les inventions existantes dans Craftree : ${existingNamesJoined}

Suggère ${count} inventions fondamentales qui manquent et qui sont importantes pour compléter l'arbre technologique. ${
    categoryFilter
      ? `Concentre-toi sur les catégories : ${categoryFilter}. `
      : ''
}Réponds uniquement avec un JSON array de noms : ["Dynamite", "Radar", ...]`;
}

function buildCreatePrompt(batch, existingNodes) {
  const existingList = existingNodes
    .map((n) => `${n.name} (${n.id})`)
    .join(', ');
  const lines = batch.map((b) =>
    b.preferredId
      ? `- ${b.name} (id attendu : ${b.preferredId})`
      : `- ${b.name}`
  );
  return `Tu es un agent de création pour Craftree, un arbre technologique des inventions humaines.
Crée une fiche complète pour chaque invention ci-dessous.

## RÈGLES DE CLASSIFICATION

### DIMENSION (ce que c'est fondamentalement)
- "matter" : ce qui compose un objet (matières, substances, composants physiques)
- "process" : comment on transforme (procédés, techniques, méthodes)
- "tool" : avec quoi on transforme (outils, machines, usines, instruments)

### MATERIAL LEVEL (uniquement si dimension = "matter", sinon null)
Test : est-ce qu'on le MESURE (kg, litres) ou est-ce qu'on le COMPTE (unités) ?
- "raw" : extrait de la nature tel quel. Ex: minerai de fer, sable, pétrole brut, bois
- "processed" : nouvelle substance créée par transformation, on le mesure au poids. Ex: acier, silicium, plastique, farine
- "industrial" : même matériau mis en forme pour un usage spécifique. Ex: fil de cuivre, tôle d'acier, verre trempé
- "component" : pièce fonctionnelle autonome, on le compte en unités. Ex: batterie, processeur, moteur

### ORIGIN TYPE (d'où ça vient dans la nature — null si non applicable)
- "mineral" : provient du sol/roches/sous-sol. Non vivant. Ex: pierre, sable, minerais, pétrole, charbon
- "vegetal" : provient des plantes. Ex: bois, coton, caoutchouc naturel
- "animal" : provient des animaux. Ex: cuir, laine, soie

### NATURE TYPE (ce que c'est physiquement — null si non applicable)
- "element" : substance pure du tableau périodique. Ex: cuivre (Cu), fer (Fe), silicium (Si)
- "compose" : combinaison chimique avec formule. Ex: eau (H₂O), sel (NaCl)
- "materiau" : mélange/alliage défini par ses propriétés. Ex: acier, béton, verre, plastique

### CATEGORY (une seule valeur parmi) :
energy, construction, weapon, network, food, transport, software, infrastructure, textile, communication, agriculture, robotics, chemistry, electronics, environment, automation, medical, optical, storage, aeronautics, space, industry, nanotechnology, biotechnology, security, home_automation

### TYPE :
raw_material, material, process, tool, component
(NE JAMAIS utiliser "end_product")

### ERA :
prehistoric (avant -3000), ancient (-3000 à 500), medieval (500 à 1500), renaissance (1500 à 1750), industrial (1750 à 1900), modern (1900 à 1970), digital (1970 à 2010), contemporary (2010+)

### DESCRIPTIONS
2-3 phrases concises en texte brut. Pas de HTML, pas de balises, pas de citations.

### TAGS
3-7 mots-clés en français utiles pour la recherche.

### ORIGIN
Inventeur principal et/ou pays. Format "Nom (Pays)" ou juste "Pays". Null si inconnu.

### YEAR_APPROX
Entier entre -10000 et 2030. Année approximative d'invention.

### BUILT_UPON / LED_TO
- built_upon : 2-6 intrants directs. Utilise UNIQUEMENT des IDs existants de la liste ci-dessous.
- led_to : 0-4 produits directs. Utilise UNIQUEMENT des IDs existants.
- relation_type pour chaque lien : material, tool, energy, knowledge, catalyst

Inventions existantes (utilise ces IDs) :
${existingList}

Inventions à créer :
${lines.join('\n')}

Réponds UNIQUEMENT avec un JSON array, rien d'autre. Chaque élément doit inclure au minimum : "name", "name_en", "dimension", "materialLevel", "origin_type", "nature_type", "category", "type", "era", "year_approx", "origin", "description", "description_en", "wikipedia_url", "tags", "built_upon", "led_to". Utilise l'id attendu quand il est indiqué.`;
}

function parseJsonArray(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('Pas de JSON array dans la réponse');
  return JSON.parse(m[0]);
}

async function callMessages(client, body) {
  try {
    return await client.messages.create(body);
  } catch (e) {
    const s = String(e?.message || e);
    if (s.includes('429') || s.toLowerCase().includes('rate')) {
      console.log('   ⏳ Rate limit — pause 10s…');
      await sleep(10000);
      return client.messages.create(body);
    }
    throw e;
  }
}

function nodeFromAiItem(item, preferredId) {
  const id =
    (preferredId && String(preferredId).trim()) ||
    (item.id && String(item.id).trim()) ||
    slugify(item.name);
  const { dimension, materialLevel } = normalizeDimensionMaterialLevel(item);
  const { origin_type, nature_type } = normalizeOriginNatureTypes(item);
  const built = Array.isArray(item.built_upon)
    ? JSON.parse(JSON.stringify(item.built_upon))
    : [];
  const led = Array.isArray(item.led_to)
    ? JSON.parse(JSON.stringify(item.led_to))
    : [];
  return {
    id,
    name: String(item.name || id).trim(),
    name_en: String(item.name_en || '').trim(),
    description: cleanDescription(item.description ?? ''),
    description_en: cleanDescription(item.description_en ?? ''),
    category: normalizeCategory(item.category ?? ''),
    type: normalizeTechNodeType(item.type ?? ''),
    era: normalizeEra(item.era ?? '') || 'contemporary',
    year_approx: normalizeYearApprox(item.year_approx),
    origin: item.origin ? String(item.origin).trim() || null : null,
    wikipedia_url: item.wikipedia_url
      ? String(item.wikipedia_url).trim()
      : null,
    tags: Array.isArray(item.tags) ? item.tags.map((t) => String(t).trim()) : [],
    complexity_depth: 0,
    dimension,
    materialLevel,
    origin_type,
    nature_type,
    image_url: null,
    _ai_built_upon: built,
    _ai_led_to: led,
  };
}

function linkKey(s, t) {
  return `${s}→${t}`;
}

function addLinksForNode(db, nodeId, item, idSet, pendingLinks, existingKeys) {
  const links = db.links;
  if (item.built_upon) {
    for (const input of item.built_upon) {
      const sid = input.id || slugify(input.name);
      if (!idSet.has(sid) || !idSet.has(nodeId)) continue;
      const k = linkKey(sid, nodeId);
      if (existingKeys.has(k)) continue;
      const link = {
        id: uniqueLinkId(links, pendingLinks),
        source_id: sid,
        target_id: nodeId,
        relation_type: input.relation_type || 'material',
        is_optional: false,
        notes: null,
      };
      pendingLinks.push(link);
      existingKeys.add(k);
    }
  }
  if (item.led_to) {
    for (const output of item.led_to) {
      const tid = output.id || slugify(output.name);
      if (!idSet.has(nodeId) || !idSet.has(tid)) continue;
      const k = linkKey(nodeId, tid);
      if (existingKeys.has(k)) continue;
      const link = {
        id: uniqueLinkId(links, pendingLinks),
        source_id: nodeId,
        target_id: tid,
        relation_type: output.relation_type || 'material',
        is_optional: false,
        notes: null,
      };
      pendingLinks.push(link);
      existingKeys.add(k);
    }
  }
}

async function main() {
  const { count, category, nameArg } = parseArgs();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY manquant (.env.local)');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });
  const supabase = createServiceSupabaseClient();

  let db = readDB();
  const nodeIds = new Set(db.nodes.map((n) => n.id));
  const nameLower = new Set(db.nodes.map((n) => n.name.toLowerCase()));

  /** @type {{ name: string, preferredId?: string }[]} */
  let workList = [];

  if (nameArg) {
    const parts = nameArg.split(',').map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const id = slugify(p);
      if (nodeIds.has(id) || nameLower.has(p.toLowerCase())) {
        console.log(`⏭️  « ${p} » existe déjà, ignoré.`);
        continue;
      }
      workList.push({ name: p, preferredId: id });
    }
  } else {
    if (count == null || count < 1) {
      console.error(
        'Usage : node scripts/add-inventions.mjs --count N [--category cat] | --name "A,B,C"'
      );
      process.exit(1);
    }
    const orphans = findOrphanIds(db);
    const fromOrphans = [];
    for (const oid of orphans) {
      if (fromOrphans.length >= count) break;
      if (nodeIds.has(oid)) continue;
      const name = idToPrettyName(oid);
      fromOrphans.push({ name, preferredId: oid });
    }
    let need = count - fromOrphans.length;
    workList = fromOrphans.slice(0, count);
    if (need > 0) {
      const allNames = db.nodes.map((n) => n.name).join(', ');
      const joined =
        allNames.length > 120_000
          ? allNames.slice(0, 120_000) + '…'
          : allNames;
      const prompt = buildSuggestPrompt(joined, need, category || null);
      console.log(`\n📡 Suggestion Claude (${need} noms manquants)…`);
      const res = await callMessages(client, {
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      let suggested = [];
      try {
        suggested = parseJsonArray(text);
      } catch (e) {
        console.error('❌ JSON suggestion invalide :', e.message);
        process.exit(1);
      }
      if (!Array.isArray(suggested)) {
        console.error('❌ La suggestion doit être un tableau.');
        process.exit(1);
      }
      for (const raw of suggested) {
        if (workList.length >= count) break;
        const name = typeof raw === 'string' ? raw : raw?.name || String(raw);
        const id = slugify(name);
        if (nodeIds.has(id) || nameLower.has(name.toLowerCase())) continue;
        workList.push({ name, preferredId: id });
      }
    }
  }

  if (workList.length === 0) {
    console.log('Aucune nouvelle invention à ajouter.');
    return;
  }

  const estUsd = (workList.length * 0.002 + Math.ceil(workList.length / BATCH_SIZE) * 0.001).toFixed(2);
  console.log(`🚀 Ajout de ${workList.length} nouvelle(s) invention(s)`);
  console.log(`   Modèle : ${MODEL}`);
  console.log(`   Coût estimé : ~${estUsd}$\n`);

  const batches = [];
  for (let i = 0; i < workList.length; i += BATCH_SIZE) {
    batches.push(workList.slice(i, i + BATCH_SIZE));
  }

  let totalLinks = 0;
  let imagesOk = 0;
  const t0 = Date.now();
  let batchNum = 0;

  for (const batch of batches) {
    batchNum++;
    console.log(
      `⚡ Lot ${batchNum}/${batches.length} : ${batch.map((b) => b.name).join(', ')}`
    );
    const existingNodes = db.nodes;
    const prompt = buildCreatePrompt(batch, existingNodes);

    let items;
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const res = await callMessages(client, {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = res.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('');
        items = parseJsonArray(text);
        break;
      } catch (e) {
        if (attempt >= 2) {
          console.error(`   ❌ Lot ignoré après 2 échecs : ${e.message}`);
          items = [];
          break;
        }
        console.log(`   🔄 Retry JSON / API (${e.message})`);
        await sleep(2000);
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      await sleep(PAUSE_MS);
      continue;
    }

    const prefBySlug = new Map(
      batch.map((b) => [slugify(b.name), b.preferredId])
    );
    const newNodes = [];
    const pendingLinks = [];
    const existingLinkKeys = new Set(
      db.links.map((l) => linkKey(l.source_id, l.target_id))
    );

    for (const item of items) {
      const sid = slugify(item.name || '');
      const pref = prefBySlug.get(sid);
      let node;
      try {
        node = nodeFromAiItem(item, pref);
      } catch (err) {
        console.error(`   ❌ ${item?.name || '?'} : ${err.message}`);
        continue;
      }
      if (nodeIds.has(node.id)) {
        console.log(`⏭️  ${node.name} : existe déjà`);
        continue;
      }
      newNodes.push(node);
      nodeIds.add(node.id);
      nameLower.add(node.name.toLowerCase());
    }

    for (const node of newNodes) {
      db.nodes.push(node);
    }

    const addedIds = new Set(newNodes.map((n) => n.id));
    const idSet = new Set(db.nodes.map((n) => n.id));
    for (const item of items) {
      const sid = slugify(item.name || '');
      const pref = prefBySlug.get(sid);
      const nodeId =
        (item.id && String(item.id).trim()) ||
        pref ||
        slugify(item.name);
      if (!addedIds.has(nodeId)) continue;
      addLinksForNode(db, nodeId, item, idSet, pendingLinks, existingLinkKeys);
    }

    for (const l of pendingLinks) {
      db.links.push(l);
    }
    totalLinks += pendingLinks.length;

    writeDB(db);

    if (newNodes.length) {
      await upsertNodes(supabase, newNodes);
    }
    if (pendingLinks.length) {
      await upsertLinks(supabase, pendingLinks);
    }

    for (const node of newNodes) {
      const item = items.find(
        (it) =>
          slugify(it.name || '') === slugify(node.name) ||
          (it.id && it.id === node.id)
      );
      const lc = item
        ? (item.built_upon?.length || 0) + (item.led_to?.length || 0)
        : 0;
      const created = pendingLinks.filter(
        (l) => l.source_id === node.id || l.target_id === node.id
      ).length;
      console.log(
        `   ✅ ${node.name} (${node.dimension} | ${node.category}) — ${created} lien(s) créés (${lc} dans la réponse)`
      );
      let img = null;
      if (node.wikipedia_url?.trim()) {
        img = await fetchWikipediaImageUrl(String(node.wikipedia_url).trim());
      }
      if (img) {
        node.image_url = img;
        await updateNodeImageUrl(supabase, node.id, img);
        writeDB(db);
        imagesOk++;
        console.log(`   🖼️  Image : ${node.name}`);
      }
    }

    await sleep(PAUSE_MS);
    db = readDB();
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  const estFinal = (workList.length * 0.002).toFixed(2);
  console.log('\n' + '═'.repeat(46));
  console.log('📊 Résumé — add-inventions');
  console.log(`Inventions traitées   : ${workList.length}`);
  console.log(`Liens ajoutés (lot)   : ${totalLinks}`);
  console.log(`Images récupérées     : ${imagesOk}`);
  console.log(`Durée                 : ${sec}s`);
  console.log(`Coût estimé           : ~${estFinal}$`);
  console.log('═'.repeat(46));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
