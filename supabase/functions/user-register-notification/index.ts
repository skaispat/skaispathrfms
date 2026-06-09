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

        let fullName, phoneNumber;

        // Check if it's a Supabase Database Webhook payload (triggered on INSERT)
        if (body.type === 'INSERT' && body.record) {
            fullName = body.record.full_name;
            phoneNumber = body.record.phone_number;
        } else {
            // Direct invocation fallback
            fullName = body.full_name;
            phoneNumber = body.phone_number;
        }

        if (!fullName || !phoneNumber) {
            throw new Error("Missing required parameters (full_name, phone_number)")
        }

        // Clean phone number (remove spaces, '+', etc. Ensure it only has digits)
        let cleanedPhone = phoneNumber.replace(/\D/g, '')

        // Add 91 prefix if it's a 10-digit Indian number without country code
        if (!cleanedPhone.startsWith('91') && cleanedPhone.length === 10) {
            cleanedPhone = '91' + cleanedPhone
        }

        // Configuration for Meta WhatsApp Cloud API
        const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID')
        const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
        const WHATSAPP_ENDPOINT = Deno.env.get('WHATSAPP_ENDPOINT')

        if (!WHATSAPP_PHONE_ID || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_ENDPOINT) {
            throw new Error("WhatsApp environment variables are not set")
        }

        const payload = {
            messaging_product: "whatsapp",
            to: cleanedPhone,
            type: "template",
            template: {
                name: "user_register_notification", // Specified template name
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: fullName
                            }
                        ]
                    }
                ]
            }
        }

        // Use the WHATSAPP_ENDPOINT if provided, otherwise fallback to the default Facebook Graph API url
        const apiUrl = WHATSAPP_ENDPOINT.includes('messages')
            ? WHATSAPP_ENDPOINT
            : `${WHATSAPP_ENDPOINT.replace(/\/$/, '')}/${WHATSAPP_PHONE_ID}/messages`;

        const response = await fetch(apiUrl, {
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
