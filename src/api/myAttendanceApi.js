import { supabase } from '../supabaseClient';

export const getMyAttendanceInitialData = async (empId, currentYear) => {
  const { data: userData } = await supabase
    .from('users')
    .select('week_off')
    .eq('emp_id', empId)
    .single();

  const { data: leavesData } = await supabase
    .from('leave_management')
    .select('leave_date_start, leave_date_end, status')
    .eq('emp_id', empId)
    .eq('status', 'Approved');

  const { data: dailyRecords } = await supabase
    .from('attendance_daily')
    .select('*')
    .eq('emp_id', empId)
    .gte('date', `${currentYear}-01-01`)
    .lte('date', `${currentYear}-12-31`);

  return {
    weekOff: userData?.week_off || null,
    userLeaves: leavesData || [],
    dailyRecords: dailyRecords || []
  };
};

export const markMyAttendancePunch = async (empId, dateStr, year, monthName, dayName, timeStr, fallbackName) => {
  const { data: fullUser } = await supabase.from('users').select('*').eq('emp_id', empId).single();

  const { data: existingRecord } = await supabase
    .from('attendance_daily')
    .select('*')
    .eq('emp_id', empId)
    .eq('date', dateStr)
    .maybeSingle();

  let upsertData = {
    emp_id: empId,
    date: dateStr,
    year: year,
    month_name: monthName,
    day: dayName,
    company_name: "SKAISPAT",
    name: fullUser?.full_name || fallbackName || `User ${empId}`,
    designation: fullUser?.designation || "-",
    holiday: "No",
    working_day: "Yes",
    n_holiday: "",
    status: "P",
  };

  if (existingRecord) {
    let workingHours = '0h 0m';
    let presentMinutes = 0;
    let overtimeHours = '0h 0m';
    let inTimeStr = existingRecord.in_time;

    if (inTimeStr) {
      const inDate = new Date(`${dateStr}T${inTimeStr}`);
      const outDate = new Date(`${dateStr}T${timeStr}`);
      const diffMs = outDate - inDate;
      if (diffMs > 0) {
        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        workingHours = `${h}h ${m}m`;
        presentMinutes = h * 60 + m;

        const nineHoursMs = 9 * 60 * 60 * 1000;
        if (diffMs > nineHoursMs) {
          const ot = diffMs - nineHoursMs;
          const otH = Math.floor(ot / 3600000);
          const otM = Math.floor((ot % 3600000) / 60000);
          overtimeHours = `${otH}h ${otM}m`;
        }
      }
    }

    upsertData = {
      ...existingRecord,
      ...upsertData,
      out_time: timeStr,
      punch_miss: "No",
      working_hours: workingHours,
      present_minutes: presentMinutes,
      early_out: "0",
      overtime_hours: overtimeHours,
      remarks: existingRecord.remarks ? (existingRecord.remarks.includes('Mobile') ? existingRecord.remarks : `${existingRecord.remarks}, Mobile Out`) : "Mobile Out"
    };
  } else {
    upsertData = {
      ...upsertData,
      in_time: timeStr,
      out_time: "",
      working_hours: "0h 0m",
      present_minutes: 0,
      early_out: "0",
      overtime_hours: "0h 0m",
      punch_miss: "Yes",
      remarks: "Mobile In"
    };
  }

  const { error } = await supabase
    .from('attendance_daily')
    .upsert([upsertData], { onConflict: "emp_id, date" });

  if (error) throw error;
  return upsertData;
};
