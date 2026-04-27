import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Globe,
  Search,
  Phone,
  UserCheck,
  UserX,
  UserMinus,
  AlarmClockCheck,
  Users,
  Calendar,
  DollarSign,
  FileText as LeaveIcon,
  User as ProfileIcon,
  Clock,
  LogOut as LogOutIcon,
  X,
  DoorOpen,
  User,
  Menu,
  ChevronDown,
  ChevronUp,
  NotebookPen,
  Book,
  BadgeDollarSign,
  BookPlus,
  Settings
} from 'lucide-react';
import useAuthStore from '../store/authStore';

const Sidebar = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Initialize based on current path to persist on refresh
  const [attendanceOpen, setAttendanceOpen] = useState(() =>
    ['/attendance', '/attendancedaily'].includes(window.location.pathname)
  );

  // Automatically open/close based on route
  useEffect(() => {
    const isAttendancePage = ['/attendance', '/attendancedaily'].includes(location.pathname);
    setAttendanceOpen(isAttendancePage);
  }, [location.pathname]);
  const [currentLang, setCurrentLang] = useState('en');
  const [showLanguageHint, setShowLanguageHint] = useState(false);
  const [isTranslateReady, setIsTranslateReady] = useState(false);

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  // Get current language from Google Translate
  const getCurrentLanguage = () => {
    const googTransCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('googtrans='));

    if (googTransCookie) {
      const value = googTransCookie.split('=')[1];
      const langCode = value.split('/')[2];
      return langCode || 'en';
    }
    return 'en';
  };

  useEffect(() => {
    const hasSeenLanguageHint = localStorage.getItem('hasSeenLanguageHint');
    const currentDetectedLang = getCurrentLanguage();
    setCurrentLang(currentDetectedLang);

    if (!hasSeenLanguageHint && currentDetectedLang === 'en') {
      setShowLanguageHint(true);
    } else {
      setShowLanguageHint(false);
    }

    // Ensure Google Translate cookie persistence on route change
    const ensureLanguagePersistence = () => {
      const detectedLang = getCurrentLanguage();
      if (detectedLang !== 'en' && detectedLang) {
        const cookieValue = `/en/${detectedLang}`;
        const hostname = window.location.hostname;
        const domainPart = (hostname === 'localhost' || !hostname) ? '' : `;domain=.${hostname}`;

        document.cookie = `googtrans=${cookieValue}${domainPart};path=/;max-age=31536000`;
        document.cookie = `googtrans=${cookieValue};path=/;max-age=31536000`;
      }
    };

    // Run on component mount
    ensureLanguagePersistence();

  }, []);

  useEffect(() => {
    const checkLanguageChange = () => {
      const newLang = getCurrentLanguage();
      if (newLang !== currentLang) {
        setCurrentLang(newLang);
      }
    };

    // Regularly check for language changes
    const interval = setInterval(checkLanguageChange, 1000);

    // Also check when page becomes visible again
    document.addEventListener('visibilitychange', checkLanguageChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', checkLanguageChange);
    };
  }, [currentLang]);

  useEffect(() => {
    const hideStyles = document.createElement('style');
    hideStyles.innerHTML = `
      /* Hide Google Translate banner/popup completely */
      .goog-te-banner-frame.skiptranslate { 
        display: none !important; 
      }
      
      /* Hide Google Translate popup/notification */
      .goog-te-menu-frame {
        display: none !important;
      }
      
      /* Hide any Google Translate balloons/popups */
      .goog-te-balloon-frame {
        display: none !important;
      }
      
      /* Hide translate suggestion popup */
      .goog-te-ftab {
        display: none !important;
      }
      
      /* Reset body positioning when Google Translate is active */
      body { 
        top: 0 !important; 
        position: static !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      
      /* Hide the translate element */
      #google_translate_element { 
        display: none !important; 
      }
      
      /* Fix for any translate-related positioning issues */
      .skiptranslate {
        display: none !important;
      }
      
      /* Ensure no translate bar appears */
      iframe.goog-te-banner-frame {
        display: none !important;
      }
      
      /* Hide all translate iframes and popups */
      iframe[src*="translate.googleapis.com"] {
        display: none !important;
      }
      
      /* Fix body displacement on mobile */
      @media (max-width: 768px) {
        body {
          position: relative !important;
          top: 0 !important;
          left: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      }
      
      /* Additional safety for translate bar and popups */
      .goog-te-banner-frame,
      .goog-te-menu-frame,
      .goog-te-balloon-frame,
      .goog-te-ftab {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        height: 0 !important;
        width: 0 !important;
        position: absolute !important;
        top: -9999px !important;
        left: -9999px !important;
        z-index: -1 !important;
      }
      
      /* Ensure main content is not displaced */
      #root, .app, main, .main-content {
        position: relative !important;
        top: 0 !important;
        margin-top: 0 !important;
      }
    `;
    document.head.appendChild(hideStyles);

    // Enhanced body positioning fix
    const checkAndFixBody = () => {
      const body = document.body;

      // Reset any inline styles that Google Translate might add
      if (body.style.top && body.style.top !== '0px') {
        body.style.top = '0px';
      }
      if (body.style.position === 'relative' && body.style.top !== '0px') {
        body.style.position = 'static';
        body.style.top = '0px';
      }

      // Remove any margin/padding that might be added
      if (body.style.marginTop && body.style.marginTop !== '0px') {
        body.style.marginTop = '0px';
      }
    };

    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate && window.google.translate.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,hi',
            autoDisplay: false,
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
          },
          'google_translate_element'
        );

        setIsTranslateReady(true);

        // Monitor for language changes
        const observer = new MutationObserver(() => {
          const newLang = getCurrentLanguage();
          if (newLang !== currentLang) {
            setCurrentLang(newLang);
          }
          checkAndFixBody();
        });

        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true
        });

        setTimeout(checkAndFixBody, 500);
      }
    };

    if (!document.querySelector('script[src*="translate_a/element.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      script.onload = () => {
        setTimeout(checkAndFixBody, 1000);
      };
      document.body.appendChild(script);
    }

    // Run check immediately and set interval for periodic checks
    checkAndFixBody();
    const bodyFixInterval = setInterval(checkAndFixBody, 1000);

    return () => {
      if (bodyFixInterval) {
        clearInterval(bodyFixInterval);
      }
    };
  }, [currentLang]);

  const clearTranslateCookies = () => {
    // Clear all possible Google Translate cookies
    const cookieNames = ['googtrans', 'googtrans-cache'];
    const hostname = window.location.hostname;
    const domains = [hostname, `.${hostname}`, 'localhost', ''];

    cookieNames.forEach(cookieName => {
      domains.forEach(domain => {
        // Clear for current path
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
        // Clear for root path
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        // Clear without domain
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
      });
    });
  };

  const toggleLanguage = () => {
    const targetLang = currentLang === 'en' ? 'hi' : 'en';

    // Hide the hint when switching to Hindi or when language is toggled
    if (showLanguageHint) {
      setShowLanguageHint(false);
      localStorage.setItem('hasSeenLanguageHint', 'true');
    }

    // Method 1: Try using Google Translate widget directly
    const tryGoogleTranslateWidget = () => {
      try {
        const selectElement = document.querySelector('#google_translate_element select');
        if (selectElement) {
          selectElement.value = targetLang;
          selectElement.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      } catch (e) {
        console.log('Widget method failed:', e);
      }
      return false;
    };

    // Method 2: Try doGTranslate function
    const tryDoGTranslate = () => {
      try {
        if (typeof window.doGTranslate === 'function') {
          window.doGTranslate(`en|${targetLang}`);
          return true;
        }
      } catch (e) {
        console.log('doGTranslate method failed:', e);
      }
      return false;
    };

    // Method 3: Set cookie and reload
    const setCookieAndReload = () => {
      clearTranslateCookies();

      const cookieValue = targetLang === 'en' ? '' : `/en/${targetLang}`;
      const hostname = window.location.hostname;
      const domainPart = (hostname === 'localhost' || !hostname) ? '' : `;domain=.${hostname}`;

      if (targetLang !== 'en') {
        // Set multiple cookie variations to ensure persistence
        document.cookie = `googtrans=${cookieValue}${domainPart};path=/;max-age=31536000;SameSite=Lax`;
        document.cookie = `googtrans=${cookieValue};path=/;max-age=31536000;SameSite=Lax`;

        // Also set in localStorage for additional persistence
        localStorage.setItem('selectedLanguage', targetLang);
      } else {
        localStorage.removeItem('selectedLanguage');
      }

      setTimeout(() => {
        window.location.reload();
      }, 100);
    };

    // Try methods in sequence
    if (isTranslateReady) {
      if (!tryGoogleTranslateWidget()) {
        if (!tryDoGTranslate()) {
          setCookieAndReload();
        }
      }
    } else {
      setCookieAndReload();
    }

    // Update state immediately for UI feedback
    setCurrentLang(targetLang);

    // Force sidebar to re-render with new language
    setTimeout(() => {
      setCurrentLang(targetLang);
      // Force a state update to trigger re-render
      setIsOpen(prev => !prev);
      setTimeout(() => setIsOpen(prev => !prev), 100);
    }, 300);

    // Fix body positioning after translation
    setTimeout(() => {
      const body = document.body;
      if (body.style.top && body.style.top !== '0px') {
        body.style.top = '0px';
      }
      if (body.style.position === 'relative') {
        body.style.position = 'static';
      }
    }, 500);
  };

  /* Combined Master Menu List for Permission Checking */
  const MASTER_MENU_ITEMS = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', id: '/' },
    { path: '/job-vacancy', icon: FileText, label: 'Job Vacancy', id: 'indent' },
    { path: '/employee_enquiry', icon: Search, label: 'Employee Enquiry', id: 'find-enquiry' },
    { path: '/call-tracker', icon: Phone, label: 'Enquiry Status', id: 'call-tracker' },
    { path: '/joining', icon: NotebookPen, label: 'Employee Joining', id: 'joining' },
    { path: '/after-joining-work', icon: UserCheck, label: 'After Joining Work', id: 'after-joining-work' },
    { path: '/leaving', icon: UserX, label: 'Employee Leaving', id: 'leaving' },
    { path: '/after-leaving-work', icon: UserMinus, label: 'After Leaving Work', id: 'after-leaving-work' },
    { path: '/employee', icon: Users, label: 'Employee List', id: 'employee' },

    // Employee Specific
    { path: '/my-profile', icon: ProfileIcon, label: 'My Profile', id: 'my-profile' },
    { path: '/my-attendance', icon: Clock, label: 'My Attendance', id: 'my-attendance' },
    { path: '/leave-request', icon: LeaveIcon, label: 'Leave Request', id: 'leave-request' },
    { path: '/gate-pass-request', icon: DoorOpen, label: 'Gate-Pass Request', id: 'gate-pass-request' },
    // { path: '/my-salary', icon: DollarSign, label: 'My Salary', id: 'my-salary' },
    // { path: '/company-calendar', icon: Calendar, label: 'Company Calendar', id: 'company-calendar' },

    // Admin/Manager Specific
    { path: '/leave-management', icon: BookPlus, label: 'Leave Management', id: 'leave-management' },
    { path: '/gate-pass', icon: DoorOpen, label: 'Gate-Pass Management', id: 'gate-pass' },
    { path: '/total-leave-details', icon: FileText, label: 'Total Leave Details', id: 'total-leave-details' },
    {
      type: 'dropdown',
      icon: Book,
      label: 'Employee Attendance',
      id: 'attendance-dropdown',
      isOpen: attendanceOpen,
      toggle: () => setAttendanceOpen(!attendanceOpen),
      items: [
        { path: '/attendance', label: 'Monthly Report', id: 'attendance' },
        { path: '/attendancedaily', label: 'Daily Report', id: 'attendancedaily' }
      ]
    },
    { path: '/payroll', icon: BadgeDollarSign, label: 'Payroll', id: 'payroll' },
    { path: '/misreport', icon: AlarmClockCheck, label: 'MIS Report', id: 'misreport' },
    { path: '/settings', icon: Settings, label: 'Settings', id: 'settings' },
  ];

  // Helper: Check if user has access to a specific page ID
  const hasAccess = (pageId) => {
    // Check if user is admin
    const isAdmin = user?.Admin === 'Yes' || user?.role === 'admin' || user?.role === 'Admin';
    const isHod = user?.is_hod === true || user?.is_hod === 'true' || user?.is_hod === 1;

    // Hide Employee Specific pages for Admins
    if (isAdmin && [
      'my-profile',
      'my-attendance',
      'leave-request',
      'gate-pass-request',
      'my-salary'
    ].includes(pageId)) {
      return false;
    }

    // Admin always has access to everything else
    if (isAdmin) return true;

    // HOD Access: Grant access to Leave Management
    if (isHod && pageId === 'leave-management') {
      return true;
    }

    // If no page_access defined (legacy users), fallback to basic employee pages
    if (!user?.page_access || !Array.isArray(user?.page_access)) {
      const DEFAULT_ACCESS = ['my-profile', 'my-attendance', 'leave-request', 'gate-pass-request', 'my-salary', 'company-calendar'];
      return DEFAULT_ACCESS.includes(pageId);
    }

    return user.page_access.includes(pageId);
  };

  // Filter the menu items
  const baseMenuItems = MASTER_MENU_ITEMS.reduce((acc, item) => {
    // Handle Dropdowns specially
    if (item.type === 'dropdown') {
      // Check if any child is accessible
      const accessibleChildren = item.items.filter(child => hasAccess(child.id));
      if (accessibleChildren.length > 0) {
        acc.push({ ...item, items: accessibleChildren });
      }
    } else {
      // Normal Item
      if (hasAccess(item.id)) {
        acc.push(item);
      }
    }
    return acc;
  }, []);

  // Reorder items for HOD and Non-Admin users
  let menuItems = baseMenuItems;
  const isAdmin = user?.Admin === 'Yes' || user?.role === 'admin' || user?.role === 'Admin';
  const isHod = user?.is_hod === true || user?.is_hod === 'true' || user?.is_hod === 1;

  if (isHod || !isAdmin) {
    const bottomIds = ['my-salary', 'company-calendar'];
    const bottomItems = [];
    const topItems = [];

    menuItems.forEach(item => {
      if (bottomIds.includes(item.id)) {
        bottomItems.push(item);
      } else {
        topItems.push(item);
      }
    });

    menuItems = [...topItems, ...bottomItems];
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        className={`md:hidden fixed top-4 left-4 z-50 p-2.5 bg-white text-slate-600 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-300 border border-slate-100 ${isOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
        onClick={() => setIsOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Tablet menu button */}
      <button
        className={`hidden md:block lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white text-slate-600 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-300 border border-slate-100 ${isOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'}`}
        onClick={() => setIsOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Desktop Sidebar - Static Flow (Flex Item) */}
      <div className="hidden lg:flex h-screen sticky top-0 bg-white border-r border-slate-100 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <SidebarContent
          menuItems={menuItems}
          user={user}
          currentLang={currentLang}
          handleLogout={handleLogout}
          toggleLanguage={toggleLanguage}
          closeDropdown={() => setAttendanceOpen(false)}
        />
      </div>

      {/* Tablet Sidebar - collapsible */}
      <div className={`hidden md:block lg:hidden fixed inset-0 z-50 transition-all duration-500 ease-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-500"
          onClick={() => setIsOpen(false)}
        />
        <div className={`fixed left-0 top-0 h-full z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1)`}>
          <SidebarContent
            menuItems={menuItems}
            onClose={() => setIsOpen(false)}
            user={user}
            currentLang={currentLang}
            handleLogout={handleLogout}
            toggleLanguage={toggleLanguage}
            closeDropdown={() => setAttendanceOpen(false)}
          />
        </div>
      </div>

      {/* Mobile Sidebar - collapsible */}
      <div className={`md:hidden fixed inset-0 z-50 transition-all duration-500 ease-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-500"
          onClick={() => setIsOpen(false)}
        />
        <div className={`fixed left-0 top-0 h-full z-50 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-500 cubic-bezier(0.19, 1, 0.22, 1)`}>
          <SidebarContent
            menuItems={menuItems}
            onClose={() => setIsOpen(false)}
            user={user}
            currentLang={currentLang}
            handleLogout={handleLogout}
            toggleLanguage={toggleLanguage}
            closeDropdown={() => setAttendanceOpen(false)}
          />
        </div>
      </div>
    </>
  );
};

// Extracted SidebarContent to prevent re-renders
const SidebarContent = ({ menuItems, onClose, isCollapsed = false, user, currentLang, handleLogout, toggleLanguage, closeDropdown }) => (
  <div className={`flex flex-col h-full ${isCollapsed ? 'w-20' : 'w-72'} bg-white text-slate-600 transition-all duration-300 border-r border-slate-100`}>

    {/* Header */}
    <div className="flex items-center justify-between px-6 py-6 border-b border-slate-50">
      {!isCollapsed && (
        <div className="flex items-center gap-3 w-full">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#991B1B] to-[#7f1d1d] text-white shadow-lg shadow-red-900/20">
            <Users size={18} />
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-tight">
            {currentLang === 'en' ? 'HR FMS' : 'एचआर एफएमएस'}
          </span>
          <div className="relative ml-auto flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-0.5 bg-slate-100/50 hover:bg-slate-100 border border-slate-200 rounded-lg p-0.5 transition-colors notranslate"
              title={currentLang === 'en' ? 'Switch to Hindi (हिंदी)' : 'Switch to English'}
            >
              <span
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all duration-200 leading-none ${currentLang === 'en'
                  ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-900/5'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                EN
              </span>
              <span
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all duration-200 leading-none ${currentLang !== 'en'
                  ? 'bg-white text-[#991B1B] shadow-sm ring-1 ring-red-900/5'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                हि
              </span>
            </button>
          </div>
          <div id="google_translate_element" className="hidden" />
        </div>
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ml-auto"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>

    {/* Menu */}
    <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto scrollbar-hide">
      {menuItems.map((item) => {
        if (item.type === 'dropdown') {
          return (
            <div key={item.label} className="mb-1">
              <button
                onClick={item.toggle}
                className={`flex items-center justify-between w-full py-2.5 px-3 rounded-lg transition-all duration-200 group ${item.isOpen
                  ? 'bg-red-50 text-[#991B1B] font-medium ring-1 ring-[#991B1B]/5'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`transition-colors text-slate-400 ${item.isOpen ? 'text-[#991B1B]' : 'group-hover:text-slate-600'}`} size={18} />
                  {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                </div>
                {!isCollapsed && (item.isOpen ? <ChevronUp size={14} className="text-[#991B1B]" /> : <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600" />)}
              </button>

              {
                item.isOpen && !isCollapsed && (
                  <div className="ml-5 mt-1 space-y-1 pl-4 border-l border-slate-200">
                    {item.items.map((subItem) => (
                      <NavLink
                        key={subItem.path}
                        to={subItem.path}
                        className={({ isActive }) =>
                          `flex items-center py-2 px-3 rounded-md transition-all duration-200 text-sm ${isActive
                            ? 'text-[#991B1B] font-medium bg-red-50/50'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          }`
                        }
                        onClick={() => {
                          onClose?.();
                        }}
                      >
                        <span className="font-medium">{subItem.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )
              }
            </div>
          );
        }

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center py-2.5 px-3 rounded-lg transition-all duration-200 mb-1 group ${isActive
                ? 'bg-red-50 text-[#991B1B] font-medium ring-1 ring-[#991B1B]/5'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
            onClick={() => {
              onClose?.();
              closeDropdown?.();
            }}
          >
            <item.icon className={`transition-colors ${isCollapsed ? 'mx-auto' : 'mr-3'} ${({ isActive }) => isActive ? 'text-[#991B1B]' : 'text-slate-400 group-hover:text-slate-600'}`} size={18} />
            {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
          </NavLink>
        );
      })}
    </nav >

    {/* Footer - Always visible */}
    < div className="p-4 mt-auto border-t border-slate-100" >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 text-slate-500">
          <User size={18} />
        </div>
        <div className={`${isCollapsed ? 'hidden' : 'block'} flex-1 min-w-0`}>
          <p className="text-sm font-semibold text-slate-800 truncate">{user?.Name || user?.Username || 'Guest'}</p>
          <p className="text-xs text-slate-500 truncate">{user?.Admin === 'Yes' ? 'Administrator' : 'Employee'}</p>
        </div>
        <button
          onClick={() => {
            handleLogout();
            onClose?.();
          }}
          className="p-2 ml-auto rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Logout"
        >
          <LogOutIcon size={18} />
        </button>
      </div>
    </div >
  </div >
);

export default Sidebar;