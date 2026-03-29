import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import type { SeedNode } from '@/lib/types';
import {
  createSupabaseServerReadClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase-server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { mapNodeRowToSeedNode } from '@/lib/data';
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
    const { data, error } = await sb.from('nodes').select('*').eq('id', decoded).maybeSingle();
    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    const row = data as Record<string, unknown>;
    const node = mapNodeRowToSeedNode(row);
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
        type: typeof body.type === 'string' ? body.type : cur.type,
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

      data.nodes[idx] = merged;
      writeSeedData(data);
      return NextResponse.json({ node: merged });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const { data: prevRow } = await sb.from('nodes').select('*').eq('id', decoded).maybeSingle();
    if (!prevRow) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    const cur = mapNodeRowToSeedNode(prevRow as Record<string, unknown>);

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
    if (typeof body.type === 'string') patch.type = body.type;
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
      patch.natural_origin =
        body.naturalOrigin === null || body.naturalOrigin === ''
          ? null
          : String(body.naturalOrigin);
    }
    if (body.chemicalNature !== undefined) {
      patch.chemical_nature =
        body.chemicalNature === null || body.chemicalNature === ''
          ? null
          : String(body.chemicalNature);
    }

    const { data: updated, error } = await sb
      .from('nodes')
      .update(patch)
      .eq('id', decoded)
      .select()
      .single();

    if (error) throw error;
    const node = mapNodeRowToSeedNode(updated as Record<string, unknown>);
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
