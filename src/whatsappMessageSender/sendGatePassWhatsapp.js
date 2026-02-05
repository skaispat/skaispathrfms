// Gate Pass specific WhatsApp message utilities
// These use the gate_pass_hod_message template instead of leave templates

// Send WhatsApp message to HOD for gate pass approval
export const sendGatePassMessageToHod = async ({
    employeId,
    tableid,
    whomtoSend,
    employeeName,
    department,
    leaveType,
    fromDate,
    toDate,
    totalDays,
    reason,
}) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    // sendGatePassMessageToHod
    console.log('VITE_BACKEND_URL:', backendUrl);
    console.log('Sending to HOD:', whomtoSend);

    if (!backendUrl) {
        console.error('VITE_BACKEND_URL is not set in .env');
        return { success: false, error: 'Backend URL not configured' };
    }

    try {
        const baseUrl = backendUrl.endsWith("/")
            ? backendUrl.slice(0, -1)
            : backendUrl;

        const url = `${baseUrl}/api/send-gatepass-whatsapp-hod?employeId=${employeId}&tableid=${tableid}`;
        console.log("Sending Gate Pass request to HOD:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                whomtoSend,
                employeeName,
                department,
                leaveType: leaveType || "Gate Pass",
                fromDate,
                toDate,
                totalDays: totalDays || "N/A",
                reason,
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
            throw new Error(data.error?.message || "Failed to send Gate Pass message to HOD");
        }

        console.log("Gate Pass message sent to HOD successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending Gate Pass message to HOD:", error);
        return { success: false, error: error.message };
    }
};

// Send WhatsApp message to HR for gate pass approval
export const sendGatePassMessageToHr = async ({
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
    const hrPhoneNumber = import.meta.env.VITE_HR_MOBILE_NUMBER;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    // sendGatePassMessageToHr
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

        const url = `${baseUrl}/api/send-gatepass-whatsapp-hr?employeId=${employeId}&tableid=${tableid}`;
        console.log("Sending Gate Pass request to HR:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                whomtoSend: hrPhoneNumber,
                employeeName,
                empId,
                department,
                leaveType: leaveType || "Gate Pass",
                fromDate,
                toDate,
                totalDays: totalDays || "N/A",
                reason,
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
            throw new Error(data.error?.message || "Failed to send Gate Pass message to HR");
        }

        console.log("Gate Pass message sent to HR successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending Gate Pass message to HR:", error);
        return { success: false, error: error.message };
    }
};

// Send approved Gate Pass message to employee
export const sendGatePassApprovedToEmployee = async ({
    employeePhone,
    employeeName,
    leaveType,
    fromDate,
    toDate,
    totalDays,
    reason,
}) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    // sendGatePassApprovedToEmployee
    console.log('VITE_BACKEND_URL:', backendUrl);
    console.log('Employee Phone:', employeePhone);

    if (!backendUrl) {
        console.error('VITE_BACKEND_URL is not set in .env');
        return { success: false, error: 'Backend URL not configured' };
    }

    if (!employeePhone) {
        console.error('Employee phone number is missing');
        return { success: false, error: 'Employee phone number not provided' };
    }

    try {
        const baseUrl = backendUrl.endsWith("/")
            ? backendUrl.slice(0, -1)
            : backendUrl;

        const url = `${baseUrl}/api/send-gatepass-whatsapp-employee-approved`;
        console.log("Sending Gate Pass approved message:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                employeePhone,
                employeeName,
                leaveType: leaveType || "Gate Pass",
                fromDate,
                toDate,
                totalDays: totalDays || "N/A",
                reason,
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
            throw new Error(data.error?.message || "Failed to send Gate Pass approved message");
        }

        console.log("Gate Pass approved message sent successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending Gate Pass approved message:", error);
        return { success: false, error: error.message };
    }
};

// Send rejected Gate Pass message to employee
export const sendGatePassRejectedToEmployee = async ({
    employeePhone,
    employeeName,
    leaveType,
    fromDate,
    toDate,
    totalDays,
    hrRemarks,
}) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    // sendGatePassRejectedToEmployee
    console.log('VITE_BACKEND_URL:', backendUrl);
    console.log('Employee Phone:', employeePhone);

    if (!backendUrl) {
        console.error('VITE_BACKEND_URL is not set in .env');
        return { success: false, error: 'Backend URL not configured' };
    }

    if (!employeePhone) {
        console.error('Employee phone number is missing');
        return { success: false, error: 'Employee phone number not provided' };
    }

    try {
        const baseUrl = backendUrl.endsWith("/")
            ? backendUrl.slice(0, -1)
            : backendUrl;

        const url = `${baseUrl}/api/send-gatepass-whatsapp-employee-rejected`;
        console.log("Sending Gate Pass rejected message:", url);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                employeePhone,
                employeeName,
                leaveType: leaveType || "Gate Pass",
                fromDate,
                toDate,
                totalDays: totalDays || "N/A",
                hrRemarks,
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
            throw new Error(data.error?.message || "Failed to send Gate Pass rejected message");
        }

        console.log("Gate Pass rejected message sent successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending Gate Pass rejected message:", error);
        return { success: false, error: error.message };
    }
};
