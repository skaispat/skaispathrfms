import { supabase } from '../supabaseClient';

export const getAllUsersForLeaving = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
};

export const getEmployeeLeavingWithUsers = async () => {
  const { data, error } = await supabase
    .from('employee_leaving')
    .select(`
      *,
      users (
        emp_id,
        full_name,
        joining_date,
        designation,
        department,
        phone_number
      )
    `);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
};

export const insertEmployeeLeavingRecord = async (leavingRecord) => {
  const { data, error } = await supabase
    .from('employee_leaving')
    .insert([leavingRecord]);

  if (error) throw new Error(`Failed to insert into employee_leaving table: ${error.message}`);
  return data;
};
