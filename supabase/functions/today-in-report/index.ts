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

    console.log("🕐 Today IN Report started (2 PM Job)");

    // Helper to format date DD/MM/YYYY
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    /* --------------------------------------------------
           1. Get TODAY's date (IST)
        -------------------------------------------------- */
    const getTodayIST = () => {
      const d = new Date().toLocaleString("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      return d; // YYYY-MM-DD
    };

    let targetDateStr = getTodayIST();

    try {
      const body = await req.json();
      if (body?.date) targetDateStr = body.date;
    } catch {
      // no body (cron trigger) - use today
    }

    console.log("📅 Target Date (Today):", targetDateStr);

    /* --------------------------------------------------
           2. Fetch users
        -------------------------------------------------- */
    const { data: users, error: userError } = await supabaseClient
      .from("users")
      .select("emp_id, full_name, designation");

    if (userError) throw userError;

    const targetEmpIds = users?.map((u: any) => u.emp_id) || [];

    console.log(`👥 Total target employees: ${targetEmpIds.length}`);

    /* --------------------------------------------------
           3. Fetch external API data for current year
        -------------------------------------------------- */
    const year = targetDateStr.split("-")[0];
    const apiUrl = `https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs?APIKey=341813122509&AccountName=SKAISPAT&FromDate=${year}-01-01&ToDate=${year}-12-31`;

    console.log("🌐 Fetching from API...");
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) throw new Error("External API failed");

    const apiData: any[] = await apiRes.json();
    console.log(`📊 API returned ${apiData.length} raw records`);

    /* --------------------------------------------------
           4. Filter only TODAY's data + only employees with IN time
        -------------------------------------------------- */
    // Group by UserId+date to process
    const grouped: Record<string, any> = {};

    for (const item of apiData) {
      // API uses UserId and LogDate fields
      if (!item.UserId || !targetEmpIds.includes(item.UserId)) continue;

      const rawDate = item.LogDate?.split("T")[0]; // YYYY-MM-DD
      if (rawDate !== targetDateStr) continue; // Only today's data

      const key = `${item.UserId}__${rawDate}`;

      if (!grouped[key]) {
        grouped[key] = {
          userId: item.UserId,
          date: rawDate,
          times: [],
        };
      }
      const ts = item.LogDate?.split("T")[1]?.substring(0, 5);
      if (ts) grouped[key].times.push(ts);
    }

    // Process data - only those with IN time
    const presentData: any[] = [];

    for (const key of Object.keys(grouped)) {
      const rec = grouped[key];
      const times = rec.times.sort();

      if (times.length === 0) continue; // No punch - skip

      const inTime = times[0];
      const outTime = times.length > 1 ? times[times.length - 1] : null;

      // Calculate working hours if out time exists
      let workingHours = "0.00";
      let overtimeHours = "0.00";

      if (outTime && inTime !== outTime) {
        const [inH, inM] = inTime.split(":").map(Number);
        const [outH, outM] = outTime.split(":").map(Number);
        const inMins = inH * 60 + inM;
        const outMins = outH * 60 + outM;
        const diffMins = outMins - inMins;

        if (diffMins > 0) {
          const hours = diffMins / 60;
          workingHours = hours.toFixed(2);
          if (hours > 8) {
            overtimeHours = (hours - 8).toFixed(2);
          }
        }
      }

      // Get employee name from users
      const user = users?.find((u: any) => u.emp_id === rec.userId);
      const dayName = new Date(rec.date).toLocaleDateString("en-US", {
        weekday: "short",
      });

      presentData.push({
        empId: rec.userId,
        name: user?.full_name || rec.userId,
        designation: user?.designation || "-",
        day: dayName,
        inTime: inTime || "-",
        outTime: outTime || "-",
        workingHours,
        overtimeHours,
        status: outTime ? "Present" : "In Only",
        remarks: outTime ? "" : "Out time pending",
      });
    }

    console.log(`✅ Employees with IN today: ${presentData.length}`);

    if (presentData.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No employees with IN time for " + targetDateStr,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    /* --------------------------------------------------
           5. Generate PDF
        -------------------------------------------------- */
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    // Title
    doc.setFontSize(16);
    doc.text("Today's Attendance - Employees with IN Time", 14, 15);

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
    });

    doc.text(`Generated on: ${genTimeStr}`, 14, 20);
    doc.text(`Date: ${formatDate(targetDateStr)}`, 14, 25);
    doc.text(`Employees with IN: ${presentData.length}`, 14, 30);

    // Table
    const tableHeaders = [
      "Emp ID",
      "Name",
      "Day",
      "In Time",
      "Out Time",
      "Working Hrs",
      "Status",
      "Remarks",
    ];

    autoTable(doc, {
      startY: 35,
      head: [tableHeaders],
      body: presentData.map((d: any) => [
        d.empId,
        d.name,
        d.day,
        d.inTime,
        d.outTime,
        d.workingHours,
        d.status,
        d.remarks,
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [34, 197, 94], // Green-500
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244], // Green-50
      },
      columnStyles: {
        1: { cellWidth: 35 }, // Name
        7: { cellWidth: 35 }, // Remarks
      },
    });

    const pdfBuffer = doc.output("arraybuffer");

    /* --------------------------------------------------
           6. Upload to Supabase Storage
        -------------------------------------------------- */
    const filenameDate = formatDate(targetDateStr).replace(/\//g, "-");

    const istNow = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    let fHours = istNow.getHours();
    const fAmPm = fHours >= 12 ? "PM" : "AM";
    fHours = fHours % 12;
    fHours = fHours ? fHours : 12;
    const fMins = String(istNow.getMinutes()).padStart(2, "0");
    const fSecs = String(istNow.getSeconds()).padStart(2, "0");

    const fileName = `TodayIN_${filenameDate}_Time_${fHours}-${fMins}-${fSecs}_${fAmPm}.pdf`;

    const { error: uploadError } = await supabaseClient.storage
      .from("attendance_docs")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabaseClient.storage
      .from("attendance_docs")
      .getPublicUrl(fileName);

    console.log("📄 PDF uploaded:", fileName);

    /* --------------------------------------------------
           7. Save DB record
        -------------------------------------------------- */
    const dbTimeStr = `${fHours}:${fMins} ${fAmPm}`;

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
    const WHATSAPP_PHONE = "9628483313"; // Can be made dynamic later
    const RECIPIENT_NAME = "Hr";

    const whatsappDate = formatDate(targetDateStr);

    try {
      console.log("📤 Sending Today-IN PDF via WhatsApp...");
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: dbData,
        pdfUrl: publicData.publicUrl,
        employeesWithIn: presentData.length,
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
