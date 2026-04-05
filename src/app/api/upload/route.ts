import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { fetchFullNodeRowById, mapNodeRowToSeedNode } from '@/lib/data';
import { seedNodeIsLocked } from '@/lib/node-lock';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import {
  createSupabaseServerReadClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase-server';

const NODES_IMG_DIR = path.join(process.cwd(), 'public/images/nodes');

export async function POST(request: Request) {
  const admin = await requireAdminFromRequest();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const nodeId = formData.get('nodeId') as string | null;

  if (!file || !nodeId?.trim()) {
    return NextResponse.json(
      { error: 'Fichier et nodeId requis' },
      { status: 400 }
    );
  }

  if (!/^[\w-]+$/.test(nodeId)) {
    return NextResponse.json({ error: 'nodeId invalide' }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const sbRead = createSupabaseServerReadClient();
    const row = await fetchFullNodeRowById(sbRead, nodeId);
    if (!row) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    if (seedNodeIsLocked(mapNodeRowToSeedNode(row as Record<string, unknown>))) {
      return NextResponse.json({ error: 'node_locked' }, { status: 423 });
    }
  } else {
    const data = readSeedData();
    const n = data.nodes.find((x) => x.id === nodeId);
    if (!n) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    if (seedNodeIsLocked(n)) {
      return NextResponse.json({ error: 'node_locked' }, { status: 423 });
    }
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      {
        error: 'Format non supporté. Utilisez JPG, PNG, WebP ou GIF.',
      },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'Fichier trop lourd (max 5 Mo)' },
      { status: 400 }
    );
  }

  if (!existsSync(NODES_IMG_DIR)) {
    await mkdir(NODES_IMG_DIR, { recursive: true });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
    ? ext === 'jpeg'
      ? 'jpg'
      : ext
    : 'webp';
  const filename = `${nodeId}.${safeExt}`;
  const filepath = path.join(NODES_IMG_DIR, filename);

  const bytes = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(bytes));

  const publicPath = `/images/nodes/${filename}`;

  try {
    const seedData = readSeedData();
    const node = seedData.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.image_url = publicPath;
      writeSeedData(seedData);
    }
  } catch (e) {
    console.warn('upload: seed update skipped', e);
  }

  if (isSupabaseConfigured()) {
    const sb = createSupabaseServiceRoleClient();
    const { error } = await sb
      .from('nodes')
      .update({ image_url: publicPath, updated_at: new Date().toISOString() })
      .eq('id', nodeId);
    if (error) {
      console.error('upload: supabase update failed', error);
      return NextResponse.json(
        { error: 'Image enregistrée mais la base distante n’a pas été mise à jour.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    image_url: publicPath,
    success: true,
  });
}
