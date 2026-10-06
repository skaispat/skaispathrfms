import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  sanitizeText,
  sendPayloadForWhatsappMessage,
  callWhatsAppApi,
} from "../_shared/whatsapp.ts";

/**
 * Gate Pass WhatsApp Notifications:
 * - HOD notification: template 'gate_pass_hod_message'
 * - HR notification: template 'gate_pass_hod_message'
 * - Employee approved: template 'gate_pass_final_approve_user'
 * - Employee rejected: template 'final_get_pass_rejection_user_template'
 * - Employee HOD rejected: template 'hod_reject'
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

    const employeId = url.searchParams.get("employeId") || body.employeId || "";
    const tableid = url.searchParams.get("tableid") || body.tableid || "";

    // Determine target operation
    let operation = "hod";
    if (
      pathname.includes("employee-hod-rejected") ||
      pathname.includes("hod_rejected") ||
      action === "employee-hod-rejected" ||
      action === "hod-rejected" ||
      body.requestType !== undefined
    ) {
      operation = "employee-hod-rejected";
    } else if (
      pathname.includes("employee-rejected") ||
      action === "employee-rejected" ||
      action === "rejected" ||
      body.hrRemarks !== undefined
    ) {
      operation = "employee-rejected";
    } else if (
      pathname.includes("employee-approved") ||
      action === "employee-approved" ||
      action === "approved"
    ) {
      operation = "employee-approved";
    } else if (
      pathname.includes("-hr") ||
      pathname.endsWith("/hr") ||
      action === "hr" ||
      (body.whomtoSend && body.empId !== undefined)
    ) {
      operation = "hr";
    } else if (
      pathname.includes("-hod") ||
      pathname.endsWith("/hod") ||
      action === "hod" ||
      body.whomtoSend !== undefined
    ) {
      operation = "hod";
    }

    const {
      whomtoSend,
      employeePhone,
      employeeName,
      department,
      leaveType,
      fromDate,
      toDate,
      totalDays,
      reason,
      requestType,
    } = body;

    // 1. Send to HOD
    if (operation === "hod") {
      console.log("Gate Pass HOD WhatsApp message sending...");
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
    }

    // 2. Send to HR
    if (operation === "hr") {
      console.log("Gate Pass HR WhatsApp message sending...");
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
            { type: "text", text: sanitizeText("Gate Pass") },
            { type: "text", text: sanitizeText(employeeName) },
            { type: "text", text: sanitizeText(department) },
            { type: "text", text: sanitizeText(leaveType || "Gate Pass") },
            { type: "text", text: sanitizeText(fromDate) },
            { type: "text", text: sanitizeText(toDate) },
            { type: "text", text: sanitizeText(totalDays || "N/A") },
            { type: "text", text: sanitizeText(reason) },
            { type: "text", text: sanitizeText("Gate Pass") },
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
      console.log("Gate Pass HR message sent:", responseData);
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Send Approved to Employee
    if (operation === "employee-approved") {
      console.log("Sending gate pass approved message to employee");
      const phoneNumber = employeePhone;
      if (!phoneNumber) {
        return new Response(
          JSON.stringify({ error: "Missing employee phone number (employeePhone)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const templateName = "gate_pass_final_approve_user";
      const templateLanguage = "en_US";

      const enhancedComponents = [
        {
          type: "body",
          parameters: [
            { type: "text", text: sanitizeText(employeeName) }, // {{1}}
            { type: "text", text: sanitizeText("Gate Pass") }, // {{2}}
            { type: "text", text: sanitizeText("Gate Pass") }, // {{3}}
            { type: "text", text: sanitizeText(leaveType || "Gate Pass") }, // {{4}}
            { type: "text", text: sanitizeText(fromDate) }, // {{5}}
            { type: "text", text: sanitizeText(toDate) }, // {{6}}
            { type: "text", text: sanitizeText(totalDays || "N/A") }, // {{7}}
            { type: "text", text: sanitizeText(reason) }, // {{8}}
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
      console.log("Gate pass approved message sent:", responseData);
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Send Rejected to Employee
    if (operation === "employee-rejected") {
      console.log("Sending gate pass rejected message to employee");
      const phoneNumber = employeePhone;
      if (!phoneNumber) {
        return new Response(
          JSON.stringify({ error: "Missing employee phone number (employeePhone)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const templateName = "final_get_pass_rejection_user_template";
      const templateLanguage = "en_US";

      const enhancedComponents = [
        {
          type: "body",
          parameters: [
            { type: "text", text: sanitizeText(employeeName) }, // {{1}}
            { type: "text", text: sanitizeText("Gate Pass") }, // {{2}}
            { type: "text", text: sanitizeText("Gate Pass") }, // {{3}}
            { type: "text", text: sanitizeText(leaveType || "Gate Pass") }, // {{4}}
            { type: "text", text: sanitizeText(fromDate) }, // {{5}}
            { type: "text", text: sanitizeText(toDate) }, // {{6}}
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
      console.log("Gate pass rejected message sent:", responseData);
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Send HOD Rejected to Employee
    if (operation === "employee-hod-rejected") {
      console.log("Sending gate pass HOD rejected message to employee");
      const phoneNumber = employeePhone;
      if (!phoneNumber) {
        return new Response(
          JSON.stringify({ error: "Missing employee phone number (employeePhone)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const templateName = "hod_reject";
      const templateLanguage = "en_US";

      const enhancedComponents = [
        {
          type: "body",
          parameters: [
            { type: "text", text: sanitizeText(employeeName) }, // {{1}}
            { type: "text", text: sanitizeText(requestType || "Gate Pass Request") }, // {{2}}
            { type: "text", text: sanitizeText(leaveType || "Gate Pass") }, // {{3}}
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
      console.log("Gate pass HOD rejected message sent:", responseData);
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
