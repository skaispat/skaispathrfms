import { supabase } from '../supabaseClient';

export const getAfterLeavingWorkData = async () => {
  const { data, error } = await supabase
    .from('employee_leaving')
    .select(`
      *,
      users (
        full_name,
        joining_date,
        designation,
        department
      )
    `);

  if (error) throw new Error(error.message);
  return data;
};

export const updateAfterLeavingWorkRecord = async (id, updates) => {
  const { data, error } = await supabase
    .from('employee_leaving')
    .update(updates)
    .eq('id', id);

  if (error) throw new Error(error.message);
  return data;
};
