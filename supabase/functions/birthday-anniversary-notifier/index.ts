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
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Supabase environment variables are missing.")
        }

        // Initialize Supabase Client with Service Role Key to bypass RLS for background jobs
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

        // Helper to send WhatsApp template messages
        async function sendWhatsAppMessage(phone: string, templateName: string, params: string[], imageUrl?: string) {
            let cleanedPhone = phone.replace(/\D/g, '')
            if (!cleanedPhone.startsWith('91') && cleanedPhone.length === 10) {
                cleanedPhone = '91' + cleanedPhone
            }

            const components: any[] = [
                {
                    type: "body",
                    parameters: params.map(text => ({ type: "text", text }))
                }
            ];

            if (imageUrl) {
                components.push({
                    type: "header",
                    parameters: [
                        {
                            type: "image",
                            image: {
                                link: imageUrl
                            }
                        }
                    ]
                });
            }

            const payload = {
                messaging_product: "whatsapp",
                to: cleanedPhone,
                type: "template",
                template: {
                    name: templateName,
                    language: {
                        code: "en"
                    },
                    components: components
                }
            }

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
                console.error(`WhatsApp API Error for ${cleanedPhone} (${templateName}):`, responseData)
                throw new Error(`Failed to send to ${cleanedPhone}: ${JSON.stringify(responseData)}`)
            }
        }

        // Get today's MM-DD for matching
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayMonthDay = `${mm}-${dd}`;

        // Fetch records from birthday table joined with users table
        const { data: records, error } = await supabase
            .from('birthday')
            .select(`
                id,
                emp_id,
                date_of_birth,
                aniversary,
                photo,
                users (
                    full_name,
                    department,
                    phone_number
                )
            `)

        if (error) {
            throw new Error(`Error fetching records: ${error.message}`)
        }

        // Hardcoded HR Number
        const hrPhone = "919407916514";
        const results = { birthdays: 0, anniversaries: 0, errors: [] };

        for (const record of records || []) {
            const user = Array.isArray(record.users) ? record.users[0] : record.users;
            if (!user) continue;

            const employeeName = user.full_name || 'Team Member';
            const department = user.department || 'Our';
            const employeePhone = user.phone_number;

            // Check Birthday Match
            if (record.date_of_birth && record.date_of_birth.endsWith(todayMonthDay)) {
                results.birthdays++;
                try {
                    // 1. Send to Employee
                    if (employeePhone) {
                        await sendWhatsAppMessage(employeePhone, 'birthday_wish', [employeeName, department], record.photo);
                    }

                    // 2. Send to HR (Same template as employee)
                    await sendWhatsAppMessage(hrPhone, 'birthday_wish', [employeeName, department], record.photo);
                } catch (e) {
                    results.errors.push(e.message)
                }
            }

            // Check Anniversary Match
            if (record.aniversary && record.aniversary.endsWith(todayMonthDay)) {
                results.anniversaries++;
                try {
                    // 1. Send to Employee (No image)
                    if (employeePhone) {
                        await sendWhatsAppMessage(employeePhone, 'anniversary_wish', [employeeName, department]);
                    }

                    // 2. Send to HR (No image, same template)
                    await sendWhatsAppMessage(hrPhone, 'anniversary_wish', [employeeName, department]);
                } catch (e) {
                    results.errors.push(e.message)
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Cron job completed successfully. Processed ${results.birthdays} birthdays and ${results.anniversaries} anniversaries.`,
                errors: results.errors
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error("Function Execution Error:", error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
