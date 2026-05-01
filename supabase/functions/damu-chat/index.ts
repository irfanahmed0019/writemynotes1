import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ---- Auth + daily rate limit ----
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Read daily limit setting
    const { data: limitRow } = await admin
      .from("app_settings").select("value").eq("key", "damu_daily_limit").maybeSingle();
    const dailyLimit: number = (limitRow?.value as any)?.limit ?? 30;

    const today = new Date().toISOString().slice(0, 10);
    const { data: usageRow } = await admin
      .from("damu_usage").select("count").eq("user_id", user.id).eq("day", today).maybeSingle();
    const used = usageRow?.count ?? 0;

    if (used >= dailyLimit) {
      // Time until next UTC midnight
      const now = new Date();
      const nextReset = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0
      ));
      const secondsUntilReset = Math.max(0, Math.floor((nextReset.getTime() - now.getTime()) / 1000));
      return new Response(JSON.stringify({
        error: "Daily chat limit reached",
        code: "RATE_LIMIT",
        used, limit: dailyLimit, reset_at: nextReset.toISOString(), seconds_until_reset: secondsUntilReset,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Increment counter (upsert)
    await admin.from("damu_usage").upsert({
      user_id: user.id, day: today, count: used + 1, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,day" });

    const systemPrompt = `You are Damu, a friendly and fun chatbot assistant for WriteMyNotes — a student marketplace app. You speak in both English and Manglish (a mix of Malayalam and English, like how Kerala students talk casually).

Your personality:
- Friendly, casual, Gen-Z vibe
- Use Manglish naturally (mix Malayalam words/phrases with English). Examples: "Enthaa mone/mole, help veno?", "Adipoli!", "Pwoli sanam!", "Seri seri", "Kidu", "Mathi", "Kashtam aanu but I'll help you"
- Use emojis occasionally 😄
- Keep responses short and helpful (2-4 sentences max)

You help users navigate the app:
- **Marketplace/Home**: Browse and search writing requests posted by students
- **Post (+)**: Create a new request for handwritten notes/assignments
- **Chat (DM icon)**: Message writers about your requests
- **Activity**: See who's interested in your posts
- **Study**: Access subject notes and papers
- **Profile**: Update your name, bio, writing samples
- **Install**: Install the app on your phone's home screen

Key features:
- Students post requests with title, subject, budget (₹), pages, deadline
- Writers can show interest and chat with the poster
- Study section has subject-wise notes written by admins
- The app is a PWA that can be installed

If someone asks something you don't know about the app, be honest and suggest they check the relevant section.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit, try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Damu-Used": String(used + 1),
        "X-Damu-Limit": String(dailyLimit),
      },
    });
  } catch (e) {
    console.error("damu-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
