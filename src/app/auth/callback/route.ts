import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { treeInventionPath, getDefaultTreeNodeId } from '@/lib/tree-routes';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get('error');
  const nextPath =
    url.searchParams.get('next') ?? treeInventionPath(getDefaultTreeNodeId());
  const safeNext = nextPath.startsWith('/') ? nextPath : '/';

  if (oauthError) {
    const desc = url.searchParams.get('error_description') ?? oauthError;
    const target = new URL(safeNext, url.origin);
    target.searchParams.set('auth_error', desc.slice(0, 200));
    return NextResponse.redirect(target);
  }

  const code = url.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              /* Server Component context */
            }
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
