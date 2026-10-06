import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  sanitizeText,
  sendPayloadForWhatsappMessage,
  callWhatsAppApi,
} from "../_shared/whatsapp.ts";

/**
 * Send WhatsApp Message to HR for Leave Approval
 * Template: hr_approve_new
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const employeId = url.searchParams.get("employeId") || body.employeId || "";
    const tableid = url.searchParams.get("tableid") || body.tableid || "";

    const {
      whomtoSend,
      employeeName,
      empId,
      department,
      leaveType,
      fromDate,
      toDate,
      totalDays,
      reason,
      who,
    } = body;

    const phoneNumber = whomtoSend;
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Missing recipient phone number (whomtoSend)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const templateName = "hr_approve_new";
    const templateLanguage = "en_US";
    const dynamicLink = `${employeId}/${tableid}`;

    const enhancedComponents = [
      {
        type: "body",
        parameters: [
          { type: "text", text: sanitizeText(employeeName) },
          { type: "text", text: sanitizeText(department) },
          { type: "text", text: sanitizeText(leaveType) },
          { type: "text", text: sanitizeText(fromDate) },
          { type: "text", text: sanitizeText(toDate) },
          { type: "text", text: sanitizeText(totalDays) },
          { type: "text", text: sanitizeText(reason) },
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
    console.log("✅ HR Leave WhatsApp Message Sent:", responseData);

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
