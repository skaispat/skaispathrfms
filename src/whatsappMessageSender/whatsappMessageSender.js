export const sendWhatsappMessageToHod = async ({
  employeId,
  tableid,
  hodPhoneNumber,
  employeeName,
  empId,
  department,
  leaveType,
  fromDate,
  toDate,
  totalDays,
  reason,
  who = "employee",
}) => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    let url;
    if (supabaseUrl) {
      const base = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
      url = `${base}/functions/v1/send-whatsappMessage-hod?employeId=${employeId}&tableid=${tableid}`;
    } else {
      const baseUrl = import.meta.env.VITE_BACKEND_URL?.endsWith("/")
        ? import.meta.env.VITE_BACKEND_URL.slice(0, -1)
        : import.meta.env.VITE_BACKEND_URL;
      url = `${baseUrl}/api/send-whatsappMessage-hod?employeId=${employeId}&tableid=${tableid}`;
    }

    console.log("Sending WhatsApp request to:", url);

    const headers = {
      "Content-Type": "application/json",
    };
    if (anonKey) {
      headers["apikey"] = anonKey;
      headers["Authorization"] = `Bearer ${anonKey}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        whomtoSend: hodPhoneNumber,
        employeeName: employeeName,
        empId: empId,
        department: department,
        leaveType: leaveType,
        fromDate: fromDate,
        toDate: toDate,
        totalDays: totalDays,
        reason: reason,
        who: who,
        employeId: employeId,
        tableid: tableid,
      }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Expected JSON but received:", text.substring(0, 100));
      throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || data.error || "Failed to send WhatsApp message");
    }

    console.log("WhatsApp message sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return { success: false, error: error.message };
  }
};

export default sendWhatsappMessageToHod;
