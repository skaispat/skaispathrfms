import { supabase } from '../supabaseClient';

export const getPayrollRecords = async () => {
  const { data, error } = await supabase
    .from('payroll')
    .select('*');

  if (error) throw new Error(error.message);
  return data;
};
