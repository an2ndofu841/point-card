import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ClaimRequest = {
  action: "claim";
  code: string;
  hpUserId: string;
};

type FetchRequest = {
  action: "fetch";
  groupId: number;
  hpUserId: string;
};

type RequestBody = ClaimRequest | FetchRequest;

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const apiKey = req.headers.get("x-api-key") || "";
  const expectedKey = Deno.env.get("LINK_API_KEY") || "";
  if (!expectedKey || apiKey !== expectedKey) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("PROJECT_URL") || "";
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { error: "missing_supabase_env" });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  if (body.action === "claim") {
    if (!body.code || !body.hpUserId) {
      return jsonResponse(400, { error: "missing_params" });
    }

    const { data, error } = await client.rpc("claim_user_link_code_external", {
      p_code: body.code,
      p_hp_user_id: body.hpUserId,
    });

    if (error) {
      return jsonResponse(400, { error: "claim_failed", detail: error.message });
    }

    const row = data?.[0] ?? null;
    return jsonResponse(200, {
      success: true,
      group_id: row?.out_group_id ?? null,
      point_user_id: row?.point_user_id ?? null,
    });
  }

  if (body.action === "fetch") {
    if (!body.groupId || !body.hpUserId) {
      return jsonResponse(400, { error: "missing_params" });
    }

    const [levelRes, trophyRes] = await Promise.all([
      client.rpc("get_linked_level_external", {
        p_group_id: body.groupId,
        p_hp_user_id: body.hpUserId,
      }),
      client.rpc("get_linked_trophies_external", {
        p_group_id: body.groupId,
        p_hp_user_id: body.hpUserId,
      }),
    ]);

    if (levelRes.error) {
      return jsonResponse(400, {
        error: "level_fetch_failed",
        detail: levelRes.error.message,
      });
    }

    if (trophyRes.error) {
      return jsonResponse(400, {
        error: "trophy_fetch_failed",
        detail: trophyRes.error.message,
      });
    }

    return jsonResponse(200, {
      success: true,
      level: levelRes.data?.[0] ?? null,
      trophies: trophyRes.data ?? [],
    });
  }

  return jsonResponse(400, { error: "invalid_action" });
});
