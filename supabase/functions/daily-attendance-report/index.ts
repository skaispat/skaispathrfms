import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import autoTable from "https://esm.sh/jspdf-autotable@3.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log("🚀 Daily Attendance Report started");

    // Helper to format date DD/MM/YYYY
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
      }
      return dateStr;
    };

    /* --------------------------------------------------
           1. Resolve target date (YESTERDAY by default for night shift)
        -------------------------------------------------- */
    // Use IST timezone (Asia/Kolkata)
    const getYesterdayIST = () => {
      const now = new Date();
      // Subtract 1 day to get yesterday
      now.setDate(now.getDate() - 1);
      const d = now.toLocaleString("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      // en-CA returns YYYY-MM-DD
      return d;
    };

    // Default to YESTERDAY (for night shift employees)
    let targetDateStr = getYesterdayIST();

    try {
      const body = await req.json();
      if (body?.date) targetDateStr = body.date;
    } catch {
      // no body (cron trigger) - use yesterday
    }

    console.log("📅 Target Date (Yesterday):", targetDateStr);

    /* --------------------------------------------------
           2. Fetch users
        -------------------------------------------------- */
    const { data: users, error: userError } = await supabaseClient
      .from("users")
      .select("emp_id, full_name, designation");

    if (userError) throw userError;

    const userMap: Record<string, any> = {};
    users?.forEach((u) => (userMap[u.emp_id] = u));

    /* --------------------------------------------------
           3. Fetch swipe logs
        -------------------------------------------------- */
    const year = new Date().getFullYear();
    const apiUrl =
      `https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs` +
      `?APIKey=341813122509&AccountName=SKAISPAT` +
      `&FromDate=${year}-01-01&ToDate=${year}-12-31`;

    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) throw new Error("Failed to fetch logs");

    const rawLogs = await apiRes.json();

    /* --------------------------------------------------
           4. Group logs by user + date
        -------------------------------------------------- */
    const grouped: Record<string, any> = {};

    rawLogs.forEach((log: any) => {
      const dateStr = log.LogDate.split("T")[0];
      if (dateStr !== targetDateStr) return;

      const key = `${log.UserId}-${dateStr}`;
      if (!grouped[key]) {
        grouped[key] = {
          userId: log.UserId,
          date: dateStr,
          logs: [],
        };
      }
      grouped[key].logs.push(log.LogDate);
    });

    // Target Employee IDs
    const targetEmpIds = [
      "3",
      "219",
      "53",
      "1",
      "321",
      "200",
      "10",
      "11",
      "175",
      "16",
      "245",
      "233",
      "217",
      "152",
      "294",
      "261",
      "339",
      "283",
      "281",
      "363",
      "176",
      "238",
      "112",
      "170",
      "122",
      "104",
      "86",
      "235",
      "341",
      "246",
      "227",
      "242",
      "356",
      "172",
      "501",
      "504",
      "180",
      "199",
      "522",
      "519",
      "145",
      "78",
      "117",
      "191",
      "134",
      "275",
      "253",
    ];

    const processed = Object.values(grouped).map((item: any) => {
      item.logs.sort();

      const first = item.logs[0];
      const last = item.logs[item.logs.length - 1];

      const inTime = first?.split("T")[1];
      const outTime = item.logs.length > 1 ? last.split("T")[1] : "";

      let workingHours = "-";
      let overtimeHours = "0h 0m";

      if (outTime) {
        const start = new Date(first).getTime();
        const end = new Date(last).getTime();
        const diff = end - start;

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        workingHours = `${h}h ${m}m`;

        if (diff > 9 * 3600000) {
          const ot = diff - 9 * 3600000;
          overtimeHours = `${Math.floor(ot / 3600000)}h ${Math.floor(
            (ot % 3600000) / 60000,
          )}m`;
        }
      }

      const user = userMap[item.userId] || {};

      return {
        empId: user.emp_id || item.userId,
        name: user.full_name || "Unknown",
        designation: user.designation || "-",
        day: new Date(item.date).toLocaleDateString("en-US", {
          weekday: "long",
        }),
        inTime,
        outTime,
        workingHours,
        overtimeHours,
        status: "P",
        remarks: item.logs.length === 1 ? "Single Punch" : "",
      };
    });

    // Filter Present Users by Target IDs
    const presentData = processed.filter((d: any) =>
      targetEmpIds.includes(String(d.empId)),
    );

    // Calculate Absent Users (In Target List but NOT in Present Data)
    const presentIds = new Set(presentData.map((d: any) => String(d.empId)));
    const absentData =
      users?.filter(
        (u: any) =>
          targetEmpIds.includes(String(u.emp_id)) &&
          !presentIds.has(String(u.emp_id)),
      ) || [];

    if (presentData.length === 0 && absentData.length === 0) {
      return new Response(
        JSON.stringify({ message: "No relevant records for " + targetDateStr }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    /* --------------------------------------------------
           5. Generate PDF (Strictly matching Attendancedaily.jsx format)
        -------------------------------------------------- */
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Title
    doc.setFontSize(16);
    doc.text("Daily Attendance Logs", 14, 15);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100);

    const now = new Date();
    const genTimeStr = now.toLocaleString("en-GB", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }); // e.g. 25/12/2025, 01:20 pm

    doc.text(`Generated on: ${genTimeStr}`, 14, 20);
    doc.text(`Date: ${formatDate(targetDateStr)}`, 14, 25);
    doc.text(`Total Entries: ${presentData.length}`, 14, 30);

    // Table 1: Present Employees
    const tableHeaders = [
      "Date",
      "Emp ID",
      "Name",
      "Day",
      "In",
      "Out",
      "Hrs",
      "OT",
      "Status",
      "Holiday",
      "Remarks",
    ];

    autoTable(doc, {
      startY: 35,
      head: [tableHeaders],
      body: presentData.map((d: any) => [
        formatDate(targetDateStr), // Date
        d.empId,
        d.name,
        d.day,
        d.inTime || "-",
        d.outTime || "-",
        d.workingHours,
        d.overtimeHours,
        d.status,
        "No", // Holiday hardcoded as per frontend logic
        d.remarks,
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [79, 70, 229], // Indigo-600
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251], // Gray-50
      },
      columnStyles: {
        2: { cellWidth: 30 }, // Name
        10: { cellWidth: 40 }, // Remarks
      },
    });

    // Table 2: Absent Employees
    if (absentData.length > 0) {
      // Space between tables
      let currentY = (doc as any).previousAutoTable.finalY + 20;

      // Check if we need a new page
      if (currentY > 180) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(220, 38, 38); // Red title
      doc.text("Absent Employees", 14, currentY);

      // Metadata for Absent Section
      doc.setFontSize(10);
      doc.setTextColor(100);

      currentY += 6;
      doc.text(`Generated on: ${genTimeStr}`, 14, currentY);

      currentY += 5;
      doc.text(`Date: ${formatDate(targetDateStr)}`, 14, currentY);

      currentY += 5;
      doc.text(`Total Entries: ${absentData.length}`, 14, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Date", "Emp ID", "Name", "Designation", "Status"]],
        body: absentData.map((u: any) => [
          formatDate(targetDateStr),
          u.emp_id,
          u.full_name,
          u.designation || "-",
          "Absent",
        ]),
        theme: "grid",
        styles: {
          fontSize: 9,
          cellPadding: 2,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [220, 38, 38], // Red Header
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [254, 242, 242], // Light red bg
        },
      });
    }

    const pdfBuffer = doc.output("arraybuffer");

    /* --------------------------------------------------
           6. Upload to Supabase Storage
        -------------------------------------------------- */

    // Format filename: AttendanceData_DD-MM-YYYY_Time_HH-MM-SS_AM/PM.pdf
    const filenameDate = formatDate(targetDateStr).replace(/\//g, "-");

    const istNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    let fHours = istNow.getHours();
    const fAmPm = fHours >= 12 ? "PM" : "AM";
    fHours = fHours % 12;
    fHours = fHours ? fHours : 12;

    const fTimeStr = `${fHours}-${String(istNow.getMinutes()).padStart(2, "0")}-${String(istNow.getSeconds()).padStart(2, "0")}_${fAmPm}`;
    const fileName = `AttendanceData_${filenameDate}_Time_${fTimeStr}.pdf`;

    const { error: uploadError } = await supabaseClient.storage
      .from("attendance_docs")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabaseClient.storage
      .from("attendance_docs")
      .getPublicUrl(fileName);

    /* --------------------------------------------------
           7. Save DB record
        -------------------------------------------------- */
    const dbTimeStr = `${fHours}:${String(istNow.getMinutes()).padStart(2, "0")} ${fAmPm}`;

    const { data: dbData, error: dbError } = await supabaseClient
      .from("attendance_reports")
      .insert([
        {
          date: targetDateStr,
          pdf_link: publicData.publicUrl,
          time: dbTimeStr,
        },
      ])
      .select();

    if (dbError) throw dbError;

    /* --------------------------------------------------
           8. Send PDF via WhatsApp
        -------------------------------------------------- */
    const BACKEND_URL = "https://app.saloonmate.com";
    const WHATSAPP_PHONE = "8866666985"; // Can be made dynamic later
    const RECIPIENT_NAME = "Abhishek Sir"; // Can be made dynamic later

    // Format date for WhatsApp (DD/MM/YYYY)
    const whatsappDate = formatDate(targetDateStr);

    try {
      console.log("📤 Sending PDF via WhatsApp...");
      const whatsappResponse = await fetch(
        `${BACKEND_URL}/api/send-attendance-pdf-whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: WHATSAPP_PHONE,
            pdfUrl: publicData.publicUrl,
            recipientName: RECIPIENT_NAME,
            reportDate: whatsappDate,
          }),
        },
      );

      const whatsappResult = await whatsappResponse.json();
      console.log("✅ WhatsApp Response:", whatsappResult);
    } catch (whatsappError: any) {
      console.error(
        "⚠️ WhatsApp send failed (non-blocking):",
        whatsappError.message,
      );
      // Don't throw - WhatsApp failure shouldn't fail the whole function
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: dbData,
        pdfUrl: publicData.publicUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err: any) {
    console.error("❌ Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
