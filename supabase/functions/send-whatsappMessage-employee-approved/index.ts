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

const ABHISHEK_NOTIFICATION_EMPLOYEES = [
  "Dinesh Yadav",
  "R.K Mahapatro",
  "Priti Sahu",
  "Dharmendar",
  "ASHISH SAHU",
  "RAGHUVENDRA PRASAD TIWARI",
  "Kartikesh Kumar Sinha",
  "Akash Agrawal",
  "Parth Sahu",
  "R.N Rawat",
  "P.C Rao",
  "Dilendra bhagat",
  "Kushal Rathod",
  "Pramod kumar sahu",
  "Sumit raj",
  "Hari om shukla",
  "Anant kumar Shukla",
  "Tekeshwar Sahu",
  "Punaram Niramalkar",
  "Mahendra",
  "Akash Pandilwar",
  "Gaurav Pathak",
  "Parmeshwer",
  "Radheshyam Vishwakarma",
  "Sanjiv Rathor",
  "Abhiraj Mishra",
  "Ranjeet",
  "Kapil Dwivedi",
  "Sunil",
  "Anitosh",
  "Pawan Sahu",
  "Rohini Jaiswal",
];

const shouldNotifyAbhishek = (employeeName?: string): boolean => {
  if (!employeeName) return false;
  const normalizedName = employeeName.toLowerCase().trim();
  return ABHISHEK_NOTIFICATION_EMPLOYEES.some(
    (name) =>
      normalizedName.includes(name.toLowerCase()) ||
      name.toLowerCase().includes(normalizedName)
  );
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
 * Function Name: send-whatsappMessage-employee-approved
 * Template: final_approval_user_template
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Sending leave approved message to employee");
    const body = await req.json().catch(() => ({}));

    const {
      employeePhone,
      employeeName,
      leaveType,
      fromDate,
      toDate,
      totalDays,
      reason,
    } = body;

    const phoneNumber = employeePhone;
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: "Missing employee phone number (employeePhone)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Check if we should also notify Abhishek / MD
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
        console.error("WhatsApp API Error (Abhishek):", abhishekError.data || abhishekError.message);
      }
    }

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
