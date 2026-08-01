import { supabase } from '../supabaseClient';

export const getUsersForDailyAttendance = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("emp_id, full_name, designation ,users(full_name)");

  if (error) throw error;
  return data;
};

export const getAttendanceDailyRecords = async () => {
  const { data, error } = await supabase
    .from("attendance_daily")
    .select("*");

  if (error) {
    console.error("Error fetching DB data:", error);
  }
  return { data, error };
};

export const upsertAttendanceDailyBatch = async (batch) => {
  const { data, error } = await supabase
    .from("attendance_daily")
    .upsert(batch, { onConflict: "emp_id, date" });

  if (error) throw error;
  return data;
};

export const uploadDailyAttendanceReportPdf = async (fileName, pdfBlob) => {
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("attendance_docs")
    .upload(fileName, pdfBlob, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from("attendance_docs").getPublicUrl(fileName);

  return publicUrl;
};

export const triggerSaveDailyReportFunction = async (todayStr, publicUrl, timeStr) => {
  const { error: funcError } = await supabase.functions.invoke(
    "save-daily-report",
    {
      body: {
        date: todayStr,
        pdf_link: publicUrl,
        time: timeStr,
      },
    }
  );

  if (funcError) throw funcError;
};
