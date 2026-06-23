import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import useAuthStore from '../store/authStore';
import { Search, Image as ImageIcon, Cake, Calendar, Gift, X, Plus, Trash2, Edit2, Upload, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

const Birthday = () => {
  const { user } = useAuthStore();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('today');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Bulk add state
  const [newEntries, setNewEntries] = useState([]);
  const [uploading, setUploading] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'Admin' || user?.Admin === 'Yes' || user?.role === 'hr' || user?.role === 'HR';

  useEffect(() => {
    if (user) {
      fetchRecords();
      fetchEmployees();
    }
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('emp_id, full_name');
      if (error) throw error;
      if (data) setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('birthday')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
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
      const { error } = await supabase.from('birthday').delete().eq('id', id);
      if (error) throw error;
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
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `birthdays/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('images').getPublicUrl(filePath);
    return data.publicUrl;
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
        const { error } = await supabase.from('birthday').insert(recordsToInsert);
        if (error) throw error;
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

      const { error } = await supabase.from('birthday').update({
        emp_id: editingRecord.emp_id,
        date_of_birth: editingRecord.date_of_birth || null,
        aniversary: editingRecord.aniversary || null,
        photo: photoUrl
      }).eq('id', editingRecord.id);

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
    const employeeName = employees.find(emp => String(emp.emp_id) === String(record.emp_id))?.full_name || '';
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = employeeName.toLowerCase().includes(searchLower) || String(record.emp_id).includes(searchLower);

    if (!matchesSearch) return false;

    if (activeTab === 'today') {
      const isBirthdayToday = record.date_of_birth && dayjs(record.date_of_birth).format('MM-DD') === todayMonthDate;
      const isAnniversaryToday = record.aniversary && dayjs(record.aniversary).format('MM-DD') === todayMonthDate;
      return isBirthdayToday || isAnniversaryToday;
    }

    return true; // For 'all' tab
  });

  const getEventTags = (record) => {
    const tags = [];
    const isBirthdayToday = record.date_of_birth && dayjs(record.date_of_birth).format('MM-DD') === todayMonthDate;
    const isAnniversaryToday = record.aniversary && dayjs(record.aniversary).format('MM-DD') === todayMonthDate;

    if (activeTab === 'today') {
      if (isBirthdayToday) tags.push({ label: "Today's Birthday", color: "bg-purple-100 text-purple-700 border-purple-200" });
      if (isAnniversaryToday) tags.push({ label: "Today's Anniversary", color: "bg-pink-100 text-pink-700 border-pink-200" });
    } else {
      if (record.date_of_birth) tags.push({ label: "Birthday", color: "bg-indigo-50 text-indigo-700 border-indigo-100" });
      if (record.aniversary) tags.push({ label: "Anniversary", color: "bg-rose-50 text-rose-700 border-rose-100" });
    }
    return tags;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return dayjs(dateString).format('DD MMM YYYY');
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-4 sm:px-6 pt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Birthdays & Anniversaries</h1>
          <p className="text-slate-500 mt-1 text-sm">Celebrate special moments with the team</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
          >
            <Plus size={16} />
            Add Records
          </button>
        )}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col mx-4 sm:mx-6 mb-4 sm:mb-6">
        {/* Toolbar: Tabs & Search */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100/50 rounded-lg border border-slate-200/50 w-max">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === "today"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              onClick={() => setActiveTab("today")}
            >
              <Gift size={16} className="inline mr-2" />
              Today's Events
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === "today" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>
                {records.filter(r => (r.date_of_birth && dayjs(r.date_of_birth).format('MM-DD') === todayMonthDate) || (r.aniversary && dayjs(r.aniversary).format('MM-DD') === todayMonthDate)).length}
              </span>
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === "all"
                ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              onClick={() => setActiveTab("all")}
            >
              <Calendar size={16} className="inline mr-2" />
              All Records
              <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${activeTab === "all" ? "bg-indigo-50 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>
                {records.length}
              </span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-sm w-full">
            <input
              type="text"
              placeholder="Search by name or Employee ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-slate-50/30">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-4">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200 mx-auto max-w-lg mt-10">
                <Cake size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">No events found</h3>
                <p className="text-sm">There are no matching records for the current view.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredRecords.map((record) => {
                  const empName = employees.find(emp => String(emp.emp_id) === String(record.emp_id))?.full_name || 'Unknown Employee';
                  const tags = getEventTags(record);

                  return (
                    <div key={record.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-slate-200 overflow-hidden flex flex-col group relative">
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

                      <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                      <div className="px-5 pb-5 flex-1 flex flex-col items-center -mt-12 relative">
                        {record.photo ? (
                          <img
                            src={record.photo}
                            alt={empName}
                            onClick={() => setSelectedPhoto(record.photo)}
                            className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover bg-white cursor-pointer"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-slate-100 flex items-center justify-center text-slate-400">
                            <ImageIcon size={32} />
                          </div>
                        )}

                        <h3 className="mt-3 font-bold text-slate-900 text-lg text-center leading-tight">{empName}</h3>
                        <p className="text-xs font-medium text-slate-500 mt-1">ID: {record.emp_id}</p>

                        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                          {tags.map((tag, idx) => (
                            <span key={idx} className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${tag.color}`}>
                              {tag.label}
                            </span>
                          ))}
                        </div>

                        <div className="w-full mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 flex items-center gap-1.5"><Cake size={14} className="text-purple-400" /> Date of Birth</span>
                            <span className="font-medium text-slate-900">{formatDate(record.date_of_birth)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 flex items-center gap-1.5"><Gift size={14} className="text-pink-400" /> Anniversary</span>
                            <span className="font-medium text-slate-900">{formatDate(record.aniversary)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
