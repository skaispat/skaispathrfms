// Shared WhatsApp Utilities for Supabase Edge Functions

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Helper to sanitize text - removes newlines, tabs, and excessive spaces
export const sanitizeText = (text: any): string => {
  if (text === null || text === undefined || text === '') return 'N/A';
  return String(text)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Helper to clean and format Indian phone number with 91 prefix
export const formatPhoneNumber = (phone: string | number): string => {
  let clean = String(phone).replace(/\D/g, '');
  if (!clean.startsWith('91') && clean.length === 10) {
    clean = '91' + clean;
  }
  return clean;
};

// Builder for WhatsApp template payload
export const sendPayloadForWhatsappMessage = (
  phoneNumber: string | number,
  templateName: string,
  templateLanguage: string,
  components: any[],
) => {
  return {
    messaging_product: 'whatsapp',
    to: formatPhoneNumber(phoneNumber),
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: templateLanguage,
      },
      components: components,
    },
  };
};

// List of employees for which Abhishek should also receive notification on leave approval
export const ABHISHEK_NOTIFICATION_EMPLOYEES = [
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

// Helper to check if employee name matches any in Abhishek notification list (case-insensitive)
export const shouldNotifyAbhishek = (employeeName?: string): boolean => {
  if (!employeeName) return false;
  const normalizedName = employeeName.toLowerCase().trim();
  return ABHISHEK_NOTIFICATION_EMPLOYEES.some(
    (name) =>
      normalizedName.includes(name.toLowerCase()) ||
      name.toLowerCase().includes(normalizedName),
  );
};

// Helper to call WhatsApp Graph API
export const callWhatsAppApi = async (payload: any) => {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID') || '968220743032443';
  const endpointEnv = Deno.env.get('WHATSAPP_ENDPOINT');

  let apiUrl: string;
  if (endpointEnv) {
    apiUrl = endpointEnv.endsWith('/messages')
      ? endpointEnv
      : `${endpointEnv.replace(/\/$/, '')}/messages`;
  } else {
    apiUrl = `https://graph.facebook.com/v22.0/${phoneId}/messages`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('WhatsApp API Error:', data);
    const errorMsg = data.error?.message || JSON.stringify(data);
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
};
