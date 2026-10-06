import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  sendPayloadForWhatsappMessage,
  callWhatsAppApi,
} from "../_shared/whatsapp.ts";

/**
 * Send Attendance PDF via WhatsApp
 * Template: daily_attendance_attendance_to_abhi
 * Header: PDF Document
 * Body: {{1}} = Name, {{2}} = Date
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("📤 Sending Attendance PDF via WhatsApp...");
    const body = await req.json().catch(() => ({}));

    const {
      phoneNumber,
      pdfUrl,
      recipientName,
      reportDate,
    } = body;

    // Validation
    if (!phoneNumber || !pdfUrl || !recipientName || !reportDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: phoneNumber, pdfUrl, recipientName, reportDate",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const templateName = "daily_attendance_attendance_to_abhi";
    const templateLanguage = "en_US";

    // Build components for template with document header
    const components = [
      {
        type: "header",
        parameters: [
          {
            type: "document",
            document: {
              link: pdfUrl,
              filename: `Attendance_Report_${String(reportDate).replace(/\//g, "-")}.pdf`,
            },
          },
        ],
      },
      {
        type: "body",
        parameters: [
          {
            type: "text",
            text: recipientName, // {{1}}
          },
          {
            type: "text",
            text: reportDate, // {{2}}
          },
        ],
      },
    ];

    const payLoad = sendPayloadForWhatsappMessage(
      phoneNumber,
      templateName,
      templateLanguage,
      components
    );

    console.log("📋 WhatsApp Payload:", JSON.stringify(payLoad, null, 2));

    const responseData = await callWhatsAppApi(payLoad);
    console.log("✅ WhatsApp message sent successfully:", responseData);

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ WhatsApp API Error:", error.data || error.message);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.data || error.message,
      }),
      {
        status: error.status || 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
