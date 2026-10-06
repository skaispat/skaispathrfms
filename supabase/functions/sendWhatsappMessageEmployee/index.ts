import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  sanitizeText,
  sendPayloadForWhatsappMessage,
  callWhatsAppApi,
  shouldNotifyAbhishek,
} from "../_shared/whatsapp.ts";

/**
 * Handle Leave Status Messages to Employee:
 * - Approved: template 'final_approval_user_template' (+ Abhishek alert if special employee)
 * - HR Rejected: template 'final_rejection_user_template'
 * - HOD Rejected: template 'hod_reject'
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = (url.searchParams.get("action") || body.action || "").toLowerCase();
    const pathname = url.pathname.toLowerCase();

    // Determine operation
    let operation = "approved";
    if (
      pathname.includes("hod-rejected") ||
      pathname.includes("hod_rejected") ||
      action === "hod-rejected" ||
      action === "hod_rejected"
    ) {
      operation = "hod-rejected";
    } else if (
      pathname.includes("rejected") ||
      action === "rejected" ||
      body.hrRemarks !== undefined
    ) {
      operation = "rejected";
    } else if (pathname.includes("approved") || action === "approved") {
      operation = "approved";
    }

    const {
      employeePhone,
      employeeName,
      leaveType,
      fromDate,
      toDate,
      totalDays,
      reason,
      hrRemarks,
    } = body;

    const phoneNumber = employeePhone;
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Missing employee phone number (employeePhone)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (operation === "approved") {
      console.log("Sending leave approved message to employee");
      const templateName = "final_approval_user_template";
      const templateLanguage = "en_US";

      const enhancedComponents = [
        {
          type: "body",
          parameters: [
            { type: "text", text: sanitizeText(employeeName) },
            { type: "text", text: sanitizeText(leaveType) },
            { type: "text", text: sanitizeText(fromDate) },
            { type: "text", text: sanitizeText(toDate) },
            { type: "text", text: sanitizeText(totalDays) },
            { type: "text", text: sanitizeText(reason) },
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
      console.log("Leave approved message sent:", responseData);

      // Check if we should also notify Abhishek
      if (shouldNotifyAbhishek(employeeName)) {
        console.log("Employee matches Abhishek notification list, sending additional message...");
        const abhishekPhone = Deno.env.get("MD_MOBILE_NUMBER") || Deno.env.get("ABHISHEK_NUMBER") || "8866666985";
        const abhishekTemplate = "final_approval_abhishek";

        const abhishekComponents = [
          {
            type: "body",
            parameters: [
              { type: "text", text: sanitizeText(employeeName) },
              { type: "text", text: sanitizeText(fromDate) },
              { type: "text", text: sanitizeText(toDate) },
            ],
          },
        ];

        const abhishekPayload = sendPayloadForWhatsappMessage(
          abhishekPhone,
          abhishekTemplate,
          templateLanguage,
          abhishekComponents
        );

        try {
          const abhishekResponse = await callWhatsAppApi(abhishekPayload);
          console.log("Abhishek notification sent:", abhishekResponse);
        } catch (abhishekError: any) {
          console.error(
            "WhatsApp API Error (Abhishek):",
            abhishekError.data || abhishekError.message
          );
          // Don't fail the main request if Abhishek notification fails
        }
      }

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (operation === "rejected") {
      console.log("Sending leave rejected message to employee");
      const templateName = "final_rejection_user_template";
      const templateLanguage = "en_US";

      const enhancedComponents = [
        {
          type: "body",
          parameters: [
            { type: "text", text: sanitizeText(employeeName) },
            { type: "text", text: sanitizeText(leaveType) },
            { type: "text", text: sanitizeText(fromDate) },
            { type: "text", text: sanitizeText(toDate) },
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
      console.log("Leave rejected message sent:", responseData);

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (operation === "hod-rejected") {
      console.log("Sending leave HOD rejected message to employee");
      const templateName = "hod_reject";
      const templateLanguage = "en_US";

      const enhancedComponents = [
        {
          type: "body",
          parameters: [
            { type: "text", text: sanitizeText(employeeName) }, // {{1}}
            { type: "text", text: "leave request" }, // {{2}}
            { type: "text", text: sanitizeText(leaveType) }, // {{3}}
            { type: "text", text: sanitizeText(fromDate) }, // {{4}}
            { type: "text", text: sanitizeText(toDate) }, // {{5}}
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
      console.log("Leave HOD rejected message sent:", responseData);

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown operation: ${operation}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
