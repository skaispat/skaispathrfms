import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
        const webhookPayload = await req.json()

        // Handle webhook ping
        if (!webhookPayload.type && !webhookPayload.record) {
            return new Response('ok', { headers: corsHeaders })
        }

        const { type, record, old_record } = webhookPayload

        if (type !== 'UPDATE' || !record || !old_record) {
            throw new Error("Invalid webhook payload, expected UPDATE event on birthday table")
        }

        let sender_name = ""
        let event_type = ""

        // Check Birthday
        const oldSentBy = old_record.sent_by || ""
        const newSentBy = record.sent_by || ""
        if (oldSentBy !== newSentBy) {
            const oldArr = oldSentBy.split(',').map((s: string) => s.trim()).filter(Boolean)
            const newArr = newSentBy.split(',').map((s: string) => s.trim()).filter(Boolean)
            // Find the newly added name
            const newNames = newArr.filter((name: string) => !oldArr.includes(name))
            if (newNames.length > 0) {
                sender_name = newNames[0]
                event_type = 'Birthday'
            }
        }

        // Check Anniversary
        if (!sender_name) {
            const oldAnni = old_record.anni_sent_by || ""
            const newAnni = record.anni_sent_by || ""
            if (oldAnni !== newAnni) {
                const oldArr = oldAnni.split(',').map((s: string) => s.trim()).filter(Boolean)
                const newArr = newAnni.split(',').map((s: string) => s.trim()).filter(Boolean)
                const newNames = newArr.filter((name: string) => !oldArr.includes(name))
                if (newNames.length > 0) {
                    sender_name = newNames[0]
                    event_type = 'Anniversary'
                }
            }
        }

        if (!sender_name) {
            // No new sender found, no message to send
            return new Response(JSON.stringify({ success: true, message: "No new wishes found in this update." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        const receiver_emp_id = record.emp_id

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Supabase environment variables are missing.")
        }

        // Initialize Supabase Client with Service Role Key
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Fetch receiver's phone number from users table
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('phone_number')
            .eq('emp_id', receiver_emp_id)
            .single()

        if (userError || !user) {
            throw new Error(`Failed to fetch user phone number: ${userError?.message}`)
        }

        let phone = user.phone_number
        if (!phone) {
            throw new Error("Receiver does not have a phone number on file.")
        }

        // WhatsApp Meta API Setup
        const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID')
        const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
        const WHATSAPP_ENDPOINT = Deno.env.get('WHATSAPP_ENDPOINT')

        if (!WHATSAPP_PHONE_ID || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_ENDPOINT) {
            throw new Error("WhatsApp environment variables are missing.")
        }

        const apiUrl = WHATSAPP_ENDPOINT.includes('messages')
            ? WHATSAPP_ENDPOINT
            : `${WHATSAPP_ENDPOINT.replace(/\/$/, '')}/${WHATSAPP_PHONE_ID}/messages`;

        // Format phone number
        let cleanedPhone = phone.replace(/\D/g, '')
        if (!cleanedPhone.startsWith('91') && cleanedPhone.length === 10) {
            cleanedPhone = '91' + cleanedPhone
        }

        // Construct the single variable string for the template
        const messageText = event_type === 'Birthday'
            ? `Wish you Happy Birthday 🎂😊 from  ${sender_name}.`
            : `Wish you Happy Marriage Anniversary 🎉😊 from ${sender_name}.`

        const payload = {
            messaging_product: "whatsapp",
            to: cleanedPhone,
            type: "template",
            template: {
                name: "user_wish",
                language: {
                    code: "en"
                },
                components: [
                    {
                        type: "body",
                        parameters: [
                            { type: "text", text: messageText }
                        ]
                    }
                ]
            }
        }

        // Send to WhatsApp API
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const responseData = await response.json()
            console.error(`WhatsApp API Error for ${cleanedPhone}:`, responseData)
            throw new Error(`Failed to send to ${cleanedPhone}: ${JSON.stringify(responseData)}`)
        }

        return new Response(
            JSON.stringify({ success: true, message: "WhatsApp message sent successfully" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error("Function Execution Error:", error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
