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
    const baseUrl = import.meta.env.VITE_BACKEND_URL?.endsWith("/")
      ? import.meta.env.VITE_BACKEND_URL.slice(0, -1)
      : import.meta.env.VITE_BACKEND_URL;

    const url = `${baseUrl}/api/send-whatsappMessage-hod?employeId=${employeId}&tableid=${tableid}`;
    console.log("Sending WhatsApp request to:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
      throw new Error(data.error?.message || "Failed to send WhatsApp message");
    }

    console.log("WhatsApp message sent successfully:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return { success: false, error: error.message };
  }
};

export default sendWhatsappMessageToHod;
