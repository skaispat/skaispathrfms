import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { jsPDF } from "npm:jspdf@2.5.1";
import "npm:jspdf-autotable@3.8.2";

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
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        console.log("🚀 Daily Attendance Report started");

        /* --------------------------------------------------
           1. Resolve target date (today OR request body)
        -------------------------------------------------- */
        let targetDateStr = new Date().toISOString().split("T")[0];

        try {
            const body = await req.json();
            if (body?.date) targetDateStr = body.date;
        } catch {
            // no body (cron trigger)
        }

        console.log("📅 Target Date:", targetDateStr);

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
                        (ot % 3600000) / 60000
                    )}m`;
                }
            }

            const user = userMap[item.userId] || {};

            return {
                empId: user.emp_id || item.userId,
                name: user.full_name || "Unknown",
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

        const data = processed.filter((d: any) => d.empId !== "EMP001");

        if (data.length === 0) {
            return new Response(
                JSON.stringify({ message: "No records for " + targetDateStr }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        /* --------------------------------------------------
           5. Generate PDF (Edge-safe)
        -------------------------------------------------- */
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4",
        });

        doc.setFontSize(16);
        doc.text("Daily Attendance Report", 14, 15);

        doc.setFontSize(10);
        doc.text(`Date: ${targetDateStr}`, 14, 22);
        doc.text(`Total Employees: ${data.length}`, 14, 28);

        (doc as any).autoTable({
            startY: 32,
            head: [["Emp ID", "Name", "Day", "In", "Out", "Hours", "OT", "Status", "Remarks"]],
            body: data.map((d: any) => [
                d.empId,
                d.name,
                d.day,
                d.inTime || "-",
                d.outTime || "-",
                d.workingHours,
                d.overtimeHours,
                d.status,
                d.remarks,
            ]),
            styles: { fontSize: 9 },
        });

        const pdfBuffer = doc.output("arraybuffer");

        /* --------------------------------------------------
           6. Upload to Supabase Storage
        -------------------------------------------------- */
        const fileName = `AutoReport_${targetDateStr}_${Date.now()}.pdf`;

        const { error: uploadError } = await supabaseClient.storage
            .from("attendance_docs")
            .upload(fileName, pdfBuffer, {
                contentType: "application/pdf",
            });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabaseClient.storage
            .from("attendance_docs")
            .getPublicUrl(fileName);

        /* --------------------------------------------------
           7. Save DB record
        -------------------------------------------------- */
        const now = new Date();
        const timeStr = `${now.getHours()}:${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;

        const { data: dbData, error: dbError } = await supabaseClient
            .from("attendance_reports")
            .insert([
                {
                    date: targetDateStr,
                    pdf_link: publicData.publicUrl,
                    time: timeStr,
                },
            ])
            .select();

        if (dbError) throw dbError;

        return new Response(JSON.stringify({ success: true, data: dbData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err: any) {
        console.error("❌ Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
