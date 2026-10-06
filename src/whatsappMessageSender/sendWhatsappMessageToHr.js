export const sendWhatsappMessageToHr = async ({
    employeId,
    tableid,
    employeeName,
    empId,
    department,
    leaveType,
    fromDate,
    toDate,
    totalDays,
    reason,
}) => {
    console.log("sendWhatsappMessageToHr called");
    const hrPhoneNumber = import.meta.env.VITE_HR_MOBILE_NUMBER;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    console.log('VITE_HR_MOBILE_NUMBER:', hrPhoneNumber);

    if (!hrPhoneNumber) {
        console.error('VITE_HR_MOBILE_NUMBER is not set in .env');
        return { success: false, error: 'HR phone number not configured' };
    }

    try {
        let url;
        if (supabaseUrl) {
            const base = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
            url = `${base}/functions/v1/send-whatsappMessage-hr?employeId=${employeId}&tableid=${tableid}`;
        } else if (backendUrl) {
            const base = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
            url = `${base}/api/send-whatsappMessage-hr?employeId=${employeId}&tableid=${tableid}`;
        } else {
            return { success: false, error: 'Neither Supabase URL nor Backend URL is configured' };
        }

        console.log("Sending WhatsApp request to HR:", url);

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
                whomtoSend: hrPhoneNumber,
                employeeName: employeeName,
                empId: empId,
                department: department,
                leaveType: leaveType,
                fromDate: fromDate,
                toDate: toDate,
                totalDays: totalDays,
                reason: reason,
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
            throw new Error(data.error?.message || data.error || "Failed to send WhatsApp message to HR");
        }

        console.log("WhatsApp message sent to HR successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending WhatsApp message to HR:", error);
        return { success: false, error: error.message };
    }
};

export default sendWhatsappMessageToHr;
