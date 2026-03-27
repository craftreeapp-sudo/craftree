import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { getClientIpFromHeaders } from '@/lib/request-ip';
import { notifyAdminNewSuggestion } from '@/lib/notify-admin-suggestion';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
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

    const allowed = [
      'edit_node',
      'add_link',
      'new_node',
      'delete_link',
      'anonymous_feedback',
    ];
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

    if (suggestion_type === 'anonymous_feedback') {
      if (user) {
        return NextResponse.json(
          { error: 'anonymous_feedback requires no session' },
          { status: 400 }
        );
      }
      const msg =
        typeof data.message === 'string' ? data.message.trim() : '';
      if (!msg || msg.length > 500) {
        return NextResponse.json(
          { error: 'message required (max 500 chars)' },
          { status: 400 }
        );
      }
      const nodeId =
        typeof body.node_id === 'string' ? body.node_id.trim() : '';
      if (!nodeId) {
        return NextResponse.json({ error: 'node_id required' }, { status: 400 });
      }
      const emailRaw = data.email;
      const email =
        typeof emailRaw === 'string' && emailRaw.trim()
          ? emailRaw.trim().slice(0, 320)
          : null;
      const clientIp = getClientIpFromHeaders(request);
      const sb = createSupabaseServiceRoleClient();
      const insertRow = {
        user_id: null as string | null,
        suggestion_type: 'anonymous_feedback' as const,
        status: 'pending' as const,
        node_id: nodeId,
        data: { node_id: nodeId, message: msg, email },
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
        suggestionType: 'anonymous_feedback',
        isAnonymous: true,
        contributorIp: clientIp,
      });
      return NextResponse.json({ id }, { status: 201 });
    }

    if (suggestion_type === 'delete_link') {
      if (!user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      const linkId = typeof data.link_id === 'string' ? data.link_id.trim() : '';
      const sourceId =
        typeof data.source_id === 'string' ? data.source_id.trim() : '';
      const targetId =
        typeof data.target_id === 'string' ? data.target_id.trim() : '';
      if (!linkId || !sourceId || !targetId) {
        return NextResponse.json(
          { error: 'link_id, source_id, target_id required' },
          { status: 400 }
        );
      }
    }

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
