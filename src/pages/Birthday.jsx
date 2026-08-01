import React, { useState, useEffect } from 'react';
import {
  getEmployeesForBirthday,
  getBirthdayRecords,
  deleteBirthdayRecord,
  uploadBirthdayPhoto,
  insertBirthdayRecords,
  updateBirthdayRecord
} from '../api/birthdayApi';
import useAuthStore from '../store/authStore';
import { Search, Image as ImageIcon, Cake, Calendar, Gift, X, Plus, Trash2, Edit2, Upload, Check, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const Birthday = () => {
  const { user } = useAuthStore();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Bulk add state
  const [newEntries, setNewEntries] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const getUpcomingEvents = () => {
    const today = dayjs().startOf('day');
    const upcoming = [];

    records.forEach(record => {
      const empName = employees.find(emp => String(emp.emp_id) === String(record.emp_id))?.full_name || 'Unknown Employee';

      if (record.date_of_birth) {
        const dobMonth = dayjs(record.date_of_birth).month();
        const dobDate = dayjs(record.date_of_birth).date();
        let thisYearDob = dayjs().month(dobMonth).date(dobDate).startOf('day');

        if (thisYearDob.isBefore(today)) {
          thisYearDob = thisYearDob.add(1, 'year');
        }

        const diffDays = thisYearDob.diff(today, 'day');
        if (diffDays >= 0 && diffDays <= 7) {
          upcoming.push({ ...record, type: 'Birthday', targetDate: thisYearDob, diffDays, empName });
        }
      }

      if (record.aniversary) {
        const annMonth = dayjs(record.aniversary).month();
        const annDate = dayjs(record.aniversary).date();
        let thisYearAnn = dayjs().month(annMonth).date(annDate).startOf('day');

        if (thisYearAnn.isBefore(today)) {
          thisYearAnn = thisYearAnn.add(1, 'year');
        }

        const diffDays = thisYearAnn.diff(today, 'day');
        if (diffDays >= 0 && diffDays <= 7) {
          upcoming.push({ ...record, type: 'Anniversary', targetDate: thisYearAnn, diffDays, empName });
        }
      }
    });

    return upcoming.sort((a, b) => a.diffDays - b.diffDays);
  };

  const upcomingEvents = getUpcomingEvents();

  const futureEventsCount = upcomingEvents.filter(e => e.diffDays > 0).length;

  useEffect(() => {
    if (futureEventsCount > 1) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % futureEventsCount);
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [futureEventsCount]);

  const isAdmin = user?.role === 'admin' || user?.role === 'Admin' || user?.Admin === 'Yes' || user?.role === 'hr' || user?.role === 'HR';

  useEffect(() => {
    if (user) {
      fetchRecords();
      fetchEmployees();
    }
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const data = await getEmployeesForBirthday();
      if (data) setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await getBirthdayRecords();
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching birthdays/anniversaries:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await deleteBirthdayRecord(id);
      toast.success('Record deleted successfully');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Failed to delete record');
    }
  };

  const openAddModal = () => {
    setNewEntries([{ id: Date.now(), emp_id: '', date_of_birth: '', aniversary: '', photoFile: null, photoPreview: null }]);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewEntries([]);
  };

  const handleAddRow = () => {
    if (newEntries.length >= 10) {
      toast.error('You can only add up to 10 records at once.');
      return;
    }
    setNewEntries([...newEntries, { id: Date.now(), emp_id: '', date_of_birth: '', aniversary: '', photoFile: null, photoPreview: null }]);
  };

  const handleRemoveRow = (id) => {
    setNewEntries(newEntries.filter(entry => entry.id !== id));
  };

  const handleEntryChange = (id, field, value) => {
    if (field === 'emp_id' && value) {
      // Check if employee already exists in the database
      const alreadyInDb = records.some(r => String(r.emp_id) === String(value));
      // Check if employee is already selected in another row in the form
      const alreadyInNew = newEntries.some(entry => entry.id !== id && String(entry.emp_id) === String(value));

      if (alreadyInDb || alreadyInNew) {
        toast.error('This employee is already added to the list!');
        // Clear the selection
        setNewEntries(newEntries.map(entry => entry.id === id ? { ...entry, [field]: '' } : entry));
        return;
      }
    }
    setNewEntries(newEntries.map(entry => entry.id === id ? { ...entry, [field]: value } : entry));
  };

  const handleFileChange = (id, e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setNewEntries(newEntries.map(entry => entry.id === id ? { ...entry, photoFile: file, photoPreview: previewUrl } : entry));
  };

  const uploadPhoto = async (file) => {
    return await uploadBirthdayPhoto(file);
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Validate
      const validEntries = newEntries.filter(entry => entry.emp_id);
      if (validEntries.length === 0) {
        toast.error('Please select an employee for at least one record.');
        setUploading(false);
        return;
      }

      const recordsToInsert = [];

      for (const entry of validEntries) {
        let photoUrl = null;
        if (entry.photoFile) {
          try {
            photoUrl = await uploadPhoto(entry.photoFile);
          } catch (err) {
            console.error('Photo upload failed for an entry:', err);
            toast.error(`Failed to upload photo for one of the records`);
            continue; // Skip this one if photo fails, or we could let it proceed without photo
          }
        }

        recordsToInsert.push({
          emp_id: entry.emp_id,
          date_of_birth: entry.date_of_birth || null,
          aniversary: entry.aniversary || null,
          photo: photoUrl
        });
      }

      if (recordsToInsert.length > 0) {
        await insertBirthdayRecords(recordsToInsert);
        toast.success(`Successfully added ${recordsToInsert.length} records.`);
        closeAddModal();
        fetchRecords();
      }
    } catch (error) {
      console.error('Error adding records:', error);
      toast.error('Failed to add records.');
    } finally {
      setUploading(false);
    }
  };

  // Edit Handlers
  const openEditModal = (record) => {
    setEditingRecord({
      ...record,
      photoFile: null,
      photoPreview: record.photo || null
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingRecord(null);
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setEditingRecord({ ...editingRecord, photoFile: file, photoPreview: previewUrl });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRecord.emp_id) return;
    setUploading(true);
    try {
      let photoUrl = editingRecord.photo;
      if (editingRecord.photoFile) {
        photoUrl = await uploadPhoto(editingRecord.photoFile);
      }

      await updateBirthdayRecord(editingRecord.id, {
        emp_id: editingRecord.emp_id,
        date_of_birth: editingRecord.date_of_birth || null,
        aniversary: editingRecord.aniversary || null,
        photo: photoUrl
      });

      if (error) throw error;
      toast.success('Record updated successfully');
      closeEditModal();
      fetchRecords();
    } catch (error) {
      console.error('Error updating record:', error);
      toast.error('Failed to update record');
    } finally {
      setUploading(false);
    }
  };

  // Filtering Logic
  const today = dayjs();
  const todayMonthDate = today.format('MM-DD');

  const filteredRecords = records.filter(record => {
    const isBirthdayToday = record.date_of_birth && dayjs(record.date_of_birth).format('MM-DD') === todayMonthDate;
    const isAnniversaryToday = record.aniversary && dayjs(record.aniversary).format('MM-DD') === todayMonthDate;
    return isBirthdayToday || isAnniversaryToday;
  });

  const getEventTags = (record) => {
    const tags = [];
    const isBirthdayToday = record.date_of_birth && dayjs(record.date_of_birth).format('MM-DD') === todayMonthDate;
    const isAnniversaryToday = record.aniversary && dayjs(record.aniversary).format('MM-DD') === todayMonthDate;

    if (isBirthdayToday) tags.push({ label: "Today's Birthday", color: "bg-purple-100 text-purple-700 border-purple-200" });
    if (isAnniversaryToday) tags.push({ label: "Today's Anniversary", color: "bg-pink-100 text-pink-700 border-pink-200" });

    return tags;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return dayjs(dateString).format('DD MMM YYYY');
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-4 shrink-0 px-4 sm:px-6 pt-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight leading-tight truncate sm:whitespace-normal">Birthdays & Anniversaries</h1>
          <p className="text-slate-500 mt-1 text-xs sm:text-sm truncate">Celebrate special moments with the team</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowManageModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium text-xs sm:text-sm shrink-0 mt-0.5 sm:mt-0"
          >
            <Calendar size={16} />
            <span className="hidden sm:inline">Manage Records</span>
            <span className="sm:hidden">Manage</span>
          </button>
        )}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mx-4 sm:mx-6 mb-4 sm:mb-6">


        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-slate-50/30">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-4">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredRecords.length === 0 && upcomingEvents.filter(e => e.diffDays > 0).length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200 mx-auto max-w-lg mt-10">
                <Cake size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">No events found</h3>
                <p className="text-sm">There are no birthdays or anniversaries to show today or upcoming.</p>
              </div>
            ) : (
              <div className="flex flex-col xl:flex-row gap-6 xl:gap-8 items-start">

                {/* Main Grid */}
                <div className={`w-full ${upcomingEvents.filter(e => e.diffDays > 0).length > 0 ? 'xl:flex-[6]' : ''}`}>
                  {filteredRecords.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">Today's Events</h3>
                      <div className="flex flex-col gap-6">
                        {filteredRecords.map((record) => {
                          const empName = employees.find(emp => String(emp.emp_id) === String(record.emp_id))?.full_name || 'Unknown Employee';
                          const tags = getEventTags(record);

                          return (
                            <div key={record.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 overflow-hidden flex flex-col md:flex-row group relative">
                              {isAdmin && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <button onClick={() => openEditModal(record)} className="p-1.5 bg-white/90 backdrop-blur rounded-md text-slate-600 hover:text-indigo-600 shadow-sm border border-slate-200 transition-colors" title="Edit">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => handleDelete(record.id)} className="p-1.5 bg-white/90 backdrop-blur rounded-md text-slate-600 hover:text-red-600 shadow-sm border border-slate-200 transition-colors" title="Delete">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}

                              {/* LEFT SIDE: Photo */}
                              <div className="w-full md:w-[40%] shrink-0 bg-slate-50 relative flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 min-h-[200px]" onClick={() => record.photo && setSelectedPhoto(record.photo)}>
                                {record.photo ? (
                                  <img
                                    src={record.photo}
                                    alt={empName}
                                    className="w-full h-64 md:h-full md:absolute md:inset-0 object-contain p-4 cursor-pointer hover:scale-[1.02] transition-transform"
                                  />
                                ) : (
                                  <div className="w-full h-full absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
                                      <ImageIcon size={32} />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* RIGHT SIDE: Details */}
                              <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
                                <h2 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-violet-600 mb-2 tracking-tight">
                                  {tags.some(t => t.label.includes('Birthday')) ? "Today's Birthday!" : "Today's Anniversary!"}
                                </h2>
                                <h3 className="font-bold text-slate-800 text-2xl leading-tight">{empName}</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1">ID: {record.emp_id}</p>



                                <div className="w-full mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
                                  <div className="flex justify-between items-center text-base">
                                    <span className="text-slate-500 flex items-center gap-2"><Cake size={16} className="text-purple-400" /> Date of Birth</span>
                                    <span className="font-medium text-slate-900">{formatDate(record.date_of_birth)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-base">
                                    <span className="text-slate-500 flex items-center gap-2"><Gift size={16} className="text-pink-400" /> Anniversary</span>
                                    <span className="font-medium text-slate-900">{formatDate(record.aniversary)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {filteredRecords.length === 0 && (
                    <div className="flex flex-col justify-center items-center text-center py-8 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200 w-full min-h-[250px] xl:min-h-[420px]">
                      <Cake size={40} className="text-slate-300 mb-3" />
                      <p className="text-sm">No events today.</p>
                    </div>
                  )}
                </div>

                {/* Upcoming Events Section (40%) */}
                {upcomingEvents.filter(e => e.diffDays > 0).length > 0 && (
                  <div className="w-full xl:flex-[4] border-t xl:border-t-0 xl:border-l border-slate-200/60 pt-4 sm:pt-6 xl:pt-0 xl:pl-8">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 sm:mb-6 px-1 flex items-center gap-2">
                      <Calendar size={18} className="text-indigo-600" />
                      Upcoming Events
                    </h3>

                    {/* Auto-Slider Card */}
                    <div className="w-full sm:max-w-md xl:max-w-none">
                      {(() => {
                        const futureEvents = upcomingEvents.filter(e => e.diffDays > 0);
                        const record = futureEvents[currentSlide] || futureEvents[0];

                        return (
                          <React.Fragment key={currentSlide}>
                            <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }`}</style>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 xl:p-0 flex items-center xl:flex-col xl:items-stretch gap-4 xl:gap-0 relative overflow-hidden transition-all duration-300" style={{ animation: 'fadeSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                              {record.photo ? (
                                <img src={record.photo} alt={record.empName} className="w-12 h-12 xl:w-full xl:h-56 xl:rounded-none xl:border-0 rounded-lg border border-slate-100 shadow-sm object-cover shrink-0" />
                              ) : (
                                <div className="w-12 h-12 xl:w-full xl:h-56 xl:rounded-none xl:border-0 rounded-lg border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                                  <ImageIcon className="w-5 h-5 xl:w-12 xl:h-12 text-slate-300" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 xl:p-6 bg-white xl:border-t border-slate-100">
                                <p className="text-[10px] xl:text-xs font-bold text-indigo-600 uppercase tracking-wider mb-0.5 xl:mb-1.5">{record.type === 'Birthday' ? 'Upcoming Birthday' : 'Upcoming Anniversary'}</p>
                                <h4 className="font-bold text-slate-900 text-sm xl:text-xl truncate">{record.empName}</h4>
                                <p className="text-xs xl:text-sm text-slate-500 mt-0.5 xl:mt-2 flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3 xl:w-4 xl:h-4 text-slate-400" />
                                  {dayjs(record.targetDate).format('DD MMM YYYY')} • In {record.diffDays} Days
                                </p>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })()}

                      {upcomingEvents.filter(e => e.diffDays > 0).length > 1 && (
                        <div className="flex items-center gap-1.5 mt-4 px-1">
                          {upcomingEvents.filter(e => e.diffDays > 0).map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentSlide(idx)}
                              className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === idx ? 'bg-indigo-600 w-4' : 'bg-slate-200 w-1.5 hover:bg-slate-300'}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col my-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Add New Records</h2>
              <button onClick={closeAddModal} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar bg-slate-50">
              <form id="bulk-add-form" onSubmit={handleBulkSubmit} className="space-y-4">
                {newEntries.map((entry, index) => (
                  <div key={entry.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                    <div className="absolute -top-3 -left-3 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                      {index + 1}
                    </div>
                    {newEntries.length > 1 && (
                      <button type="button" onClick={() => handleRemoveRow(entry.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50" title="Remove row">
                        <Trash2 size={16} />
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start pt-2">
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Employee <span className="text-red-500">*</span></label>
                        <select
                          required
                          value={entry.emp_id}
                          onChange={(e) => handleEntryChange(entry.id, 'emp_id', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        >
                          <option value="">Select Employee</option>
                          {employees.map(emp => (
                            <option key={emp.emp_id} value={emp.emp_id}>{emp.full_name} ({emp.emp_id})</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={entry.date_of_birth}
                          onChange={(e) => handleEntryChange(entry.id, 'date_of_birth', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Anniversary</label>
                        <input
                          type="date"
                          value={entry.aniversary}
                          onChange={(e) => handleEntryChange(entry.id, 'aniversary', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Photo</label>
                        <div className="flex items-center gap-3">
                          {entry.photoPreview ? (
                            <img src={entry.photoPreview} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <ImageIcon size={16} />
                            </div>
                          )}
                          <label className="cursor-pointer flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors border border-slate-200 w-full text-center">
                            <Upload size={14} /> Upload
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(entry.id, e)} />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {newEntries.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-medium text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Add Another Record (Max 10)
                  </button>
                )}
              </form>
            </div>

            <div className="p-5 border-t border-slate-100 bg-white rounded-b-2xl flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={closeAddModal}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="bulk-add-form"
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                disabled={uploading}
              >
                {uploading ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Saving...</>
                ) : (
                  <><Check size={16} /> Save Records</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Edit Record</h2>
              <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Employee</label>
                <select
                  required
                  value={editingRecord.emp_id}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      const alreadyInDb = records.some(r => r.id !== editingRecord.id && String(r.emp_id) === String(value));
                      if (alreadyInDb) {
                        toast.error('This employee is already added to the list!');
                        return;
                      }
                    }
                    setEditingRecord({ ...editingRecord, emp_id: value });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.emp_id} value={emp.emp_id}>{emp.full_name} ({emp.emp_id})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={editingRecord.date_of_birth || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Anniversary</label>
                  <input
                    type="date"
                    value={editingRecord.aniversary || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, aniversary: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Photo</label>
                <div className="flex items-center gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {editingRecord.photoPreview ? (
                    <img src={editingRecord.photoPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-200 shadow-sm">
                      <Upload size={16} /> Change Photo
                      <input type="file" accept="image/*" className="hidden" onChange={handleEditFileChange} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                  disabled={uploading}
                >
                  {uploading ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Saving...</>
                  ) : (
                    <><Check size={16} /> Update Record</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Records Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden">
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-100 gap-4 shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={20} className="text-indigo-600" />
                  Manage Records
                  <span className="bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-sm font-semibold ml-2">{records.length}</span>
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search records..."
                    className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                </div>
                <button
                  onClick={() => {
                    setShowManageModal(false);
                    openAddModal();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium shrink-0"
                >
                  <Plus size={16} /> Add New
                </button>
                <button onClick={() => setShowManageModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-100 shrink-0 border border-slate-200">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content - List of Users */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {records.filter(record => {
                  const employeeName = employees.find(emp => String(emp.emp_id) === String(record.emp_id))?.full_name || '';
                  const searchLower = searchTerm.toLowerCase();
                  return employeeName.toLowerCase().includes(searchLower) || String(record.emp_id).includes(searchLower);
                }).map((record) => {
                  const empName = employees.find(emp => String(emp.emp_id) === String(record.emp_id))?.full_name || 'Unknown Employee';
                  return (
                    <div key={record.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-row group relative p-4 gap-4 items-center hover:border-indigo-300 transition-colors">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={() => { setShowManageModal(false); openEditModal(record); }} className="p-1.5 bg-white backdrop-blur rounded-md text-slate-600 hover:text-indigo-600 shadow-sm border border-slate-200 transition-colors" title="Edit">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => handleDelete(record.id)} className="p-1.5 bg-white backdrop-blur rounded-md text-slate-600 hover:text-red-600 shadow-sm border border-slate-200 transition-colors" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <div className="w-14 h-14 shrink-0 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200" onClick={() => record.photo && setSelectedPhoto(record.photo)}>
                        {record.photo ? (
                          <img src={record.photo} alt={empName} className="w-full h-full object-cover cursor-pointer" />
                        ) : (
                          <ImageIcon size={20} className="text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-10">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{empName}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">ID: {record.emp_id}</p>
                        <div className="mt-2 flex flex-col gap-1">
                          {record.date_of_birth && <p className="text-[11px] text-slate-600 flex items-center gap-1.5"><Cake size={10} className="text-purple-400 shrink-0" /> <span className="truncate">{formatDate(record.date_of_birth)}</span></p>}
                          {record.aniversary && <p className="text-[11px] text-slate-600 flex items-center gap-1.5"><Gift size={10} className="text-pink-400 shrink-0" /> <span className="truncate">{formatDate(record.aniversary)}</span></p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {records.filter(record => {
                  const employeeName = employees.find(emp => String(emp.emp_id) === String(record.emp_id))?.full_name || '';
                  const searchLower = searchTerm.toLowerCase();
                  return employeeName.toLowerCase().includes(searchLower) || String(record.emp_id).includes(searchLower);
                }).length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
                      <Search size={32} className="mx-auto text-slate-300 mb-3" />
                      <p>No records found matching "{searchTerm}".</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo View Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-lg w-full max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-12 right-0 text-white hover:text-red-400 transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full"
              onClick={() => setSelectedPhoto(null)}
            >
              <X size={24} />
            </button>
            <img
              src={selectedPhoto}
              alt="View"
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Birthday;
