import { supabase } from '../supabaseClient';

export const getCompanyCalendarEvents = async () => {
  const { data, error } = await supabase
    .from('company_calender')
    .select('*')
    .order('date', { ascending: true });

  if (error) throw error;
  return data;
};

export const addCompanyCalendarEvent = async (newEvent) => {
  const { data, error } = await supabase
    .from('company_calender')
    .insert([{
      ...newEvent,
      timestamp: new Date().toISOString()
    }]);

  if (error) throw error;
  return data;
};
