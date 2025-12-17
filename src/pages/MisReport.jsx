import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { RefreshCw } from 'lucide-react';

const MisReport = () => {
  const [peopleData, setPeopleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch data from Supabase mis_report table
      const { data, error } = await supabase
        .from('mis_report')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      // Process the data
      const processedData = processSupabaseData(data);
      setPeopleData(processedData);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const processSupabaseData = (data) => {
    if (!data || data.length === 0) return [];

    return data.map((row, index) => {
      // Generate avatar based on name
      const name = row.name || '';
      const avatar = name && name.trim() !== '' ?
        (name.split(' ').length > 1 ?
          `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`.toUpperCase() :
          name[0].toUpperCase()) :
        '👤';

      return {
        id: row.id,
        name: row.name,
        dateStart: row.date_start ? new Date(row.date_start).toLocaleDateString() : '',
        dateEnd: row.date_end ? new Date(row.date_end).toLocaleDateString() : '',
        target: row.target || '',
        actualWorkDone: row.actual_work_done || '',
        weeklyWorkDone: row.weekly_work_done_percent || '',
        weeklyWorkDoneOnTime: row.weekly_work_done_on_time_percent || '',
        totalWorkDone: row.total_work_done || 0,
        weekPending: row.week_pending || '',
        allPendingTillDate: row.all_pending_till_date || '',
        avatar
      };
    });
  };

  const TotalDoneWork = ({ weeks }) => {
    const getColor = (weeks) => {
      if (weeks === 1) return 'bg-green-100 text-green-800 border-green-200';
      if (weeks === 2) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      if (weeks === 3) return 'bg-orange-100 text-orange-800 border-orange-200';
      return 'bg-red-100 text-red-800 border-red-200';
    };

    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getColor(weeks)}`}>
        {weeks}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-500 font-medium">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="text-red-500 text-xl font-semibold mb-2">Error Loading Data</div>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">MIS Report</h1>
          <p className="text-slate-500 mt-1 text-sm">Overview of work performance and targets.</p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm flex items-center font-medium"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">DATE START</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">DATE END</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">NAME</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">TARGET</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">ACTUAL WORK</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">WEEKLY DONE %</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">ON TIME %</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">TOTAL WORK</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">WEEK PENDING</th>
                <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs whitespace-nowrap">ALL PENDING</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {peopleData.length > 0 ? (
                peopleData.map((person, index) => (
                  <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">{person.dateStart}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">{person.dateEnd}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-9 w-9">
                          <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold border border-indigo-200">
                            {person.avatar}
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-900">{person.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">{person.target}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {person.actualWorkDone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {person.weeklyWorkDone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {person.weeklyWorkDoneOnTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TotalDoneWork weeks={person.totalWorkDone} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {person.weekPending}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                      {person.allPendingTillDate}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-slate-400">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MisReport;