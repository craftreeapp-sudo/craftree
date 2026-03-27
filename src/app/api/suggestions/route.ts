import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { getClientIpFromHeaders } from '@/lib/request-ip';
import { notifyAdminNewSuggestion } from '@/lib/notify-admin-suggestion';

function useSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function POST(request: Request) {
  try {
    if (!useSupabase()) {
      return NextResponse.json(
        { error: 'Suggestions require Supabase' },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      suggestion_type?: string;
      node_id?: string | null;
      data?: Record<string, unknown>;
    };

    const suggestion_type = body.suggestion_type;
    const data = body.data;
    if (!suggestion_type || !data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'suggestion_type and data are required' },
        { status: 400 }
      );
    }

    const allowed = ['edit_node', 'add_link', 'new_node'];
    if (!allowed.includes(suggestion_type)) {
      return NextResponse.json(
        { error: 'invalid suggestion_type' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseRouteHandlerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const insertRow = {
        user_id: user.id,
        suggestion_type,
        status: 'pending' as const,
        node_id: body.node_id ?? null,
        data,
        contributor_ip: null as string | null,
      };

      const { data: inserted, error } = await supabase
        .from('suggestions')
        .insert(insertRow)
        .select('id')
        .single();

      if (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const id = inserted?.id as string;
      void notifyAdminNewSuggestion({
        suggestionId: id,
        suggestionType: suggestion_type,
        isAnonymous: false,
        contributorIp: null,
      });

      return NextResponse.json({ id }, { status: 201 });
    }

    const clientIp = getClientIpFromHeaders(request);
    const sb = createSupabaseServiceRoleClient();

    const insertRow = {
      user_id: null as string | null,
      suggestion_type,
      status: 'pending' as const,
      node_id: body.node_id ?? null,
      data,
      contributor_ip: clientIp,
    };

    const { data: inserted, error } = await sb
      .from('suggestions')
      .insert(insertRow)
      .select('id')
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const id = inserted?.id as string;
    void notifyAdminNewSuggestion({
      suggestionId: id,
      suggestionType: suggestion_type,
      isAnonymous: true,
      contributorIp: clientIp,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to create suggestion' },
      { status: 500 }
    );
  }
}
