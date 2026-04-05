import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import {
  fetchAllLinkRowsPaginated,
  fetchAllNodeIdsSet,
  fetchFullNodeRowById,
  mapLinkRowToCraftingLink,
  mapNodeRowToSeedNode,
} from '@/lib/data';
import { seedNodeIsLocked } from '@/lib/node-lock';
import {
  AI_REVIEW_MODEL,
  AI_REVIEW_SYSTEM_PROMPT,
  buildAiReviewUserPayload,
} from '@/lib/ai-review/prompt';
import {
  applyIssueToProposed,
  DEFAULT_ADD_LINK_RELATION,
  parseClaudeJson,
  type ClaudeReviewJson,
} from '@/lib/ai-review/map-issues';
import { seedNodeToEditSnapshot } from '@/lib/ai-review/seed-snapshot';
import { mapPoolWithStagger } from '@/lib/ai-review/pool';
import type { SeedNode } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clampYearBound,
  filterNodeIdsByAdminScope,
  normalizeYearBounds,
  parseInventionIdList,
  type AdminNodeScope,
  type DraftScope,
} from '@/lib/ai-tools/admin-node-scope';

export const maxDuration = 300;

const EST_EUR_PER_CARD = 0.001;
const POOL = 10;
const STAGGER_MS = 200;

type BatchFilter = 'no_dimension' | 'no_material_level' | 'zero_links' | 'all';
type ReviewMode = 'classify' | 'links' | 'full';

type Body = {
  inventionIds?: string[];
  /** Liste d’ids (texte libre, une par ligne ou séparés par virgules). */
  inventionIdsText?: string;
  mode?: ReviewMode;
  dryRun?: boolean;
  batchFilter?: BatchFilter;
  /** Filtres additionnels (combinés avec batchFilter) : catégorie / époque / année approx. */
  filterCategory?: string;
  filterEra?: string;
  filterYearMin?: number | null;
  filterYearMax?: number | null;
  excludeLocked?: boolean;
  draftScope?: DraftScope;
  complexityMin?: number | null;
  complexityMax?: number | null;
};

type BatchScope = {
  category: string | null;
  era: string | null;
  yearMin: number | null;
  yearMax: number | null;
};

function parseBatchScopeFromBody(body: Body): BatchScope {
  const cat =
    typeof body.filterCategory === 'string' && body.filterCategory.trim() !== ''
      ? body.filterCategory.trim()
      : null;
  const category =
    cat && cat !== 'all' ? cat : null;
  const er =
    typeof body.filterEra === 'string' && body.filterEra.trim() !== ''
      ? body.filterEra.trim()
      : null;
  const era = er && er !== 'all' ? er : null;
  let yearMin = clampYearBound(body.filterYearMin);
  let yearMax = clampYearBound(body.filterYearMax);
  const norm = normalizeYearBounds(yearMin, yearMax);
  yearMin = norm.yearMin;
  yearMax = norm.yearMax;
  return { category, era, yearMin, yearMax };
}

function parseReviewExclusionScope(body: Body): AdminNodeScope {
  let excludeLocked = true;
  if (body.excludeLocked === false) {
    excludeLocked = false;
  }
  let draftScope: DraftScope = 'all';
  if (body.draftScope === 'drafts_only' || body.draftScope === 'published_only') {
    draftScope = body.draftScope;
  }
  return {
    excludeLocked,
    draftScope,
    complexityMin:
      body.complexityMin != null &&
      Number.isFinite(Number(body.complexityMin))
        ? Math.max(0, Math.floor(Number(body.complexityMin)))
        : null,
    complexityMax:
      body.complexityMax != null &&
      Number.isFinite(Number(body.complexityMax))
        ? Math.max(0, Math.floor(Number(body.complexityMax)))
        : null,
  };
}

function scopeIsActive(scope: BatchScope): boolean {
  return (
    scope.category != null ||
    scope.era != null ||
    scope.yearMin != null ||
    scope.yearMax != null
  );
}

async function filterIdsByBatchScope(
  sb: SupabaseClient,
  ids: string[],
  scope: BatchScope
): Promise<string[]> {
  if (!scopeIsActive(scope) || ids.length === 0) return ids;

  const out: string[] = [];
  const chunk = 100;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await sb
      .from('nodes')
      .select('id, category, era, year_approx')
      .in('id', slice);
    if (error) throw error;
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        category: string | null;
        era: string | null;
        year_approx: number | null;
      };
      if (scope.category && String(r.category ?? '') !== scope.category) continue;
      if (scope.era && String(r.era ?? '') !== scope.era) continue;
      if (scope.yearMin != null || scope.yearMax != null) {
        if (r.year_approx === null || r.year_approx === undefined) continue;
        const y = Number(r.year_approx);
        if (!Number.isFinite(y)) continue;
        if (scope.yearMin != null && y < scope.yearMin) continue;
        if (scope.yearMax != null && y > scope.yearMax) continue;
      }
      out.push(r.id);
    }
  }
  return out;
}

function snapshotDiffers(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
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

async function fetchIdsForBatchFilter(
  sb: SupabaseClient,
  filter: BatchFilter
): Promise<string[]> {
  const allSet = await fetchAllNodeIdsSet(sb);
  const all = [...allSet].sort();

  if (filter === 'all') return all;

  if (filter === 'zero_links') {
    const rows = await fetchAllLinkRowsPaginated(sb, 'source_id, target_id');
    const connected = new Set<string>();
    for (const r of rows) {
      connected.add(String(r.source_id));
      connected.add(String(r.target_id));
    }
    return all.filter((id) => !connected.has(id));
  }

  const out: string[] = [];
  const chunk = 80;
  for (let i = 0; i < all.length; i += chunk) {
    const slice = all.slice(i, i + chunk);
    const { data, error } = await sb
      .from('nodes')
      .select('id, dimension, material_level')
      .in('id', slice);
    if (error) throw error;
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        dimension: string | null;
        material_level: string | null;
      };
      if (filter === 'no_dimension') {
        if (r.dimension == null || String(r.dimension).trim() === '') {
          out.push(r.id);
        }
      } else if (filter === 'no_material_level') {
        if (
          r.dimension === 'matter' &&
          (r.material_level == null || String(r.material_level).trim() === '')
        ) {
          out.push(r.id);
        }
      }
    }
  }
  return out;
}

function nodeToPromptObject(seed: SeedNode): Record<string, unknown> {
  return {
    id: seed.id,
    name: seed.name,
    name_en: seed.name_en,
    category: seed.category,
    era: seed.era,
    year_approx: seed.year_approx ?? null,
    origin: seed.origin ?? null,
    tags: seed.tags ?? [],
    dimension: seed.dimension ?? null,
    materialLevel: seed.materialLevel ?? null,
    naturalOrigin: seed.naturalOrigin ?? null,
    chemicalNature: seed.chemicalNature ?? null,
    origin_type: seed.origin_type ?? null,
    nature_type: seed.nature_type ?? null,
    description: seed.description ?? '',
    description_en: seed.description_en ?? '',
    wikipedia_url: seed.wikipedia_url ?? null,
    image_url: seed.image_url ?? null,
    is_draft: seed.is_draft ?? false,
  };
}

type LinkCtx = {
  link_id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  peer_name: string;
};

async function buildNameById(sb: SupabaseClient): Promise<Map<string, string>> {
  const nameById = new Map<string, string>();
  const { data: nodes } = await sb.from('nodes').select('id, name');
  for (const n of nodes ?? []) {
    const r = n as { id: string; name: string };
    nameById.set(r.id, r.name);
  }
  return nameById;
}

function loadContextForNodeFromEdges(
  nodeId: string,
  seed: SeedNode,
  allLinks: Record<string, unknown>[],
  nameById: Map<string, string>
): {
  seed: SeedNode;
  builtUpon: LinkCtx[];
  ledTo: LinkCtx[];
} {
  const builtUpon: LinkCtx[] = [];
  const ledTo: LinkCtx[] = [];

  for (const raw of allLinks) {
    const l = mapLinkRowToCraftingLink(raw);
    if (l.target_id === nodeId) {
      builtUpon.push({
        link_id: l.id,
        source_id: l.source_id,
        target_id: l.target_id,
        relation_type: l.relation_type,
        peer_name: nameById.get(l.source_id) ?? l.source_id,
      });
    }
    if (l.source_id === nodeId) {
      ledTo.push({
        link_id: l.id,
        source_id: l.source_id,
        target_id: l.target_id,
        relation_type: l.relation_type,
        peer_name: nameById.get(l.target_id) ?? l.target_id,
      });
    }
  }

  return { seed, builtUpon, ledTo };
}

/** Une seule ligne `ai_review` par carte : champs + `proposedAddLinks` + `removedLinkIds`. */
async function insertAiReviewSuggestion(
  sb: SupabaseClient,
  nodeId: string,
  original: Record<string, unknown>,
  proposed: Record<string, unknown>,
  meta: Record<string, unknown>,
  opts: {
    proposedAddLinks?: Array<{
      source_id: string;
      target_id: string;
      relation_type: string;
      notes?: string | null;
      section?: 'ledTo' | 'builtUpon';
    }>;
    removedLinkIds?: string[];
    linkContext?: Record<
      string,
      { peerName: string; section: 'ledTo' | 'builtUpon'; peerId?: string }
    >;
  }
): Promise<void> {
  const data: Record<string, unknown> = {
    source: 'ai',
    original: { ...original, linkEdits: {} },
    proposed: { ...proposed, linkEdits: {} },
    ...meta,
  };
  if (opts.proposedAddLinks?.length) {
    data.proposedAddLinks = opts.proposedAddLinks;
  }
  if (opts.removedLinkIds?.length) {
    data.removedLinkIds = opts.removedLinkIds;
  }
  if (opts.linkContext && Object.keys(opts.linkContext).length > 0) {
    data.linkContext = opts.linkContext;
  }
  const { error } = await sb.from('suggestions').insert({
    user_id: null,
    suggestion_type: 'ai_review',
    status: 'pending',
    node_id: nodeId,
    data,
    contributor_ip: null,
  });
  if (error) throw error;
}

async function processOneInvention(
  sb: SupabaseClient,
  anthropic: Anthropic,
  inventionId: string,
  mode: ReviewMode,
  allLinks: Record<string, unknown>[],
  nameById: Map<string, string>
): Promise<{
  created: number;
  clean: boolean;
  error?: string;
}> {
  const row = await fetchFullNodeRowById(sb, inventionId);
  if (!row) {
    return { created: 0, clean: false, error: 'Nœud introuvable' };
  }
  const seed = mapNodeRowToSeedNode(row);
  if (seedNodeIsLocked(seed)) {
    return {
      created: 0,
      clean: false,
      error: 'Carte verrouillée (is_locked) — analyse ignorée.',
    };
  }

  const ctx = loadContextForNodeFromEdges(inventionId, seed, allLinks, nameById);

  const userContent = buildAiReviewUserPayload({
    mode,
    node: nodeToPromptObject(ctx.seed),
    builtUpon: ctx.builtUpon,
    ledTo: ctx.ledTo,
  });

  const response = await anthropic.messages.create({
    model: AI_REVIEW_MODEL,
    max_tokens: 1000,
    system: AI_REVIEW_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const block = response.content[0];
  const text =
    block?.type === 'text' ? block.text : JSON.stringify(response.content);
  const parsed = parseClaudeJson(text);
  if (!parsed) {
    return {
      created: 0,
      clean: false,
      error: 'Réponse Claude non JSON ou illisible',
    };
  }

  let created = 0;
  const original = seedNodeToEditSnapshot(ctx.seed);
  const proposed = { ...original } as Record<string, unknown>;
  for (const issue of parsed.issues ?? []) {
    const field = issue.field;
    if (!field) continue;
    applyIssueToProposed(proposed, field, issue.suggested_value);
  }

  const confidence =
    typeof parsed.confidence === 'number' ? parsed.confidence : null;
  const lowConfidence = confidence != null && confidence < 0.7;

  const unresolvedMissing: Record<string, unknown>[] = [];

  const hasFieldDiff = snapshotDiffers(original, proposed);

  const proposedAddLinks: Array<{
    source_id: string;
    target_id: string;
    relation_type: string;
    notes: string | null;
    section: 'ledTo' | 'builtUpon';
  }> = [];

  for (const ml of parsed.missing_links ?? []) {
    const t = String(ml.type ?? '')
      .toLowerCase()
      .trim();
    const peerName = String(ml.suggested_name ?? '').trim();
    if (!peerName) continue;
    const peerId = await resolveNodeIdByName(sb, peerName);
    if (!peerId) {
      unresolvedMissing.push({
        type: ml.type,
        suggested_name: peerName,
        reason: ml.reason,
      });
      continue;
    }
    const reasonNote =
      ml.reason != null && String(ml.reason).trim()
        ? `AI: ${String(ml.reason).trim()}`
        : null;
    if (t === 'built_upon' || t === 'builtupon') {
      proposedAddLinks.push({
        source_id: peerId,
        target_id: inventionId,
        relation_type: DEFAULT_ADD_LINK_RELATION,
        notes: reasonNote,
        section: 'builtUpon',
      });
    } else if (t === 'led_to' || t === 'ledto') {
      proposedAddLinks.push({
        source_id: inventionId,
        target_id: peerId,
        relation_type: DEFAULT_ADD_LINK_RELATION,
        notes: reasonNote,
        section: 'ledTo',
      });
    }
  }

  const removedLinkIds: string[] = [];
  const linkContext: Record<
    string,
    { peerName: string; section: 'ledTo' | 'builtUpon'; peerId: string }
  > = {};

  for (const sl of parsed.suspect_links ?? []) {
    const lid = String(sl.link_id ?? '').trim();
    if (!lid) continue;
    const linkRow =
      ctx.builtUpon.find((x) => x.link_id === lid) ||
      ctx.ledTo.find((x) => x.link_id === lid);
    if (!linkRow) continue;
    removedLinkIds.push(lid);
    const peerId =
      linkRow.target_id === inventionId
        ? linkRow.source_id
        : linkRow.target_id;
    linkContext[lid] = {
      peerName: nameById.get(peerId) ?? peerId,
      section:
        linkRow.target_id === inventionId ? 'builtUpon' : 'ledTo',
      peerId,
    };
  }

  const meta: Record<string, unknown> = {
    ai_review: {
      mode,
      model: AI_REVIEW_MODEL,
      confidence,
      low_confidence_warning: lowConfidence,
      raw_issues: parsed.issues ?? [],
      unresolved_missing_links: unresolvedMissing,
      raw_suspect_links: Array.isArray(parsed.suspect_links)
        ? parsed.suspect_links
        : [],
    },
  };

  const hasLinkAdds = proposedAddLinks.length > 0;
  const hasLinkDeletes = removedLinkIds.length > 0;
  const hasAnySuggestion = hasFieldDiff || hasLinkAdds || hasLinkDeletes;

  if (hasAnySuggestion) {
    await insertAiReviewSuggestion(sb, inventionId, original, proposed, meta, {
      proposedAddLinks: hasLinkAdds ? proposedAddLinks : undefined,
      removedLinkIds: hasLinkDeletes ? removedLinkIds : undefined,
      linkContext: hasLinkDeletes ? linkContext : undefined,
    });
    created = 1;
  }

  const nothingToReport =
    !(parsed.issues?.length) &&
    !(parsed.missing_links?.length) &&
    !(parsed.suspect_links?.length);

  if (created === 0 && nothingToReport) {
    return { created: 0, clean: true };
  }

  if (created > 0) {
    return { created, clean: false };
  }

  return {
    created: 0,
    clean: false,
    error: 'Aucune suggestion créée à partir de la réponse.',
  };
}

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase requis' },
        { status: 503 }
      );
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

    const body = (await request.json()) as Body;
    const mode: ReviewMode = body.mode ?? 'full';
    const dryRun = Boolean(body.dryRun);
    const batchScope = parseBatchScopeFromBody(body);
    const exclusionScope = parseReviewExclusionScope(body);

    let inventionIds: string[] = [];
    if (typeof body.inventionIdsText === 'string' && body.inventionIdsText.trim()) {
      inventionIds = parseInventionIdList(body.inventionIdsText);
    } else if (Array.isArray(body.inventionIds)) {
      inventionIds = body.inventionIds.map((x) => String(x).trim()).filter(Boolean);
    }

    const sb = createSupabaseServiceRoleClient();

    if (inventionIds.length === 0 && body.batchFilter) {
      inventionIds = await fetchIdsForBatchFilter(sb, body.batchFilter);
      inventionIds = await filterIdsByBatchScope(sb, inventionIds, batchScope);
    } else if (inventionIds.length > 0) {
      inventionIds = await filterIdsByBatchScope(sb, inventionIds, batchScope);
    }

    let unique = [...new Set(inventionIds)];
    unique = await filterNodeIdsByAdminScope(sb, unique, exclusionScope);

    if (dryRun) {
      return NextResponse.json({
        resolvedCount: unique.length,
        estimatedCostEur: unique.length * EST_EUR_PER_CARD,
        inventionIds: unique,
      });
    }

    if (unique.length === 0) {
      return NextResponse.json(
        { error: 'inventionIds vide ou batchFilter sans résultat' },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const allLinks = (await fetchAllLinkRowsPaginated(
      sb,
      'id, source_id, target_id, relation_type'
    )) as Record<string, unknown>[];
    const nameById = await buildNameById(sb);

    const errors: { inventionId: string; message: string }[] = [];
    let createdSuggestions = 0;
    let cleanCards = 0;

    const results = await mapPoolWithStagger(
      unique,
      POOL,
      STAGGER_MS,
      async (inventionId) => {
        try {
          const r = await processOneInvention(
            sb,
            anthropic,
            inventionId,
            mode,
            allLinks,
            nameById
          );
          return r;
        } catch (e) {
          console.error('[ai-review]', inventionId, e);
          return {
            created: 0,
            clean: false,
            error: String(e instanceof Error ? e.message : e),
          };
        }
      }
    );

    for (let i = 0; i < unique.length; i++) {
      const id = unique[i]!;
      const r = results[i]!;
      createdSuggestions += r.created;
      if (r.clean) cleanCards += 1;
      if (r.error) errors.push({ inventionId: id, message: r.error });
    }

    return NextResponse.json({
      createdSuggestions,
      cleanCards,
      analyzed: unique.length,
      errors,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'AI review failed',
      },
      { status: 500 }
    );
  }
}
