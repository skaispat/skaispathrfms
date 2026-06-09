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
    const { candidateName, candidatePhone, post } = await req.json()

    if (!candidateName || !candidatePhone || !post) {
      throw new Error("Missing required parameters")
    }

    // Clean phone number (remove spaces, '+', etc. Ensure it only has digits)
    const cleanedPhone = candidatePhone.replace(/\D/g, '')

    // Configuration for Meta WhatsApp Cloud API
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_ID')
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')

    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      throw new Error("WhatsApp environment variables are not set")
    }

    const payload = {
      messaging_product: "whatsapp",
      to: cleanedPhone,
      type: "template",
      template: {
        name: "job_whatsapp_sender", // Must match your template name exactly
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

    const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`, {
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
      JSON.stringify({ success: true, message: "WhatsApp notification sent successfully!" }),
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
