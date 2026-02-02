import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log("🕕 6 AM Attendance Sync started");

    /* --------------------------------------------------
           1. Fetch users for name mapping
        -------------------------------------------------- */
    const { data: users, error: userError } = await supabaseClient
      .from("users")
      .select("emp_id, full_name, designation");

    if (userError) throw userError;

    const userMap: Record<string, any> = {};
    users?.forEach((u) => (userMap[u.emp_id] = u));

    /* --------------------------------------------------
           2. Fetch swipe logs from external API
        -------------------------------------------------- */
    const year = new Date().getFullYear();
    const apiUrl =
      `https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs` +
      `?APIKey=341813122509&AccountName=SKAISPAT` +
      `&FromDate=${year}-01-01&ToDate=${year}-12-31`;

    console.log("📡 Fetching from external API...");
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) throw new Error("Failed to fetch logs from external API");

    const rawLogs = await apiRes.json();
    console.log(`📊 Received ${rawLogs.length} raw logs from API`);

    /* --------------------------------------------------
           3. Group logs by user + date
        -------------------------------------------------- */
    const grouped: Record<string, any> = {};

    rawLogs.forEach((log: any) => {
      const dateStr = log.LogDate.split("T")[0];
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

    /* --------------------------------------------------
           4. Process into attendance records
        -------------------------------------------------- */
    const processedData = Object.values(grouped).map((item: any) => {
      item.logs.sort();

      const first = item.logs[0];
      const last = item.logs[item.logs.length - 1];

      const inTime = first?.split("T")[1];
      const outTime = item.logs.length > 1 ? last.split("T")[1] : null;

      let workingHours = "";
      let presentMinutes = 0;
      let overtimeHours = "0h 0m";

      if (outTime) {
        const start = new Date(first).getTime();
        const end = new Date(last).getTime();
        const diff = end - start;

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        workingHours = `${h}h ${m}m`;
        presentMinutes = h * 60 + m;

        // Overtime (> 9 hours)
        if (diff > 9 * 3600000) {
          const ot = diff - 9 * 3600000;
          const otH = Math.floor(ot / 3600000);
          const otM = Math.floor((ot % 3600000) / 60000);
          overtimeHours = `${otH}h ${otM}m`;
        }
      }

      const dateObj = new Date(item.date);
      const user = userMap[item.userId] || {};

      return {
        emp_id: user.emp_id || item.userId,
        date: item.date,
        year: dateObj.getFullYear(),
        month_name: dateObj.toLocaleString("default", { month: "long" }),
        day: dateObj.toLocaleString("default", { weekday: "long" }),
        company_name: "SKAISPAT",
        name: user.full_name || `User ${item.userId}`,
        designation: user.designation || "-",
        holiday: "No",
        working_day: "Yes",
        n_holiday: "",
        status: "P",
        in_time: inTime,
        out_time: outTime || "",
        working_hours: workingHours,
        present_minutes: presentMinutes,
        early_out: "0",
        overtime_hours: overtimeHours,
        punch_miss: outTime ? "No" : "Yes",
        remarks: item.logs.length === 1 ? "Single Punch" : "",
      };
    });

    console.log(`🔄 Processing ${processedData.length} attendance records...`);

    /* --------------------------------------------------
           5. Upsert to Supabase in batches
        -------------------------------------------------- */
    const batchSize = 50;
    let successCount = 0;

    for (let i = 0; i < processedData.length; i += batchSize) {
      const batch = processedData.slice(i, i + batchSize);

      const { error } = await supabaseClient
        .from("attendance_daily")
        .upsert(batch, { onConflict: "emp_id, date" });

      if (error) {
        console.error(`❌ Batch ${i / batchSize + 1} failed:`, error);
        throw error;
      }

      successCount += batch.length;
      console.log(
        `✅ Synced batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`,
      );
    }

    const result = {
      success: true,
      message: `6 AM Sync completed successfully`,
      totalRecords: processedData.length,
      syncedAt: new Date().toISOString(),
    };

    console.log("🎉 6 AM Sync completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("❌ Sync Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
