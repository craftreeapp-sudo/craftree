import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminFromRequest, getRouteHandlerUser } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import {
  fetchAllLinkRowsPaginated,
  fetchAllNodeIdsSet,
  isMissingNatureColumnsError,
} from '@/lib/data';
import { dimensionMaterialLevelFromCreateBody } from '@/lib/node-dimension';
import {
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import { normalizeInventionName, slugify } from '@/lib/utils';
import { NodeCategory, Era } from '@/lib/types';
import {
  completeAiOperation,
  startAiOperation,
} from '@/lib/ai-tools/operations-log';
import {
  clampYearBound,
  normalizeYearBounds,
} from '@/lib/ai-tools/admin-node-scope';

export const maxDuration = 300;

const ADD_MODEL = 'claude-haiku-4-5-20251001';
const NAME_SAMPLE_CAP = 2500;
const EST_EUR_PER_CARD = 0.001;

const CATEGORIES = new Set<string>(Object.values(NodeCategory));
const ERAS = new Set<string>(Object.values(Era));

function parseJsonObject(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]!) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clampYear(
  y: unknown,
  yearMin: number | null,
  yearMax: number | null
): number | null {
  if (y === null || y === undefined || y === '') return null;
  const n = Number(y);
  if (!Number.isFinite(n)) return null;
  if (n < -10000 || n > 2030) return null;
  let v = n;
  if (yearMin != null && v < yearMin) v = yearMin;
  if (yearMax != null && v > yearMax) v = yearMax;
  return v;
}

function normalizeNatureTypeDb(
  v: unknown
): 'element' | 'compose' | 'materiau' | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).toLowerCase().trim();
  if (s === 'element') return 'element';
  if (s === 'compound' || s === 'compose') return 'compose';
  if (s === 'material' || s === 'materiau') return 'materiau';
  return null;
}

function normalizeOriginTypeDb(
  v: unknown
): 'mineral' | 'vegetal' | 'animal' | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).toLowerCase().trim();
  if (s === 'mineral' || s === 'vegetal' || s === 'animal') return s;
  return null;
}

async function fetchNameSample(sb: SupabaseClient): Promise<string[]> {
  const names: string[] = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await sb
      .from('nodes')
      .select('name')
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) {
      const n = (row as { name: string }).name;
      if (typeof n === 'string' && n.trim()) names.push(n.trim());
    }
    if (batch.length < page) break;
    from += page;
    if (names.length >= NAME_SAMPLE_CAP) break;
  }
  return names.slice(0, NAME_SAMPLE_CAP);
}

async function uniqueNodeId(
  sb: SupabaseClient,
  base: string,
  reserved: Set<string>
): Promise<string> {
  const existing = await fetchAllNodeIdsSet(sb);
  let id = slugify(base);
  if (!id) id = 'node';
  const has = (x: string) => existing.has(x) || reserved.has(x);
  if (!has(id)) {
    reserved.add(id);
    return id;
  }
  let n = 2;
  while (has(`${id}-${n}`)) n += 1;
  const out = `${id}-${n}`;
  reserved.add(out);
  return out;
}

function maxNumericLinkSuffixFromRows(rows: { id: string }[]): number {
  let max = 0;
  for (const l of rows) {
    const m = /^l(\d+)$/.exec(l.id);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max;
}

type InventionPayload = {
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  category: string;
  era: string;
  year_approx?: number | null;
  dimension?: string;
  materialLevel?: string;
  naturalOrigin?: string;
  chemicalNature?: string;
  origin_type?: string | null;
  nature_type?: string | null;
  built_upon?: string[];
};

export async function POST(request: Request) {
  let opId: string | null = null;
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase requis' }, { status: 503 });
    }
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY manquant' },
        { status: 503 }
      );
    }
    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const dryRun = Boolean(body.dryRun);
    const category =
      typeof body.category === 'string' ? body.category.trim() : '';
    const eraFilter = typeof body.era === 'string' ? body.era.trim() : 'all';
    const count = Math.min(
      50,
      Math.max(1, Number(body.count) || 1)
    );
    const dimFilter =
      typeof body.dimension === 'string' ? body.dimension.trim() : 'all';
    const cascade = Boolean(body.cascade);
    const { yearMin, yearMax } = normalizeYearBounds(
      clampYearBound(body.yearMin),
      clampYearBound(body.yearMax)
    );
    const excludeLocked =
      body.excludeLocked === undefined ? true : Boolean(body.excludeLocked);
    const excludeDraftNodes = Boolean(body.excludeDraftNodes);

    if (dryRun) {
      return NextResponse.json({
        resolvedCount: count,
        estimatedCostEur: count * EST_EUR_PER_CARD,
        yearMin,
        yearMax,
      });
    }

    if (!category || !CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: 'category invalide' },
        { status: 400 }
      );
    }
    if (eraFilter !== 'all' && !ERAS.has(eraFilter)) {
      return NextResponse.json({ error: 'era invalide' }, { status: 400 });
    }
    if (
      dimFilter !== 'all' &&
      dimFilter !== 'matter' &&
      dimFilter !== 'process' &&
      dimFilter !== 'tool'
    ) {
      return NextResponse.json(
        { error: 'dimension invalide' },
        { status: 400 }
      );
    }

    const user = await getRouteHandlerUser();
    opId = await startAiOperation({
      tool: 'add',
      paramsJson: {
        category,
        era: eraFilter,
        count,
        dimension: dimFilter,
        cascade,
        yearMin,
        yearMax,
        excludeLocked,
        excludeDraftNodes,
      },
      costEstimateEur: count * EST_EUR_PER_CARD,
      createdByUserId: user?.id ?? null,
    });

    const sb = createSupabaseServiceRoleClient();
    const existingNames = await fetchNameSample(sb);
    const nameListJson = JSON.stringify(existingNames);

    const dimHint =
      dimFilter === 'all'
        ? 'dimension peut être matter, process ou tool (avec materialLevel si matter).'
        : `dimension doit être "${dimFilter}" (et materialLevel si matter).`;

    const eraHint =
      eraFilter === 'all'
        ? 'Choisis une era par invention parmi les valeurs Craftree.'
        : `Toutes les inventions doivent avoir era="${eraFilter}".`;

    const yearHint =
      yearMin != null || yearMax != null
        ? `Chaque year_approx doit être entre ${yearMin ?? -10000} et ${yearMax ?? 2030} (bornes incluses).`
        : 'year_approx entre -10000 et 2030.';

    const system = `Tu es un assistant pour une base de données d'inventions (Craftree). Réponds UNIQUEMENT par un objet JSON valide, sans markdown, sans texte avant ou après.

Schéma JSON attendu:
{
  "inventions": [
    {
      "name": "string (nom français, obligatoire, unique)",
      "name_en": "string",
      "description": "string courte FR",
      "description_en": "string courte EN",
      "category": "${category}",
      "era": "une de: prehistoric, ancient, medieval, renaissance, industrial, modern, digital, contemporary",
      "year_approx": nombre ou null (entre -10000 et 2030),
      "dimension": "matter" | "process" | "tool",
      "materialLevel": "raw"|"processed"|"industrial"|"component" (si dimension matter, sinon null),
      "naturalOrigin": "mineral"|"vegetal"|"animal" ou omis,
      "chemicalNature": "element"|"compound"|"material" ou omis,
      "origin_type": "mineral"|"vegetal"|"animal" ou null,
      "nature_type": "element"|"compose"|"materiau" ou null (compose pas compound, materiau pas material),
      "built_upon": ["nom d'ingrédient ou matière déjà connue", ...] — noms de matières dont cette invention dépend (lien material: ingrédient → invention)
    }
  ]
}

Contraintes: exactement ${count} inventions. Noms inédits (pas dans la liste fournie). ${eraHint} ${dimHint} ${yearHint}`;

    const userPrompt = `Liste de noms déjà présents (extrait, ne pas dupliquer de nom proche):\n${nameListJson.slice(0, 120_000)}\n\nPropose ${count} nouvelles inventions cohérentes pour la catégorie "${category}".`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30 * 1000,
    });

    const response = await anthropic.messages.create({
      model: ADD_MODEL,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content[0];
    const text =
      block?.type === 'text' ? block.text : JSON.stringify(response.content);
    const parsed = parseJsonObject(text);
    const rawList = parsed?.inventions;
    if (!Array.isArray(rawList)) {
      await completeAiOperation(opId, {
        status: 'failed',
        results: { error: 'Réponse JSON invalide' },
      });
      return NextResponse.json(
        { error: 'Réponse Claude invalide (inventions manquantes)' },
        { status: 422 }
      );
    }

    const inventions: InventionPayload[] = [];
    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name.trim() : '';
      if (!name) continue;
      inventions.push({
        name,
        name_en: typeof o.name_en === 'string' ? o.name_en.trim() : undefined,
        description:
          typeof o.description === 'string' ? o.description.trim() : '',
        description_en:
          typeof o.description_en === 'string' ? o.description_en.trim() : '',
        category:
          typeof o.category === 'string' && CATEGORIES.has(o.category.trim())
            ? o.category.trim()
            : category,
        era:
          typeof o.era === 'string' && ERAS.has(o.era.trim())
            ? o.era.trim()
            : eraFilter !== 'all' && ERAS.has(eraFilter)
              ? eraFilter
              : 'modern',
        year_approx: clampYear(o.year_approx, yearMin, yearMax),
        dimension: typeof o.dimension === 'string' ? o.dimension.trim() : undefined,
        materialLevel:
          typeof o.materialLevel === 'string' ? o.materialLevel.trim() : undefined,
        naturalOrigin:
          typeof o.naturalOrigin === 'string' ? o.naturalOrigin.trim() : undefined,
        chemicalNature:
          typeof o.chemicalNature === 'string' ? o.chemicalNature.trim() : undefined,
        origin_type:
          o.origin_type === null || o.origin_type === undefined
            ? undefined
            : String(o.origin_type),
        nature_type:
          o.nature_type === null || o.nature_type === undefined
            ? undefined
            : String(o.nature_type),
        built_upon: Array.isArray(o.built_upon)
          ? o.built_upon.map((x) => String(x).trim()).filter(Boolean)
          : [],
      });
    }

    const existingSet = new Set(
      existingNames.map((n) => normalizeInventionName(n))
    );
    const reservedIds = new Set<string>();
    const normToId = new Map<string, string>();
    let from = 0;
    const page = 1000;
    for (;;) {
      const { data, error } = await sb
        .from('nodes')
        .select('id, name')
        .range(from, from + page - 1);
      if (error) throw error;
      const batch = data ?? [];
      for (const row of batch) {
        const r = row as { id: string; name: string };
        const k = normalizeInventionName(r.name);
        if (!normToId.has(k)) normToId.set(k, r.id);
      }
      if (batch.length < page) break;
      from += page;
    }

    function resolveIdByNorm(k: string): string | null {
      return normToId.get(k) ?? null;
    }

    const errors: string[] = [];
    const createdNodes: string[] = [];
    const createdLinks: string[] = [];

    const stubTargets = new Set<string>();
    if (cascade) {
      for (const inv of inventions) {
        for (const ing of inv.built_upon ?? []) {
          const nk = normalizeInventionName(ing);
          if (!nk) continue;
          if (existingSet.has(nk) || resolveIdByNorm(nk)) continue;
          stubTargets.add(nk);
        }
      }
    }

    for (const nk of stubTargets) {
      const displayName =
        [...(inventions.flatMap((i) => i.built_upon ?? []))].find(
          (x) => normalizeInventionName(x) === nk
        ) ?? nk;
      try {
        const id = await uniqueNodeId(sb, displayName, reservedIds);
        const dm = dimensionMaterialLevelFromCreateBody({
          dimension: 'matter',
          materialLevel: 'component',
        });
        const no = parseNaturalOrigin(undefined);
        const cn = parseChemicalNature(undefined);
        const insertRow = {
          id,
          name: displayName.slice(0, 500),
          name_en: displayName.slice(0, 500),
          description: '',
          description_en: null,
          category,
          type: category,
          era: eraFilter !== 'all' ? eraFilter : inventions[0]?.era ?? 'modern',
          year_approx: null,
          origin: null,
          image_url: null,
          wikipedia_url: null,
          tags: [] as string[],
          complexity_depth: 0,
          dimension: dm.dimension,
          material_level: dm.materialLevel,
          natural_origin: no === '' ? null : no,
          chemical_nature: cn === '' ? null : cn,
          origin_type: null,
          nature_type: null,
          is_draft: true,
        };

        const first = await sb.from('nodes').insert(insertRow).select().single();
        let insErr = first.error;
        if (insErr && isMissingNatureColumnsError(insErr)) {
          const {
            natural_origin: _a,
            chemical_nature: _b,
            ...rest
          } = insertRow;
          const retry = await sb.from('nodes').insert(rest).select().single();
          insErr = retry.error;
        }
        if (insErr) {
          errors.push(`stub ${displayName}: ${insErr.message}`);
          continue;
        }
        normToId.set(nk, id);
        existingSet.add(nk);
        createdNodes.push(id);
      } catch (e) {
        errors.push(`stub ${displayName}: ${String(e)}`);
      }
    }

    const linkRowsInit = await fetchAllLinkRowsPaginated(sb, 'id');
    let linkSuffix = maxNumericLinkSuffixFromRows(linkRowsInit as { id: string }[]);

    for (const inv of inventions) {
      const nk = normalizeInventionName(inv.name);
      if (existingSet.has(nk)) {
        errors.push(`doublon ignoré: ${inv.name}`);
        continue;
      }

      const bodyDm = dimensionMaterialLevelFromCreateBody({
        dimension: inv.dimension ?? null,
        materialLevel: inv.materialLevel ?? null,
      });
      let dm = bodyDm;
      if (dimFilter !== 'all') {
        dm = {
          dimension: dimFilter as 'matter' | 'process' | 'tool',
          materialLevel:
            dimFilter === 'matter' ? dm.materialLevel ?? 'component' : null,
        };
      }
      if (dm.dimension === null) {
        dm = { dimension: 'matter', materialLevel: 'component' };
      }

      const year = clampYear(inv.year_approx, yearMin, yearMax);
      const naturalOrigin = parseNaturalOrigin(inv.naturalOrigin);
      const chemicalNature = parseChemicalNature(inv.chemicalNature);

      try {
        const id = await uniqueNodeId(sb, inv.name, reservedIds);
        const insertRow = {
          id,
          name: inv.name.slice(0, 500),
          name_en: (inv.name_en || inv.name).slice(0, 500),
          description: inv.description ?? '',
          description_en: inv.description_en ? inv.description_en.slice(0, 8000) : null,
          category: inv.category,
          type: inv.category,
          era: inv.era,
          year_approx: year,
          origin: null,
          image_url: null,
          wikipedia_url: null,
          tags: [] as string[],
          complexity_depth: 0,
          dimension: dm.dimension,
          material_level: dm.materialLevel,
          natural_origin: naturalOrigin === '' ? null : naturalOrigin,
          chemical_nature: chemicalNature === '' ? null : chemicalNature,
          origin_type: normalizeOriginTypeDb(inv.origin_type),
          nature_type: normalizeNatureTypeDb(inv.nature_type),
          is_draft: true,
        };

        const first = await sb.from('nodes').insert(insertRow).select().single();
        let insErr = first.error;
        if (insErr && isMissingNatureColumnsError(insErr)) {
          const {
            natural_origin: _a,
            chemical_nature: _b,
            ...rest
          } = insertRow;
          const retry = await sb.from('nodes').insert(rest).select().single();
          insErr = retry.error;
        }
        if (insErr && String(insErr.message ?? '').includes('origin_type')) {
          const {
            origin_type: _o,
            nature_type: _n,
            ...withoutOn
          } = insertRow;
          const retry2 = await sb.from('nodes').insert(withoutOn).select().single();
          insErr = retry2.error;
        }
        if (insErr) {
          errors.push(`${inv.name}: ${insErr.message}`);
          continue;
        }
        normToId.set(nk, id);
        existingSet.add(nk);
        createdNodes.push(id);

        for (const ingName of inv.built_upon ?? []) {
          const ink = normalizeInventionName(ingName);
          if (!ink) continue;
          let srcId = resolveIdByNorm(ink);
          if (!srcId && cascade) {
            const stubName = ingName.trim().slice(0, 500);
            srcId = await uniqueNodeId(sb, stubName, reservedIds);
            const dmS = dimensionMaterialLevelFromCreateBody({
              dimension: 'matter',
              materialLevel: 'component',
            });
            const stubRow = {
              id: srcId,
              name: stubName,
              name_en: stubName,
              description: '',
              description_en: null,
              category,
              type: category,
              era: inv.era,
              year_approx: null,
              origin: null,
              image_url: null,
              wikipedia_url: null,
              tags: [] as string[],
              complexity_depth: 0,
              dimension: dmS.dimension,
              material_level: dmS.materialLevel,
              natural_origin: null,
              chemical_nature: null,
              origin_type: null,
              nature_type: null,
              is_draft: true,
            };
            const ins = await sb.from('nodes').insert(stubRow).select().single();
            let e = ins.error;
            if (e && isMissingNatureColumnsError(e)) {
              const { natural_origin: _a, chemical_nature: _b, ...r2 } = stubRow;
              const r = await sb.from('nodes').insert(r2).select().single();
              e = r.error;
            }
            if (e) {
              errors.push(`cascade ${stubName}: ${e.message}`);
              continue;
            }
            normToId.set(ink, srcId);
            existingSet.add(ink);
            createdNodes.push(srcId);
          }
          if (!srcId) {
            errors.push(`lien sans source: ${ingName} → ${inv.name}`);
            continue;
          }
          const { data: srcMeta } = await sb
            .from('nodes')
            .select('is_locked, is_draft')
            .eq('id', srcId)
            .maybeSingle();
          if (srcMeta) {
            const sm = srcMeta as { is_locked?: boolean; is_draft?: boolean };
            if (excludeLocked && sm.is_locked === true) {
              errors.push(`lien ignoré (carte verrouillée): ${ingName}`);
              continue;
            }
            if (excludeDraftNodes && sm.is_draft === true) {
              errors.push(`lien ignoré (brouillon): ${ingName}`);
              continue;
            }
          }
          const { data: dup } = await sb
            .from('links')
            .select('id')
            .eq('source_id', srcId)
            .eq('target_id', id)
            .maybeSingle();
          if (dup) continue;

          linkSuffix += 1;
          const lid = `l${linkSuffix}`;
          const { error: lErr } = await sb.from('links').insert({
            id: lid,
            source_id: srcId,
            target_id: id,
            relation_type: 'material',
            is_optional: false,
            notes: null,
          });
          if (lErr) {
            errors.push(`lien ${ingName}: ${lErr.message}`);
          } else {
            createdLinks.push(lid);
          }
        }
      } catch (e) {
        errors.push(`${inv.name}: ${String(e)}`);
      }
    }

    await completeAiOperation(opId, {
      status: 'completed',
      cardsProcessed: inventions.length,
      cardsModified: createdNodes.length,
      results: {
        createdNodes,
        createdLinks,
        errors,
      },
    });

    return NextResponse.json({
      draftsCreated: createdNodes.length,
      linksCreated: createdLinks.length,
      operationId: opId,
      errors,
    });
  } catch (e) {
    console.error(e);
    await completeAiOperation(opId, {
      status: 'failed',
      results: { error: String(e instanceof Error ? e.message : e) },
    });
    return NextResponse.json(
      { error: 'add-inventions failed', message: String(e) },
      { status: 500 }
    );
  }
}
