// Send WhatsApp message to employee when gate pass is approved
export const sendApprovedMessageToEmployee = async ({
    employeePhone,
    employeeName,
    leaveType,
    fromDate,
    toDate,
    totalDays,
    reason,
}) => {
    console.log("sendApprovedMessageToEmployee called");
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    console.log("VITE_BACKEND_URL:", backendUrl);
    console.log("Employee Phone:", employeePhone);

    if (!backendUrl) {
        console.error("VITE_BACKEND_URL is not set in .env");
        return { success: false, error: "Backend URL not configured" };
    }

    if (!employeePhone) {
        console.error("Employee phone number is missing");
        return { success: false, error: "Employee phone number not provided" };
    }

    try {
        const baseUrl = backendUrl.endsWith("/")
            ? backendUrl.slice(0, -1)
            : backendUrl;

        const url = `${baseUrl}/api/send-whatsappMessage-employee-approved`;
        console.log("Sending approved message to:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                employeePhone,
                employeeName,
                leaveType,
                fromDate,
                toDate,
                totalDays,
                reason,
            }),
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error("Expected JSON but received:", text.substring(0, 100));
            throw new Error(
                `Server returned non-JSON response: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error?.message || "Failed to send approved message to employee"
            );
        }

        console.log("Gate pass approved message sent to employee:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending approved message to employee:", error);
        return { success: false, error: error.message };
    }
};

// Send WhatsApp message to employee when gate pass is rejected
export const sendRejectedMessageToEmployee = async ({
    employeePhone,
    employeeName,
    leaveType,
    fromDate,
    toDate,
    totalDays,
    hrRemarks,
}) => {
    console.log("sendRejectedMessageToEmployee called");
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    console.log("VITE_BACKEND_URL:", backendUrl);
    console.log("Employee Phone:", employeePhone);

    if (!backendUrl) {
        console.error("VITE_BACKEND_URL is not set in .env");
        return { success: false, error: "Backend URL not configured" };
    }

    if (!employeePhone) {
        console.error("Employee phone number is missing");
        return { success: false, error: "Employee phone number not provided" };
    }

    try {
        const baseUrl = backendUrl.endsWith("/")
            ? backendUrl.slice(0, -1)
            : backendUrl;

        const url = `${baseUrl}/api/send-whatsappMessage-employee-rejected`;
        console.log("Sending rejected message to:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                employeePhone,
                employeeName,
                leaveType,
                fromDate,
                toDate,
                totalDays,
                hrRemarks,
            }),
        });

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error("Expected JSON but received:", text.substring(0, 100));
            throw new Error(
                `Server returned non-JSON response: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error?.message || "Failed to send rejected message to employee"
            );
        }

        console.log("Gate pass rejected message sent to employee:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending rejected message to employee:", error);
        return { success: false, error: error.message };
    }
};
