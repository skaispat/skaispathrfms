import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Support both direct invocation and Supabase Database Webhook payloads
    const record = body.record || body;

    const candidateName = record.candidate_name || record.candidateName;
    const post = record.post;

    if (!candidateName || !post) {
      console.error("Payload received:", JSON.stringify(body));
      throw new Error("Missing required parameters. Make sure candidateName (or candidate_name) and post are provided.")
    }

    // HR Phone number hardcoded (assuming India country code +91)
    const hrPhone = "919407916514"

    // Configuration for Meta WhatsApp Cloud API
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_ID')
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')

    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      throw new Error("WhatsApp environment variables are not set")
    }

    const payload = {
      messaging_product: "whatsapp",
      to: hrPhone,
      type: "template",
      template: {
        name: "job_appl_send_hr", // Template name specified by user
        language: {
          code: "en"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: candidateName
              },
              {
                type: "text",
                text: post
              }
            ]
          }
        ]
      }
    }

    const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json()

    if (!response.ok) {
      console.error("WhatsApp API Error:", responseData)
      throw new Error(JSON.stringify(responseData))
    }

    return new Response(
      JSON.stringify({ success: true, message: "HR WhatsApp notification sent successfully!" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Function Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
