import { supabase } from '../supabaseClient';

export const getEmployeeJoiningData = async () => {
  const { data, error } = await supabase
    .from('joining_form')
    .select(`
      *,
      after_joining (
        emp_id
      )
    `);
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
};

export const getEmployeeLeavingData = async () => {
  const { data, error } = await supabase
    .from('employee_leaving')
    .select(`
      *,
      users (
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
