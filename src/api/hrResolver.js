import { supabase } from '../supabaseClient';

// Resolve the active HR who should receive a leave request.
// A real HR role wins over "works in HR department", non-HODs win over HODs,
// and the employee's own HOD is never returned, so hr_id never gets an HOD id.
// The emp_id sort keeps the pick deterministic across requests.
export const getActiveHr = async (excludeEmpId) => {
  const findHr = async (applyMatch) => {
    let query = applyMatch(
      supabase
        .from('users')
        .select('full_name, emp_id, phone_number, role, is_active')
        .eq('is_active', true)
        .not('emp_id', 'is', null)
    );
    if (excludeEmpId) query = query.neq('emp_id', excludeEmpId);

    const { data } = await query
      .order('is_hod', { ascending: true, nullsFirst: true })
      .order('emp_id', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data;
  };

  const hr =
    (await findHr((q) => q.ilike('role', 'hr'))) ||
    (await findHr((q) => q.eq('department', 'HR')));

  if (!hr) return null;
  return {
    ...hr,
    name: hr.full_name || 'HR',
    full_name: hr.full_name || 'HR',
    role: hr.role ? hr.role.toUpperCase() : 'HR',
  };
};
