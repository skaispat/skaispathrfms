import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const sanitizeText = (text: any): string => {
  if (text === null || text === undefined || text === "") return "N/A";
  return String(text)
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const formatPhoneNumber = (phone: string | number): string => {
  let clean = String(phone).replace(/\D/g, "");
  if (!clean.startsWith("91") && clean.length === 10) {
    clean = "91" + clean;
  }
  return clean;
};

const sendPayloadForWhatsappMessage = (
  phoneNumber: string | number,
  templateName: string,
  templateLanguage: string,
  components: any[]
) => {
  return {
    messaging_product: "whatsapp",
    to: formatPhoneNumber(phoneNumber),
    type: "template",
    template: {
      name: templateName,
      language: {
        code: templateLanguage,
      },
      components: components,
    },
  };
};

const callWhatsAppApi = async (payload: any) => {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID") || "968220743032443";
  const endpointEnv = Deno.env.get("WHATSAPP_ENDPOINT");

  let apiUrl: string;
  if (endpointEnv) {
    apiUrl = endpointEnv.endsWith("/messages")
      ? endpointEnv
      : `${endpointEnv.replace(/\/$/, "")}/messages`;
  } else {
    apiUrl = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("WhatsApp API Error:", data);
    const errorMsg = data.error?.message || JSON.stringify(data);
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
};

/**
 * Function Name: send-gatepass-whatsapp-hod
 * Template: gate_pass_hod_message
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Gate Pass HOD WhatsApp message sending...");
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const employeId = url.searchParams.get("employeId") || body.employeId || "";
    const tableid = url.searchParams.get("tableid") || body.tableid || "";

    const {
      whomtoSend,
      employeeName,
      department,
      leaveType,
      fromDate,
      toDate,
      totalDays,
      reason,
    } = body;

    const phoneNumber = whomtoSend;
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Missing recipient phone number (whomtoSend)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const templateName = "gate_pass_hod_message";
    const templateLanguage = "en_US";
    const dynamicLink = `gatepass-approve/${employeId}/${tableid}`;

    const enhancedComponents = [
      {
        type: "body",
        parameters: [
          { type: "text", text: sanitizeText("Gate Pass") }, // {{1}} Request type
          { type: "text", text: sanitizeText(employeeName) }, // {{2}} Employee name
          { type: "text", text: sanitizeText(department) }, // {{3}} Department
          { type: "text", text: sanitizeText(leaveType || "Gate Pass") }, // {{4}} Leave type
          { type: "text", text: sanitizeText(fromDate) }, // {{5}} From date
          { type: "text", text: sanitizeText(toDate) }, // {{6}} To date
          { type: "text", text: sanitizeText(totalDays || "N/A") }, // {{7}} Total days
          { type: "text", text: sanitizeText(reason) }, // {{8}} Reason
          { type: "text", text: sanitizeText("Gate Pass") }, // {{9}} Request type for button
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [
          {
            type: "text",
            text: dynamicLink,
          },
        ],
      },
    ];

    const payLoad = sendPayloadForWhatsappMessage(
      phoneNumber,
      templateName,
      templateLanguage,
      enhancedComponents
    );

    const responseData = await callWhatsAppApi(payLoad);
    console.log("Gate Pass HOD message sent:", responseData);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("WhatsApp API Error:", error.data || error.message);
    return new Response(
      JSON.stringify({ error: error.data || error.message }),
      {
        status: error.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
