import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdminFromRequest, getRouteHandlerUser } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { fetchFullNodeRowById, mapNodeRowToSeedNode } from '@/lib/data';
import { seedNodeIsLocked } from '@/lib/node-lock';
import {
  fetchWikipediaImageUrl,
  searchWikipediaImage,
} from '@/lib/wikimedia-fetch';
import {
  completeAiOperation,
  startAiOperation,
} from '@/lib/ai-tools/operations-log';
import {
  clampYearBound,
  normalizeYearBounds,
  nodeRowMatchesAdminScope,
  parseInventionIdList,
  type AdminNodeScope,
  type DraftScope,
} from '@/lib/ai-tools/admin-node-scope';

const IMG_EXT = /\.(jpe?g|png|webp)(\?|$)/i;

const FIX_IMG_SELECT =
  'id, name, name_en, wikipedia_url, image_url, category, era, year_approx, is_locked, is_draft, dimension, complexity_depth';

const EST_EUR_PER_PREVIEW_ROW = 0.0001;

function parseFixImagesScope(body: Record<string, unknown>): AdminNodeScope {
  const str = (k: string): string | undefined => {
    const v = body[k];
    return typeof v === 'string' && v !== '' ? v : undefined;
  };
  const yMin = clampYearBound(body.filterYearMin);
  const yMax = clampYearBound(body.filterYearMax);
  const { yearMin: filterYearMin, yearMax: filterYearMax } =
    normalizeYearBounds(yMin, yMax);
  let draftScope: DraftScope = 'all';
  const ds = str('draftScope');
  if (ds === 'drafts_only' || ds === 'published_only') draftScope = ds;
  let excludeLocked = true;
  if (body.excludeLocked === false || body.excludeLocked === 0) {
    excludeLocked = false;
  }
  const cat = str('filterCategory');
  const era = str('filterEra');
  const dim = str('dimension');
  const cmin = body.complexityMin;
  const cmax = body.complexityMax;
  return {
    filterCategory: cat && cat !== 'all' ? cat : null,
    filterEra: era && era !== 'all' ? era : null,
    filterYearMin,
    filterYearMax,
    excludeLocked,
    draftScope,
    complexityMin:
      cmin != null && cmin !== '' && Number.isFinite(Number(cmin))
        ? Math.max(0, Math.floor(Number(cmin)))
        : null,
    complexityMax:
      cmax != null && cmax !== '' && Number.isFinite(Number(cmax))
        ? Math.max(0, Math.floor(Number(cmax)))
        : null,
    requireWikipediaUrl:
      body.requireWikipediaUrl === true ||
      body.requireWikipediaUrl === '1' ||
      body.requireWikipediaUrl === 'true',
    dimension:
      dim === 'matter' || dim === 'process' || dim === 'tool' ? dim : 'all',
  };
}

function isValidImageUrl(url: string | null): boolean {
  if (!url?.trim()) return false;
  return IMG_EXT.test(url);
}

async function loadFixImageCandidateRows(
  sb: SupabaseClient,
  scope: AdminNodeScope,
  idWhitelist: string[] | null,
  onlyWithoutImage: boolean
): Promise<Record<string, unknown>[]> {
  const { data, error } = await sb.from('nodes').select(FIX_IMG_SELECT).limit(4000);
  if (error) throw error;
  let rows = (data ?? []) as Record<string, unknown>[];
  if (idWhitelist && idWhitelist.length > 0) {
    const set = new Set(idWhitelist);
    rows = rows.filter((r) => set.has(String(r.id)));
  }
  return rows.filter((r) => {
    if (onlyWithoutImage) {
      const im = r.image_url;
      if (im != null && String(im).trim() !== '') return false;
    }
    return nodeRowMatchesAdminScope(r, scope);
  });
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
    const body = Object.fromEntries(searchParams.entries());
    const scope = parseFixImagesScope(body as Record<string, unknown>);
    const onlyWithoutImage = searchParams.get('onlyWithoutImage') !== '0';
    const idRaw = searchParams.get('inventionIdsText') ?? '';
    const idList = idRaw.trim() ? parseInventionIdList(idRaw) : null;
    const sb = createSupabaseServiceRoleClient();
    const rows = await loadFixImageCandidateRows(sb, scope, idList, onlyWithoutImage);
    return NextResponse.json({
      count: rows.length,
      costPerPreviewRowEur: EST_EUR_PER_PREVIEW_ROW,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'fix-images count failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let opId: string | null = null;
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase requis' }, { status: 503 });
    }
    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const updates = body.updates;

    if (body.dryRun === true && !Array.isArray(updates)) {
      const scope = parseFixImagesScope(body);
      const onlyWithoutImage = body.onlyWithoutImage !== false;
      const idRaw =
        typeof body.inventionIdsText === 'string' ? body.inventionIdsText : '';
      const idList = idRaw.trim() ? parseInventionIdList(idRaw) : null;
      const limit = Math.min(500, Math.max(1, Number(body.limit) || 50));
      const sb = createSupabaseServiceRoleClient();
      const rows = await loadFixImageCandidateRows(
        sb,
        scope,
        idList?.length ? idList : null,
        onlyWithoutImage
      );
      const n = Math.min(rows.length, limit);
      return NextResponse.json({
        resolvedCount: n,
        estimatedCostEur: n * EST_EUR_PER_PREVIEW_ROW,
        poolSize: rows.length,
      });
    }

    if (Array.isArray(updates)) {
      const user = await getRouteHandlerUser();
      opId = await startAiOperation({
        tool: 'images',
        paramsJson: { apply: true, count: updates.length },
        createdByUserId: user?.id ?? null,
      });

      const sb = createSupabaseServiceRoleClient();
      let modified = 0;
      const errors: string[] = [];

      for (const u of updates) {
        if (!u || typeof u !== 'object') continue;
        const o = u as Record<string, unknown>;
        const nodeId = typeof o.nodeId === 'string' ? o.nodeId.trim() : '';
        const imageUrl =
          typeof o.imageUrl === 'string' ? o.imageUrl.trim() : '';
        if (!nodeId || !imageUrl) {
          errors.push('entrée nodeId/imageUrl invalide');
          continue;
        }
        if (!isValidImageUrl(imageUrl)) {
          errors.push(`${nodeId}: URL image non autorisée`);
          continue;
        }
        const row = await fetchFullNodeRowById(sb, nodeId);
        if (!row) {
          errors.push(`${nodeId}: introuvable`);
          continue;
        }
        const seed = mapNodeRowToSeedNode(row);
        if (seedNodeIsLocked(seed)) {
          errors.push(`${nodeId}: verrouillé`);
          continue;
        }
        const { error } = await sb
          .from('nodes')
          .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
          .eq('id', nodeId);
        if (error) errors.push(`${nodeId}: ${error.message}`);
        else modified += 1;
      }

      await completeAiOperation(opId, {
        status: 'completed',
        cardsProcessed: updates.length,
        cardsModified: modified,
        results: { errors },
      });

      return NextResponse.json({ updated: modified, errors, operationId: opId });
    }

    const limit = Math.min(500, Math.max(1, Number(body.limit) || 50));
    const scope = parseFixImagesScope(body);
    const onlyWithoutImage = body.onlyWithoutImage !== false;
    const idRaw =
      typeof body.inventionIdsText === 'string' ? body.inventionIdsText : '';
    const idList = idRaw.trim() ? parseInventionIdList(idRaw) : null;
    const requireWiki = Boolean(scope.requireWikipediaUrl);

    const sb = createSupabaseServiceRoleClient();
    const filtered = await loadFixImageCandidateRows(
      sb,
      scope,
      idList?.length ? idList : null,
      onlyWithoutImage
    );
    const candidates = filtered.slice(0, limit);
    const estCost = candidates.length * EST_EUR_PER_PREVIEW_ROW;

    const user = await getRouteHandlerUser();
    opId = await startAiOperation({
      tool: 'images',
      paramsJson: { preview: true, limit, ...scope },
      costEstimateEur: estCost,
      createdByUserId: user?.id ?? null,
    });

    const results: { nodeId: string; name: string; url: string | null }[] = [];

    for (const r of candidates) {
      const nodeId = String(r.id);
      const name = String(r.name ?? '');
      const nameEn = r.name_en != null ? String(r.name_en) : '';
      const wiki = r.wikipedia_url != null ? String(r.wikipedia_url) : '';

      let url: string | null = null;
      if (wiki.trim()) {
        url = await fetchWikipediaImageUrl(wiki);
      }
      if (!isValidImageUrl(url) && !requireWiki) {
        url = await searchWikipediaImage(name, nameEn || undefined);
      }
      if (!isValidImageUrl(url)) {
        url = null;
      }
      results.push({ nodeId, name, url });
    }

    await completeAiOperation(opId, {
      status: 'completed',
      cardsProcessed: candidates.length,
      cardsModified: 0,
      results: { preview: true },
    });

    return NextResponse.json({ results, operationId: opId });
  } catch (e) {
    console.error(e);
    await completeAiOperation(opId, {
      status: 'failed',
      results: { error: String(e) },
    });
    return NextResponse.json({ error: 'fix-images failed' }, { status: 500 });
  }
}
