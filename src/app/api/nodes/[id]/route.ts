import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import type { SeedNode } from '@/lib/types';
import {
  createSupabaseServerReadClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase-server';
import {
  requireAdminFromRequest,
  getViewerIsAdminFromCookies,
} from '@/lib/auth-server';
import {
  fetchFullNodeRowById,
  isMissingDraftColumnError,
  isMissingLockedColumnError,
  isMissingNatureColumnsError,
  mapNodeRowToSeedNode,
} from '@/lib/data';
import { nodeRowToTechNodeDetails } from '@/lib/db-map';
import { mergeDimensionMaterialLevel } from '@/lib/node-dimension';
import {
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);

    if (!isSupabaseConfigured()) {
      const data = readSeedData();
      const n = data.nodes.find((x) => x.id === decoded);
      if (!n) {
        return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      }
      const viewerAdmin = await getViewerIsAdminFromCookies();
      if (n.is_draft && !viewerAdmin) {
        return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      }
      return NextResponse.json({
        node: n,
        details: {
          name_en: n.name_en,
          description: n.description,
          description_en: n.description_en,
          image_url: n.image_url,
          wikipedia_url: n.wikipedia_url,
          origin: n.origin ?? null,
          tags: n.tags,
        },
      });
    }

    const sb = createSupabaseServerReadClient();
    const data = await fetchFullNodeRowById(sb, decoded);
    if (!data) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    const row = data as unknown as Record<string, unknown>;
    const node = mapNodeRowToSeedNode(row);
    const viewerAdmin = await getViewerIsAdminFromCookies();
    if (node.is_draft && !viewerAdmin) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    const details = nodeRowToTechNodeDetails(row);
    return NextResponse.json({ node, details });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to read node' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);
    const body = (await request.json()) as Record<string, unknown>;

    if (!isSupabaseConfigured()) {
      const data = readSeedData();
      const idx = data.nodes.findIndex((n) => n.id === decoded);
      if (idx === -1) {
        return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      }

      const cur = data.nodes[idx]!;
      if (cur.is_locked) {
        const willUnlock = body.is_locked === false;
        const otherKeys = Object.keys(body).filter((k) => k !== 'is_locked');
        if (otherKeys.length > 0 && !willUnlock) {
          return NextResponse.json({ error: 'node_locked' }, { status: 423 });
        }
      }
      let tags: string[] = cur.tags;
      const rawTags = body.tags;
      if (Array.isArray(rawTags)) tags = rawTags.map(String);
      else if (typeof rawTags === 'string') {
        tags = rawTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }

      const merged: SeedNode = {
        ...cur,
        id: cur.id,
        name: typeof body.name === 'string' ? body.name.trim() : cur.name,
        description:
          typeof body.description === 'string' ? body.description : cur.description,
        description_en:
          typeof body.description_en === 'string'
            ? body.description_en.trim()
            : cur.description_en,
        name_en:
          typeof body.name_en === 'string' ? body.name_en.trim() : cur.name_en,
        category:
          typeof body.category === 'string' ? body.category : cur.category,
        era: typeof body.era === 'string' ? body.era : cur.era,
        tags,
        origin:
          typeof body.origin === 'string' ? body.origin.trim() : cur.origin,
        image_url:
          typeof body.image_url === 'string' ? body.image_url.trim() : cur.image_url,
        wikipedia_url:
          typeof body.wikipedia_url === 'string'
            ? body.wikipedia_url.trim()
            : cur.wikipedia_url,
      };

      if (body.year_approx !== undefined) {
        merged.year_approx =
          body.year_approx === null ? undefined : Number(body.year_approx);
      }

      const dm = mergeDimensionMaterialLevel(cur, body);
      merged.dimension = dm.dimension;
      merged.materialLevel = dm.materialLevel;

      if (body.naturalOrigin !== undefined) {
        merged.naturalOrigin =
          body.naturalOrigin === null || body.naturalOrigin === ''
            ? null
            : parseNaturalOrigin(String(body.naturalOrigin)) || null;
      }
      if (body.chemicalNature !== undefined) {
        merged.chemicalNature =
          body.chemicalNature === null || body.chemicalNature === ''
            ? null
            : parseChemicalNature(String(body.chemicalNature)) || null;
      }

      const adminLocal = await requireAdminFromRequest();
      if (body.is_draft !== undefined) {
        if (!adminLocal) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        merged.is_draft = Boolean(body.is_draft);
      }
      if (body.is_locked !== undefined) {
        if (!adminLocal) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        merged.is_locked = Boolean(body.is_locked);
      }

      data.nodes[idx] = merged;
      writeSeedData(data);
      return NextResponse.json({ node: merged });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const prevRow = await fetchFullNodeRowById(sb, decoded);
    if (!prevRow) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    const cur = mapNodeRowToSeedNode(prevRow as unknown as Record<string, unknown>);

    if (cur.is_locked) {
      const willUnlock = body.is_locked === false;
      const otherKeys = Object.keys(body).filter((k) => k !== 'is_locked');
      if (otherKeys.length > 0 && !willUnlock) {
        return NextResponse.json({ error: 'node_locked' }, { status: 423 });
      }
    }

    let tags: string[] | undefined;
    const rawTags = body.tags;
    if (Array.isArray(rawTags)) tags = rawTags.map(String);
    else if (typeof rawTags === 'string') {
      tags = rawTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.description === 'string') patch.description = body.description;
    if (typeof body.description_en === 'string') patch.description_en = body.description_en.trim();
    if (typeof body.name_en === 'string') patch.name_en = body.name_en.trim();
    if (typeof body.category === 'string') patch.category = body.category;
    if (typeof body.era === 'string') patch.era = body.era;
    if (tags) patch.tags = tags;
    if (typeof body.origin === 'string') patch.origin = body.origin.trim();
    if (typeof body.image_url === 'string') patch.image_url = body.image_url.trim();
    if (typeof body.wikipedia_url === 'string') patch.wikipedia_url = body.wikipedia_url.trim();
    if (body.year_approx !== undefined) {
      patch.year_approx =
        body.year_approx === null ? null : Number(body.year_approx);
    }

    const dm = mergeDimensionMaterialLevel(cur, body);
    patch.dimension = dm.dimension;
    patch.material_level = dm.materialLevel;

    if (body.naturalOrigin !== undefined) {
      if (body.naturalOrigin === null || body.naturalOrigin === '') {
        patch.natural_origin = null;
      } else {
        const p = parseNaturalOrigin(String(body.naturalOrigin));
        patch.natural_origin = p === '' ? null : p;
      }
    }
    if (body.chemicalNature !== undefined) {
      if (body.chemicalNature === null || body.chemicalNature === '') {
        patch.chemical_nature = null;
      } else {
        const p = parseChemicalNature(String(body.chemicalNature));
        patch.chemical_nature = p === '' ? null : p;
      }
    }

    if (body.is_draft !== undefined) {
      patch.is_draft = Boolean(body.is_draft);
    }
    if (body.is_locked !== undefined) {
      patch.is_locked = Boolean(body.is_locked);
    }

    const attemptPatch: Record<string, unknown> = { ...patch };
    let updated: unknown = null;
    let error: {
      message?: string;
      details?: string;
      hint?: string;
    } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await sb
        .from('nodes')
        .update(attemptPatch)
        .eq('id', decoded)
        .select()
        .single();
      updated = r.data;
      error = r.error;
      if (!error) break;
      if (isMissingNatureColumnsError(error)) {
        delete attemptPatch.natural_origin;
        delete attemptPatch.chemical_nature;
        continue;
      }
      if (isMissingDraftColumnError(error) && attemptPatch.is_draft !== undefined) {
        delete attemptPatch.is_draft;
        continue;
      }
      if (isMissingLockedColumnError(error) && attemptPatch.is_locked !== undefined) {
        delete attemptPatch.is_locked;
        continue;
      }
      break;
    }
    if (error) throw error;
    const node = mapNodeRowToSeedNode(updated as Record<string, unknown>);
    if (body.is_draft !== undefined) {
      const wanted = Boolean(body.is_draft);
      if (node.is_draft !== wanted) {
        return NextResponse.json(
          {
            error: 'draft_not_persisted',
            message:
              'Impossible d’enregistrer le statut brouillon (colonne absente ou migration non appliquée).',
          },
          { status: 422 }
        );
      }
    }
    return NextResponse.json({ node });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to update node' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);

    if (!isSupabaseConfigured()) {
      const data = readSeedData();
      const victim = data.nodes.find((n) => n.id === decoded);
      if (victim?.is_locked) {
        return NextResponse.json({ error: 'node_locked' }, { status: 423 });
      }
      const before = data.nodes.length;
      data.nodes = data.nodes.filter((n) => n.id !== decoded);
      if (data.nodes.length === before) {
        return NextResponse.json({ error: 'Node not found' }, { status: 404 });
      }
      data.links = data.links.filter(
        (l) => l.source_id !== decoded && l.target_id !== decoded
      );
      writeSeedData(data);
      return NextResponse.json({ ok: true });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const prevRow = await fetchFullNodeRowById(sb, decoded);
    if (!prevRow) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    if (mapNodeRowToSeedNode(prevRow as Record<string, unknown>).is_locked) {
      return NextResponse.json({ error: 'node_locked' }, { status: 423 });
    }
    const { error } = await sb.from('nodes').delete().eq('id', decoded);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to delete node' },
      { status: 500 }
    );
  }
}
