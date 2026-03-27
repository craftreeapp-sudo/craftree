import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import {
  RelationType as RT,
  type CraftingLink,
  type RelationType,
} from '@/lib/types';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { mapLinkRowToCraftingLink } from '@/lib/data';

const RELATIONS: RelationType[] = [
  RT.MATERIAL,
  RT.TOOL,
  RT.ENERGY,
  RT.KNOWLEDGE,
  RT.CATALYST,
];

function isRelationType(s: string): s is RelationType {
  return RELATIONS.includes(s as RelationType);
}

type Ctx = { params: Promise<{ id: string }> };

function useSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);
    const body = (await request.json()) as Partial<CraftingLink>;

    if (!useSupabase()) {
      const data = readSeedData();
      const idx = data.links.findIndex((l) => l.id === decoded);
      if (idx === -1) {
        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
      }

      const cur = data.links[idx]!;
      if (
        body.relation_type !== undefined &&
        !isRelationType(String(body.relation_type))
      ) {
        return NextResponse.json(
          { error: 'invalid relation_type' },
          { status: 400 }
        );
      }

      const merged: CraftingLink = {
        ...cur,
        id: cur.id,
        source_id: cur.source_id,
        target_id: cur.target_id,
        relation_type: (body.relation_type !== undefined
          ? body.relation_type
          : cur.relation_type) as RelationType,
        is_optional:
          body.is_optional !== undefined
            ? Boolean(body.is_optional)
            : cur.is_optional,
        notes:
          body.notes !== undefined
            ? typeof body.notes === 'string' && body.notes.trim()
              ? body.notes.trim()
              : undefined
            : cur.notes,
      };

      data.links[idx] = merged;
      writeSeedData(data);
      return NextResponse.json({ link: merged });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const { data: cur } = await sb.from('links').select('*').eq('id', decoded).maybeSingle();
    if (!cur) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    if (
      body.relation_type !== undefined &&
      !isRelationType(String(body.relation_type))
    ) {
      return NextResponse.json(
        { error: 'invalid relation_type' },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = {};
    if (body.relation_type !== undefined) {
      patch.relation_type = body.relation_type;
    }
    if (body.is_optional !== undefined) {
      patch.is_optional = Boolean(body.is_optional);
    }
    if (body.notes !== undefined) {
      patch.notes =
        typeof body.notes === 'string' && body.notes.trim()
          ? body.notes.trim()
          : null;
    }

    const { data: updated, error } = await sb
      .from('links')
      .update(patch)
      .eq('id', decoded)
      .select()
      .single();

    if (error) throw error;
    const link = mapLinkRowToCraftingLink(updated as Record<string, unknown>);
    return NextResponse.json({ link });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to update link' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);

    if (!useSupabase()) {
      const data = readSeedData();
      const before = data.links.length;
      data.links = data.links.filter((l) => l.id !== decoded);
      if (data.links.length === before) {
        return NextResponse.json({ error: 'Link not found' }, { status: 404 });
      }
      writeSeedData(data);
      return NextResponse.json({ ok: true });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const { data: deleted, error } = await sb
      .from('links')
      .delete()
      .eq('id', decoded)
      .select('id');
    if (error) throw error;
    if (!deleted?.length) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}
