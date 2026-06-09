import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { createPortal } from 'react-dom';

const CompanyCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [companyEvents, setCompanyEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    type: 'meeting',
    description: ''
  });

  // Fetch calendar data from Supabase
  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_calender')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        throw error;
      }

      setCompanyEvents(data || []);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast.error(`Failed to load calendar data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEvent(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) {
      toast.error('Please fill in at least the title and date');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('company_calender')
        .insert([{
          ...newEvent,
          timestamp: new Date().toISOString()
        }]);

      if (error) throw error;

      toast.success('Event added successfully');
      setIsModalOpen(false);
      setNewEvent({
        title: '',
        date: '',
        time: '',
        location: '',
        type: 'meeting',
        description: ''
      });
      fetchCalendarData();
    } catch (error) {
      console.error('Error adding event:', error);
      toast.error(`Failed to add event: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const getEventsForDate = (day) => {
    if (!day) return [];
    const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return companyEvents.filter(event => event.date === dateString);
  };

  const getEventTypeColor = (type) => {
    switch (type.toLowerCase()) {
      case 'meeting': return 'bg-blue-100 text-blue-800';
      case 'holiday': return 'bg-red-100 text-red-800';
      case 'training': return 'bg-green-100 text-green-800';
      case 'review': return 'bg-purple-100 text-purple-800';
      case 'event': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();
  const isToday = (day) => {
    return day &&
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth() &&
      day === today.getDate();
  };

  // Filter upcoming events (from today onwards)
  const upcomingEvents = companyEvents.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= new Date(today.setHours(0, 0, 0, 0));
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#800000] tracking-tight">Company Calendar</h1>
          <p className="text-slate-500 mt-1 text-sm">View and manage company events and holidays</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus size={18} className="mr-2" />
          Add Event
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-dashed rounded-full animate-spin"></div>
          <span className="ml-3 text-slate-600 font-medium">Loading calendar data...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-800">
                  {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => navigateMonth(1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {daysOfWeek.map(day => (
                  <div key={day} className="p-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                {days.map((day, index) => {
                  const events = getEventsForDate(day);
                  return (
                    <div
                      key={index}
                      className={`min-h-[80px] p-1.5 transition-all bg-white relative group ${!day ? 'bg-slate-50' : 'cursor-pointer hover:bg-indigo-50/30'
                        } ${isToday(day) ? 'bg-indigo-50/50' : ''}`}
                      onClick={() => day && setSelectedDate(day)}
                    >
                      {day && (
                        <>
                          <div className={`text-xs font-semibold mb-1 flex justify-between items-center ${isToday(day) ? 'text-indigo-600' : 'text-slate-700'
                            }`}>
                            <span className={`${isToday(day) ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : ''}`}>
                              {day}
                            </span>
                            {events.length > 0 && (
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 lg:hidden"></span>
                            )}
                          </div>
                          <div className="space-y-1 hidden lg:block">
                            {events.slice(0, 3).map(event => (
                              <div
                                key={event.id}
                                className={`text-[10px] px-1 py-0.5 rounded font-medium truncate ${getEventTypeColor(event.type)}`}
                                title={event.title}
                              >
                                {event.title}
                              </div>
                            ))}
                            {events.length > 3 && (
                              <div className="text-[9px] text-slate-400 pl-0.5">
                                +{events.length - 3} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Events Sidebar */}
            <div className="space-y-4">
              {/* Upcoming Events */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center">
                  <Calendar size={18} className="mr-2 text-indigo-500" />
                  Upcoming Events
                </h3>
                <div className="space-y-3">
                  {upcomingEvents.length > 0 ? (
                    upcomingEvents.slice(0, 4).map(event => (
                      <div key={event.id} className="relative pl-3 border-l-2 border-indigo-200 hover:border-indigo-500 transition-colors">
                        <h4 className="font-medium text-slate-900 text-sm truncate">{event.title}</h4>
                        <div className="flex items-center text-xs text-slate-500 mt-0.5">
                          <Clock size={10} className="mr-1" />
                          {new Date(event.date).toLocaleDateString()}
                          {event.time && <span className="ml-1">• {event.time}</span>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-xs italic">No upcoming events</p>
                  )}
                </div>
              </div>

              {/* Selected Date Events */}
              {selectedDate && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <h3 className="text-base font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
                    {months[currentDate.getMonth()]} {selectedDate}
                  </h3>
                  <div className="space-y-2">
                    {getEventsForDate(selectedDate).length > 0 ? (
                      getEventsForDate(selectedDate).map(event => (
                        <div key={event.id} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium text-slate-900 text-sm">{event.title}</h4>
                            <span className={`inline-flex px-1.5 py-0.5 text-[9px] rounded-full font-medium ${getEventTypeColor(event.type)}`}>
                              {event.type}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-600 space-y-0.5">
                            <div className="flex items-center">
                              <Clock size={10} className="mr-1 text-slate-400" />
                              {event.time || 'All day'}
                            </div>
                            {event.location && (
                              <div className="flex items-center">
                                <MapPin size={10} className="mr-1 text-slate-400" />
                                {event.location}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-slate-400 text-xs">No events</p>
                        <button
                          onClick={() => {
                            setNewEvent(prev => ({ ...prev, date: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}` }));
                            setIsModalOpen(true);
                          }}
                          className="mt-1 text-xs text-indigo-600 font-medium hover:text-indigo-700 hover:underline"
                        >
                          + Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Event Types Legend */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">Types</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-100 border border-blue-200 mr-1.5"></span>
                    <span className="text-[10px] text-slate-600">Meeting</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-red-100 border border-red-200 mr-1.5"></span>
                    <span className="text-[10px] text-slate-600">Holiday</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-100 border border-green-200 mr-1.5"></span>
                    <span className="text-[10px] text-slate-600">Training</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-purple-100 border border-purple-200 mr-1.5"></span>
                    <span className="text-[10px] text-slate-600">Review</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-amber-100 border border-amber-200 mr-1.5"></span>
                    <span className="text-[10px] text-slate-600">Event</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">Add New Event</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <form onSubmit={handleAddEvent} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Event Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={newEvent.title}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 text-sm transition-all"
                    placeholder="e.g. Weekly Team Sync"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Date *</label>
                    <input
                      type="date"
                      name="date"
                      value={newEvent.date}
                      onChange={handleInputChange}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 text-sm transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</label>
                    <input
                      type="time"
                      name="time"
                      value={newEvent.time}
                      onChange={handleInputChange}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</label>
                  <select
                    name="type"
                    value={newEvent.type}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 text-sm transition-all bg-white"
                  >
                    <option value="meeting">Meeting</option>
                    <option value="holiday">Holiday</option>
                    <option value="training">Training</option>
                    <option value="review">Review</option>
                    <option value="event">Event</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</label>
                  <input
                    type="text"
                    name="location"
                    value={newEvent.location}
                    onChange={handleInputChange}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 text-sm transition-all"
                    placeholder="e.g. Conference Room A"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</label>
                  <textarea
                    name="description"
                    value={newEvent.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 text-sm transition-all resize-none"
                    placeholder="Add details about the event..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`px-5 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 font-medium text-sm transition-all shadow-sm shadow-indigo-200 flex items-center ${submitting ? 'opacity-75 cursor-not-allowed' : ''}`}
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Adding...
                      </>
                    ) : 'Add Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CompanyCalendar;