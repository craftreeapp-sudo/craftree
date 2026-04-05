import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminFromRequest, getRouteHandlerUser } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import {
  fetchFullNodeRowById,
  mapNodeRowToSeedNode,
} from '@/lib/data';
import { seedNodeIsLocked } from '@/lib/node-lock';
import { seedNodeToEditSnapshot } from '@/lib/ai-review/seed-snapshot';
import { mapPoolWithStagger } from '@/lib/ai-review/pool';
import {
  applyIssueToProposed,
  parseClaudeJson,
  DEFAULT_ADD_LINK_RELATION,
} from '@/lib/ai-review/map-issues';
import type { SeedNode } from '@/lib/types';
import {
  completeAiOperation,
  startAiOperation,
} from '@/lib/ai-tools/operations-log';
import {
  clampYearBound,
  normalizeYearBounds,
  nodeRowMatchesAdminScope,
  type AdminNodeScope,
  type DraftScope,
} from '@/lib/ai-tools/admin-node-scope';

export const maxDuration = 300;

const ENRICH_MODEL = 'claude-haiku-4-5-20251001';
const POOL = 5;
const STAGGER_MS = 200;
const EST_EUR_PER_CARD = 0.001;

function parseFilters(sp: URLSearchParams | Record<string, unknown>) {
  const flag = (k: string) => {
    if (sp instanceof URLSearchParams) {
      const v = sp.get(k);
      return v === '1' || v === 'true';
    }
    const v = (sp as Record<string, unknown>)[k];
    return v === true || v === 1 || v === '1' || v === 'true';
  };
  return {
    missDesc: flag('noDescription') || flag('missDesc'),
    missYear: flag('noYear') || flag('missYear'),
    missWiki: flag('noWikipedia') || flag('missWiki'),
    missDim: flag('noDimension') || flag('missDim'),
  };
}

const ENRICH_NODE_SELECT =
  'id, description, year_approx, wikipedia_url, dimension, material_level, category, era, is_locked, is_draft, complexity_depth';

function parseEnrichScope(
  sp: URLSearchParams | Record<string, unknown>
): AdminNodeScope {
  const str = (k: string): string | undefined => {
    if (sp instanceof URLSearchParams) {
      const v = sp.get(k);
      return v != null && v !== '' ? v : undefined;
    }
    const v = (sp as Record<string, unknown>)[k];
    return typeof v === 'string' && v !== '' ? v : undefined;
  };
  const num = (k: string): number | null => {
    if (sp instanceof URLSearchParams) {
      const v = sp.get(k);
      return v != null && v !== '' ? clampYearBound(v) : null;
    }
    return clampYearBound((sp as Record<string, unknown>)[k]);
  };
  const yMin = num('filterYearMin');
  const yMax = num('filterYearMax');
  const { yearMin: filterYearMin, yearMax: filterYearMax } =
    normalizeYearBounds(yMin, yMax);

  let draftScope: DraftScope = 'all';
  const ds = str('draftScope');
  if (ds === 'drafts_only' || ds === 'published_only') draftScope = ds;

  let excludeLocked = true;
  if (sp instanceof URLSearchParams) {
    const ex = sp.get('excludeLocked');
    if (ex === '0' || ex === 'false') excludeLocked = false;
  } else {
    const ex = (sp as Record<string, unknown>).excludeLocked;
    if (ex === false || ex === 0 || ex === '0') excludeLocked = false;
  }

  const cat = str('filterCategory');
  const era = str('filterEra');
  const cmin = sp instanceof URLSearchParams
    ? sp.get('complexityMin')
    : (sp as Record<string, unknown>).complexityMin;
  const cmax = sp instanceof URLSearchParams
    ? sp.get('complexityMax')
    : (sp as Record<string, unknown>).complexityMax;
  const complexityMin =
    cmin != null && cmin !== '' && Number.isFinite(Number(cmin))
      ? Math.max(0, Math.floor(Number(cmin)))
      : null;
  const complexityMax =
    cmax != null && cmax !== '' && Number.isFinite(Number(cmax))
      ? Math.max(0, Math.floor(Number(cmax)))
      : null;

  return {
    filterCategory: cat && cat !== 'all' ? cat : null,
    filterEra: era && era !== 'all' ? era : null,
    filterYearMin,
    filterYearMax,
    excludeLocked,
    draftScope,
    complexityMin: Number.isFinite(complexityMin as number)
      ? (complexityMin as number)
      : null,
    complexityMax: Number.isFinite(complexityMax as number)
      ? (complexityMax as number)
      : null,
  };
}

function rowMatchesEnrich(
  r: Record<string, unknown>,
  filters: ReturnType<typeof parseFilters>,
  scope: AdminNodeScope
): boolean {
  const anyMiss =
    filters.missDesc ||
    filters.missYear ||
    filters.missWiki ||
    filters.missDim;
  if (anyMiss && !rowMatchesFilters(r, filters)) return false;
  return nodeRowMatchesAdminScope(r, scope);
}

function missingScore(seed: SeedNode): number {
  let s = 0;
  if (!seed.description?.trim()) s += 2;
  if (seed.year_approx === null || seed.year_approx === undefined) s += 1;
  if (!seed.wikipedia_url?.trim()) s += 1;
  if (seed.dimension == null || String(seed.dimension).trim() === '') s += 1;
  if (
    seed.dimension === 'matter' &&
    (seed.materialLevel == null || String(seed.materialLevel).trim() === '')
  ) {
    s += 1;
  }
  return s;
}

async function resolveNodeIdByName(
  sb: SupabaseClient,
  name: string
): Promise<string | null> {
  const t = name.trim();
  if (!t) return null;
  const { data: exact } = await sb
    .from('nodes')
    .select('id')
    .eq('name', t)
    .limit(2);
  if (exact?.length === 1) return String((exact[0] as { id: string }).id);
  const { data: like } = await sb
    .from('nodes')
    .select('id, name')
    .ilike('name', `%${t.replace(/%/g, '\\%')}%`)
    .limit(5);
  if (like?.length === 1) return String((like[0] as { id: string }).id);
  return null;
}

function rowMatchesFilters(
  r: Record<string, unknown>,
  filters: ReturnType<typeof parseFilters>
): boolean {
  if (filters.missDesc) {
    const d = r.description;
    if (d != null && String(d).trim() !== '') return false;
  }
  if (filters.missYear) {
    if (r.year_approx !== null && r.year_approx !== undefined) return false;
  }
  if (filters.missWiki) {
    const w = r.wikipedia_url;
    if (w != null && String(w).trim() !== '') return false;
  }
  if (filters.missDim) {
    const dim = r.dimension;
    if (dim == null || String(dim).trim() === '') return true;
    if (String(dim) === 'matter') {
      const ml = r.material_level;
      return ml == null || String(ml).trim() === '';
    }
    return false;
  }
  return true;
}

async function countMatching(
  sb: SupabaseClient,
  filters: ReturnType<typeof parseFilters>,
  scope: AdminNodeScope
): Promise<number> {
  const { data, error } = await sb
    .from('nodes')
    .select(ENRICH_NODE_SELECT)
    .limit(8000);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.filter((r) => rowMatchesEnrich(r, filters, scope)).length;
}

async function fetchCandidateIds(
  sb: SupabaseClient,
  filters: ReturnType<typeof parseFilters>,
  scope: AdminNodeScope,
  maxFetch: number
): Promise<string[]> {
  const { data, error } = await sb
    .from('nodes')
    .select(ENRICH_NODE_SELECT)
    .limit(8000);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const filtered = rows.filter((r) => rowMatchesEnrich(r, filters, scope));
  return filtered.slice(0, maxFetch).map((r) => String(r.id));
}

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase requis' }, { status: 503 });
    }
    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const filters = parseFilters(searchParams);
    const scope = parseEnrichScope(searchParams);
    const sb = createSupabaseServiceRoleClient();
    const count = await countMatching(sb, filters, scope);
    return NextResponse.json({
      count,
      costPerCardEur: EST_EUR_PER_CARD,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'enrich count failed' }, { status: 500 });
  }
}

type EnrichBody = {
  limit?: number;
  dryRun?: boolean;
  noDescription?: boolean;
  noYear?: boolean;
  noWikipedia?: boolean;
  noDimension?: boolean;
  filterCategory?: string;
  filterEra?: string;
  filterYearMin?: number | null;
  filterYearMax?: number | null;
  excludeLocked?: boolean;
  draftScope?: DraftScope;
  complexityMin?: number | null;
  complexityMax?: number | null;
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

    const body = (await request.json()) as EnrichBody;
    const limit = Math.min(50, Math.max(1, Number(body.limit) || 20));
    const dryRun = Boolean(body.dryRun);
    const filters = parseFilters({
      noDescription: body.noDescription,
      noYear: body.noYear,
      noWikipedia: body.noWikipedia,
      noDimension: body.noDimension,
    } as Record<string, unknown>);
    const scope = parseEnrichScope(body as Record<string, unknown>);

    const user = await getRouteHandlerUser();
    opId = await startAiOperation({
      tool: 'enrich',
      paramsJson: { limit, dryRun, ...filters, ...scope },
      costEstimateEur: limit * EST_EUR_PER_CARD,
      createdByUserId: user?.id ?? null,
    });

    const sb = createSupabaseServiceRoleClient();
    const candidateIds = await fetchCandidateIds(sb, filters, scope, 4000);
    if (candidateIds.length === 0) {
      await completeAiOperation(opId, {
        status: 'completed',
        results: { message: 'Aucune carte ne correspond aux filtres' },
        cardsProcessed: 0,
        cardsModified: 0,
      });
      return NextResponse.json({
        suggestionsCreated: 0,
        errors: [],
        operationId: opId,
      });
    }

    const scored: { id: string; score: number }[] = [];
    for (const id of candidateIds) {
      const row = await fetchFullNodeRowById(sb, id);
      if (!row) continue;
      const seed = mapNodeRowToSeedNode(row);
      scored.push({ id, score: missingScore(seed) });
    }
    scored.sort((a, b) => b.score - a.score);
    const targetIds = scored.slice(0, limit).map((x) => x.id);

    if (dryRun) {
      await completeAiOperation(opId, {
        status: 'completed',
        results: { dryRun: true, targetIds },
        cardsProcessed: targetIds.length,
        cardsModified: 0,
      });
      return NextResponse.json({
        suggestionsCreated: 0,
        errors: [],
        operationId: opId,
        dryRun: true,
        targetIds,
        estimatedCostEur: targetIds.length * EST_EUR_PER_CARD,
      });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 45 * 1000,
    });

    const errors: { nodeId: string; message: string }[] = [];
    let suggestionsCreated = 0;

    const system = `Tu enrichis une fiche invention pour Craftree. Réponds par un JSON unique (sans markdown) de la forme:
{
  "fields_updated": { ... champs modifiés au format camelCase aligné sur l'éditeur: name, name_en, description, description_en, category, era, year_approx, origin, tags, dimension, materialLevel, naturalOrigin, chemicalNature, wikipedia_url, origin_type, nature_type },
  "missing_links": [ { "type": "built_upon" | "led_to", "suggested_name": "nom d'une carte existante", "reason": "..." } ],
  "confidence": 0.0-1.0,
  "notes": "brève justification"
}
year_approx doit être entre -10000 et 2030 si présent. Ne invente pas de faits précis non vérifiables; reste prudent.`;

    const results = await mapPoolWithStagger(
      targetIds,
      POOL,
      STAGGER_MS,
      async (nodeId) => {
        try {
          const row = await fetchFullNodeRowById(sb, nodeId);
          if (!row) {
            return { ok: false as const, err: 'Nœud introuvable' };
          }
          const seed = mapNodeRowToSeedNode(row);
          if (seedNodeIsLocked(seed)) {
            return { ok: false as const, err: 'Carte verrouillée' };
          }
          const original = seedNodeToEditSnapshot(seed);
          const snap = JSON.stringify(
            {
              node: original,
            },
            null,
            0
          );

          const response = await anthropic.messages.create({
            model: ENRICH_MODEL,
            max_tokens: 4096,
            system,
            messages: [
              {
                role: 'user',
                content: `Enrichis cette fiche (JSON):\n${snap}\n\nRéponds uniquement avec le JSON décrit.`,
              },
            ],
          });

          const block = response.content[0];
          const text =
            block?.type === 'text' ? block.text : JSON.stringify(response.content);
          const parsedRaw = parseClaudeJson(text);
          const parsed = parsedRaw as Record<string, unknown> | null;
          if (!parsed) {
            return { ok: false as const, err: 'Réponse JSON illisible' };
          }

          const rawFu = parsed.fields_updated as
            | Record<string, unknown>
            | undefined;
          const issues = parsed.issues as
            | Array<{ field?: string; suggested_value?: unknown }>
            | undefined;
          let proposed = { ...original } as Record<string, unknown>;

          if (rawFu && typeof rawFu === 'object') {
            for (const [k, v] of Object.entries(rawFu)) {
              proposed[k] = v;
            }
          }
          if (Array.isArray(issues)) {
            for (const issue of issues) {
              const field = issue.field;
              if (!field) continue;
              applyIssueToProposed(proposed, field, issue.suggested_value);
            }
          }

          const proposedAddLinks: {
            source_id: string;
            target_id: string;
            relation_type: string;
          }[] = [];

          const missingLinks = Array.isArray(parsed.missing_links)
            ? parsed.missing_links
            : [];
          for (const ml of missingLinks) {
            const t = String(ml.type ?? '')
              .toLowerCase()
              .trim();
            const peerName = String(ml.suggested_name ?? '').trim();
            if (!peerName) continue;
            const peerId = await resolveNodeIdByName(sb, peerName);
            if (!peerId) continue;
            if (t === 'built_upon' || t === 'builtupon') {
              proposedAddLinks.push({
                source_id: peerId,
                target_id: nodeId,
                relation_type: DEFAULT_ADD_LINK_RELATION,
              });
            } else if (t === 'led_to' || t === 'ledto') {
              proposedAddLinks.push({
                source_id: nodeId,
                target_id: peerId,
                relation_type: DEFAULT_ADD_LINK_RELATION,
              });
            }
          }

          const confidence =
            typeof parsed.confidence === 'number' ? parsed.confidence : null;
          const notes =
            typeof parsed.notes === 'string' ? parsed.notes : null;

          const hasDiff =
            JSON.stringify(proposed) !== JSON.stringify(original);
          if (!hasDiff && proposedAddLinks.length === 0) {
            return { ok: false as const, err: 'Aucun enrichissement proposé' };
          }

          const data = {
            source: 'ai',
            original: { ...original, linkEdits: {} },
            proposed: { ...proposed, linkEdits: {} },
            ...(proposedAddLinks.length ? { proposedAddLinks } : {}),
            enrichment_meta: {
              confidence,
              notes,
              model: ENRICH_MODEL,
            },
          };

          const { error: insErr } = await sb.from('suggestions').insert({
            user_id: null,
            suggestion_type: 'enrichment',
            status: 'pending',
            node_id: nodeId,
            data,
            contributor_ip: null,
          });
          if (insErr) {
            return { ok: false as const, err: insErr.message };
          }
          return { ok: true as const };
        } catch (e) {
          return {
            ok: false as const,
            err: String(e instanceof Error ? e.message : e),
          };
        }
      }
    );

    for (let i = 0; i < targetIds.length; i++) {
      const r = results[i]!;
      if (r.ok) suggestionsCreated += 1;
      else errors.push({ nodeId: targetIds[i]!, message: r.err });
    }

    await completeAiOperation(opId, {
      status: 'completed',
      cardsProcessed: targetIds.length,
      cardsModified: suggestionsCreated,
      results: { errors },
    });

    return NextResponse.json({
      suggestionsCreated,
      errors,
      operationId: opId,
    });
  } catch (e) {
    console.error(e);
    await completeAiOperation(opId, {
      status: 'failed',
      results: { error: String(e) },
    });
    return NextResponse.json({ error: 'enrich failed' }, { status: 500 });
  }
}
