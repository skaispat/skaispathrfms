import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const specialEmpIds = [
  "1", "175", "53", "219", "3", "233", "245", "341", "16", "294", "217", "152",
  "527", "501", "235", "504", "180", "321", "519", "242", "246", "518"
];

const sanitizeText = (text: string) => {
  if (!text) return "N/A";
  return String(text)
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("🔔 Webhook received:", payload);

    const { record, old_record, type } = payload;

    // We only care about Approved status changes
    if (type !== 'UPDATE' || record.status !== 'Approved' || old_record.status === 'Approved') {
      return new Response(JSON.stringify({ message: "Skipping: Not a valid status change to Approved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch Employee and HR details for better messaging
    const { data: employeeData } = await supabaseClient
      .from("users")
      .select("full_name, phone_number")
      .eq("emp_id", record.emp_id)
      .single();

    const employeeName = employeeData?.full_name || record.emp_name || "Employee";
    const employeePhone = record.employee_whatsapp_number || employeeData?.phone_number;
    const hrName = record.hr_name || "Pawan Tiwari";

    const formatDateTime = (dateStr: string) => {
      if (!dateStr) return 'N/A';
      return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const calculateDuration = (fromDate: string, toDate: string) => {
      if (!fromDate) return 'N/A';
      if (!toDate) return 'Same';
      const from = new Date(fromDate);
      const to = new Date(toDate);
      if (from.toDateString() === to.toDateString()) return 'Same';
      const diffMs = to.getTime() - from.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return String(diffDays);
    };

    const fromDate = formatDateTime(record.departure_from_plant);
    const toDate = record.arrival_at_plant ? formatDateTime(record.arrival_at_plant) : 'N/A';
    const duration = calculateDuration(record.departure_from_plant, record.arrival_at_plant);
    const reason = record.place_reason_to_visit || "N/A";

    // 1. Send to MD Sir if special employee
    if (specialEmpIds.includes(String(record.emp_id))) {
      const mdPhone = Deno.env.get("MD_MOBILE_NUMBER") || "8866666985";
      console.log(`👑 Special Employee detected! Sending alert to MD: ${mdPhone}`);

      await sendWhatsApp(
        mdPhone,
        "gate_pass_md_alert", // Template name set to gate_pass_md_alert
        [
          { type: "text", text: sanitizeText(`${employeeName} (ID: ${record.emp_id})`) },
          { type: "text", text: sanitizeText(fromDate) },
          { type: "text", text: sanitizeText(toDate) },
          { type: "text", text: sanitizeText(duration) },
          { type: "text", text: sanitizeText(reason) },
          { type: "text", text: sanitizeText(hrName) },
        ],
        "Gate Pass Approval", // Header text
        "en" // Language code
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

async function sendWhatsApp(to: string, templateName: string, parameters: any[], headerText?: string, languageCode: string = "en_US") {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID") || "968220743032443";

  // Use WHATSAPP_ENDPOINT if provided, otherwise construct it
  let endpoint = Deno.env.get("WHATSAPP_ENDPOINT");
  if (endpoint) {
    if (!endpoint.endsWith("/messages")) {
      endpoint = endpoint.endsWith("/") ? `${endpoint}messages` : `${endpoint}/messages`;
    }
  } else {
    endpoint = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  }

  // Ensure 91 prefix
  const cleanPhone = to.replace(/\D/g, '');
  const finalTo = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  const components: any[] = [
    {
      type: "body",
      parameters: parameters
    }
  ];

  if (headerText) {
    components.unshift({
      type: "header",
      parameters: [
        {
          type: "text",
          text: sanitizeText(headerText)
        }
      ]
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: finalTo,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components
    }
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`❌ WhatsApp API Error for ${templateName}:`, data);
    throw new Error(data.error?.message || "WhatsApp send failed");
  }
  console.log(`✅ WhatsApp sent: ${templateName} to ${finalTo}`);
  return data;
}
