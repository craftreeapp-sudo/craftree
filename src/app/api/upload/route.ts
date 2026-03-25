import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

const SEED_PATH = path.join(process.cwd(), 'src/data/seed-data.json');
const NODES_IMG_DIR = path.join(process.cwd(), 'public/images/nodes');

export async function POST(request: Request) {
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
    const raw = await readFile(SEED_PATH, 'utf-8');
    const seedData = JSON.parse(raw) as {
      nodes: Array<{ id: string; image_url?: string | null }>;
      links: unknown[];
    };
    const node = seedData.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.image_url = publicPath;
      await writeFile(SEED_PATH, JSON.stringify(seedData, null, 2));
    }
  } catch (e) {
    console.error('upload: seed-data update failed', e);
    return NextResponse.json(
      { error: 'Image enregistrée mais mise à jour du JSON échouée' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    image_url: publicPath,
    success: true,
  });
}
