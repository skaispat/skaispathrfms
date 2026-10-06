// Send WhatsApp message to employee when leave is approved
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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    console.log("Employee Phone:", employeePhone);

    if (!employeePhone) {
        console.error("Employee phone number is missing");
        return { success: false, error: "Employee phone number not provided" };
    }

    try {
        let url;
        if (supabaseUrl) {
            const base = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
            url = `${base}/functions/v1/send-whatsappMessage-employee-approved`;
        } else if (backendUrl) {
            const base = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
            url = `${base}/api/send-whatsappMessage-employee-approved`;
        } else {
            return { success: false, error: "Neither Supabase URL nor Backend URL is configured" };
        }

        console.log("Sending approved message to:", url);

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
                data.error?.message || data.error || "Failed to send approved message to employee"
            );
        }

        console.log("Leave approved message sent to employee:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending approved message to employee:", error);
        return { success: false, error: error.message };
    }
};

// Send WhatsApp message to employee when leave is rejected
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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    console.log("Employee Phone:", employeePhone);

    if (!employeePhone) {
        console.error("Employee phone number is missing");
        return { success: false, error: "Employee phone number not provided" };
    }

    try {
        let url;
        if (supabaseUrl) {
            const base = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
            url = `${base}/functions/v1/send-whatsappMessage-employee-rejected`;
        } else if (backendUrl) {
            const base = backendUrl.endsWith("/") ? backendUrl.slice(0, -1) : backendUrl;
            url = `${base}/api/send-whatsappMessage-employee-rejected`;
        } else {
            return { success: false, error: "Neither Supabase URL nor Backend URL is configured" };
        }

        console.log("Sending rejected message to:", url);

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
                data.error?.message || data.error || "Failed to send rejected message to employee"
            );
        }

        console.log("Leave rejected message sent to employee:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending rejected message to employee:", error);
        return { success: false, error: error.message };
    }
};
