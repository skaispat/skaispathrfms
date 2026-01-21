


export const sendWhatsappMessageToHod = async ({
  employeId,
  tableid,
  hodPhoneNumber,
  employeeName,
  who = "employee",
}) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/send-whatsappMessage-hod?employeId=${employeId}&tableid=${tableid}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whomtoSend: hodPhoneNumber,
          employeeName: employeeName,
          who: who,
        }),
      },
    );

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
