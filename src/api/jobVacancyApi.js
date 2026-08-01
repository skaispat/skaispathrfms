import { supabase } from '../supabaseClient';

export const getLatestIndentNumber = async () => {
  try {
    const { data } = await supabase.from('job_vacancy').select('indent_number').order('id', { ascending: false }).limit(1).single();
    const lastNum = data?.indent_number ? (parseInt(data.indent_number.match(/\d+/)?.[0]) || 0) : 0;
    return `REC-${String(lastNum + 1).padStart(2, '0')}`;
  } catch (e) {
    console.error(e);
    return 'REC-01';
  }
};

export const getJobVacancies = async () => {
  const { data, error } = await supabase.from('job_vacancy').select('*').order('id', { ascending: false });
  if (error) throw error;
  return data;
};

export const completeJobVacancy = async (id) => {
  const { error } = await supabase.from('job_vacancy').update({ status: 'Completed' }).eq('id', id);
  if (error) throw error;
};

export const deleteJobVacancy = async (id) => {
  const { error } = await supabase.from('job_vacancy').delete().eq('id', id);
  if (error) throw error;
};

export const saveJobVacancy = async (editingId, payload) => {
  if (editingId) {
    const { error } = await supabase.from('job_vacancy').update(payload).eq('id', editingId);
    if (error) throw error;
  } else {
    const indentNumber = await getLatestIndentNumber();
    const { error } = await supabase.from('job_vacancy').insert([{
      ...payload,
      timestamp: new Date().toISOString(),
      indent_number: indentNumber
    }]);
    if (error) throw error;
  }
};
