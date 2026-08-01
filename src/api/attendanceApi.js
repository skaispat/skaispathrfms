import { supabase } from '../supabaseClient';

export const getUsersForAttendance = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id, full_name, designation');

  if (error) throw error;
  return data;
};

export const upsertAttendanceSummaryBatch = async (batch) => {
  const { data, error } = await supabase
    .from('attendance_summary')
    .upsert(batch, { onConflict: 'emp_id, year, month' });

  if (error) throw error;
  return data;
};
