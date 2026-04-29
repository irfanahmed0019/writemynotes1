import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("damu-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
