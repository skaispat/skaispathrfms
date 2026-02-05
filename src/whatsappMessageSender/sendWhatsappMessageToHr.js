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

    console.log("this function is called")
    const hrPhoneNumber = import.meta.env.VITE_HR_MOBILE_NUMBER;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    // Debug: Log env variables
    // sendWhatsappMessageToHr
    console.log('VITE_HR_MOBILE_NUMBER:', hrPhoneNumber);
    console.log('VITE_BACKEND_URL:', backendUrl);

    if (!hrPhoneNumber) {
        console.error('VITE_HR_MOBILE_NUMBER is not set in .env');
        return { success: false, error: 'HR phone number not configured' };
    }

    if (!backendUrl) {
        console.error('VITE_BACKEND_URL is not set in .env');
        return { success: false, error: 'Backend URL not configured' };
    }

    try {
        const baseUrl = backendUrl.endsWith("/")
            ? backendUrl.slice(0, -1)
            : backendUrl;

            console.log(baseUrl,"base url ")

        const url = `${baseUrl}/api/send-whatsappMessage-hr?employeId=${employeId}&tableid=${tableid}`;
        console.log("Sending WhatsApp request to HR:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
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
            throw new Error(data.error?.message || "Failed to send WhatsApp message to HR");
        }

        console.log("WhatsApp message sent to HR successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending WhatsApp message to HR:", error);
        return { success: false, error: error.message };
    }
};

export default sendWhatsappMessageToHr;

