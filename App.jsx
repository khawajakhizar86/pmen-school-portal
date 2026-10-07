import React, { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } from 'react';
import {
  School, LayoutDashboard, CalendarCheck, GraduationCap, Wallet,
  CalendarDays, Megaphone, LogOut, Plus, Trash2, Search, Edit2,
  Camera, Users, Loader2, KeyRound, Menu, X, ShieldCheck, UserCheck, Briefcase,
  Ticket, CheckCircle2, XCircle, Clock3, Banknote, ClipboardList
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  fetchers, ALL_KEYS, mutations, signIn, signOut, getSessionProfile, changePassword, uploadAvatar,
} from './lib/data';

/* ---------------------------------------------------------------- */
/* Constants & Helpers                                              */
/* ---------------------------------------------------------------- */

const CLASSES = Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`);
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SUBJECTS = ['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies', 'Islamiyat', 'Computer Science'];
const PERIODS = [1, 2, 3, 4, 5, 6];
const DEFAULT_PASSWORD = 'pms2026';
const PMS_LOGO_SRC = '/Code_Generated_Image.png';
const ORANGE_LOGO_FILTER = 'brightness(0) saturate(100%) invert(66%) sepia(66%) saturate(3027%) hue-rotate(347deg) brightness(100%) contrast(92%)';

/* Fun Fair Ticket module settings */
const MIN_TICKET_QTY = 5;
const TICKET_PRICE_PER_UNIT = 300;
const TICKET_EVENT = {
  title: 'FunFair Ticket',
  subtitle: 'FunGala',
  org: 'PMEN',
  school: 'Peshawar Model School',
  date: '24 May 2026',
};

const CAMPUSES = [
  'Peshawar Model School Boys I',
  'Peshawar Model School Boys IV',
  'Peshawar Model School & Collage Girls Dalazak Campus',
  'Hidayah School System by Peshawar Model Schools',
  'Peshawar Model School Hayatabad Campus',
  'Peshawar Model School Nasirbagh Campus',
  'Peshawar Model School and Collage Shabqadar Boys & Girls Campus',
  'Peshawar Model School and Collage Swabi Boys & Girls Campus',
];

const DEPARTMENTS = [
  'School',
  'Human Resouce Development Center',
  'Information Technology',
  'Accounts & Finance',
  'Procurement',
];

const DESIGNATION_ROLES = ['Teacher', 'Section Head', 'Administration', 'School Head', 'Supporting Staff'];

// One combined dropdown containing only the requested campuses and departments.
const CAMPUS_DEPARTMENT_OPTIONS = [
  ...CAMPUSES.map((name) => ({
    value: `campus:${name}`,
    label: name,
    campus: name,
    department: '',
  })),
  ...DEPARTMENTS.map((name) => ({
    value: `department:${name}`,
    label: name,
    campus: '',
    department: name,
  })),
];

const FACULTY_ROLES = [
  { id: 'super_admin', label: 'Super Admin (IT Department)' },
  { id: 'it_assistant', label: 'IT Assistant' },
  { id: 'principal', label: 'Principal' },
  { id: 'admin', label: 'Admin' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'coordinator', label: 'Coordinator' },
  { id: 'hr', label: 'HR Department' },
  { id: 'accounts', label: 'Accounts Department' },
  { id: 'procurement', label: 'Procurement Department' },
  { id: 'dept_head', label: 'Department Manager / Head' }
];

const MODULE_LIST = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile', label: 'Staff Profile' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'grades', label: 'Grades' },
  { id: 'fees', label: 'Fees & Accounts' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'tickets', label: 'Fun Fair Tickets' },
  { id: 'leaves', label: 'Leave Management' },
  { id: 'add_employee', label: 'Add Employee / Registration' },
  { id: 'access_control', label: 'Role & Access Control' },
  { id: 'password', label: 'Change Password' }
];

const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: ['dashboard', 'profile', 'attendance', 'grades', 'fees', 'timetable', 'announcements', 'tickets', 'leaves', 'add_employee', 'access_control', 'password'],
  principal: ['dashboard', 'profile', 'attendance', 'grades', 'fees', 'timetable', 'announcements', 'tickets', 'leaves', 'password'],
  it_assistant: ['dashboard', 'profile', 'announcements', 'leaves', 'password'],
  admin: ['dashboard', 'profile', 'attendance', 'grades', 'fees', 'timetable', 'announcements', 'tickets', 'leaves', 'password'],
  teacher: ['dashboard', 'profile', 'attendance', 'grades', 'timetable', 'announcements', 'tickets', 'leaves', 'password'],
  faculty: ['dashboard', 'profile', 'attendance', 'grades', 'timetable', 'announcements', 'tickets', 'leaves', 'password'],
  coordinator: ['dashboard', 'profile', 'attendance', 'timetable', 'announcements', 'leaves', 'password'],
  hr: ['dashboard', 'profile', 'add_employee', 'announcements', 'leaves', 'password'],
  accounts: ['dashboard', 'profile', 'fees', 'announcements', 'leaves', 'password'],
  procurement: ['dashboard', 'profile', 'announcements', 'leaves', 'password'],
  dept_head: ['dashboard', 'profile', 'attendance', 'announcements', 'leaves', 'password'],
  student: ['dashboard', 'profile', 'attendance', 'grades', 'fees', 'timetable', 'announcements', 'tickets', 'password']
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function nextRollNo(students) {
  const nums = students.map((s) => parseInt(s.rollNo, 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1).padStart(3, '0');
}

// Updated ID Generation: Pure Emp-001, Emp-002, Emp-003 format for all departments & staff
function nextEmployeeId(faculty) {
  const nums = faculty.map((t) => {
    const m = /Emp-(\d+)/i.exec(t.employeeId || '');
    return m ? parseInt(m[1], 10) : 0;
  });
  const max = nums.length ? Math.max(...nums) : 0;
  return 'Emp-' + String(max + 1).padStart(3, '0');
}

// Every student gets a default, permanent Registration No. at the time of admission
function nextRegNo(students) {
  const nums = students.map((s) => parseInt(s.regNo, 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return String(max + 1);
}

// Sequential ticket numbers used across all approved Fun Fair tickets
function nextTicketNo(tickets) {
  const nums = tickets.map((t) => parseInt(String(t.ticketNo).replace(/\D/g, ''), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return String(max + 1);
}

function normalizeDesignation(value) {
  return value === 'Maths Teacher' ? 'Teacher' : value;
}

function getFacultyDesignation(faculty) {
  return normalizeDesignation(faculty.designationRole || faculty.designation) || 'N/A';
}

function getCampus(record) {
  return record?.campus || record?.school || record?.campusName || '';
}

function isCampusManager(user) {
  return ['principal', 'admin'].includes(user?.role);
}

function scopeToCampus(records, user) {
  if (!isCampusManager(user)) return records || [];
  const campus = getCampus(user);
  if (!campus) return [];
  return (records || []).filter((record) => getCampus(record) === campus);
}

const COLORS = {
  paper: '#F5EFDC',
  paperDark: '#ECE1C4',
  ink: '#1C2B39',
  inkSoft: '#4A5A68',
  navy: '#1F3B57',
  navyDeep: '#13253A',
  brass: '#AD7F24',
  brassLight: '#D9A94C',
  redInk: '#8B3030',
  redInkBg: '#F3E1DE',
  greenInk: '#3B6B49',
  greenInkBg: '#E2ECDF',
  line: '#D8CBA6',
};

// All persistence now goes through Supabase (see ./lib/data.js). Components call these actions
// instead of rewriting whole collections in localStorage.
const ActionsContext = createContext(null);
const useActions = () => useContext(ActionsContext);

/* ---------------------------------------------------------------- */
/* Small UI primitives                                              */
/* ---------------------------------------------------------------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
      .sp-root * { box-sizing: border-box; }
      .sp-root { font-family: 'IBM Plex Sans', sans-serif; color: ${COLORS.ink}; }
      .sp-heading { font-family: 'Fraunces', serif; }
      .sp-btn { cursor: pointer; border: none; transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
      .sp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .sp-nav-item:hover { background: ${COLORS.navyDeep}; }
      .sp-row:hover { background: ${COLORS.paperDark}; }
      .sp-input { font-family: 'IBM Plex Sans', sans-serif; border: 1px solid ${COLORS.line}; background: #fff; padding: 8px 10px; font-size: 14px; color: ${COLORS.ink}; width: 100%; max-width: 100%; border-radius: 4px; }
      .sp-input:focus { outline: 2px solid ${COLORS.brass}; outline-offset: 1px; }
      .sp-select { font-family: 'IBM Plex Sans', sans-serif; border: 1px solid ${COLORS.line}; background: #fff; padding: 8px 10px; font-size: 14px; color: ${COLORS.ink}; max-width: 100%; border-radius: 4px; }
      table.sp-table { border-collapse: collapse; width: 100%; font-size: 14px; }
      table.sp-table th { text-align: left; padding: 9px 12px; border-bottom: 2px solid ${COLORS.ink}; font-weight: 600; font-size: 13px; white-space: nowrap; }
      table.sp-table td { padding: 9px 12px; border-bottom: 1px solid ${COLORS.line}; }
      .sp-table-wrap { width: 100%; overflow-x: auto; }
      .sp-shell { display: flex; min-height: 100vh; background: ${COLORS.paper}; flex-direction: row; }
      .sp-sidebar { width: 232px; flex-shrink: 0; background: ${COLORS.navy}; height: 100vh; position: sticky; top: 0; overflow-y: auto; display: flex; flex-direction: column; transition: transform 0.25s ease; }
      .sp-main { flex: 1; min-width: 0; }
      .sp-content { padding: 32px; max-width: 1180px; }
      .sp-topbar { padding: 18px 32px; border-bottom: 1px solid ${COLORS.line}; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
      .sp-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
      .sp-timetable-grid { display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)); gap: 12px; }
      .sp-timetable-scroll { width: 100%; overflow-x: auto; }
      .sp-hamburger { display: none; background: none; border: none; cursor: pointer; padding: 6px; align-items: center; justify-content: center; color: ${COLORS.navy}; }
      .sp-sidebar-close { display: none; }
      .sp-overlay { display: none; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: ${COLORS.line}; }
      .student-dashboard { color: #202938; }
      .student-dashboard .student-hero { background: linear-gradient(115deg, #303746 0%, #424959 100%); color: #fff; border-radius: 22px; padding: 26px 30px; position: relative; overflow: hidden; }
      .student-dashboard .student-hero:after { content: '✦'; position: absolute; right: 9%; top: 18px; color: #f5c6b0; font-size: 90px; opacity: .16; transform: rotate(18deg); }
      .student-dashboard .student-grid { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 22px; align-items: start; }
      .student-dashboard .subject-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .student-dashboard .subject-card { min-height: 142px; padding: 18px; border-radius: 16px; background: #fff; border: 1px solid #e9e9ef; box-shadow: 0 5px 12px rgba(34,42,57,.10); position: relative; overflow: hidden; }
      .student-dashboard .subject-card:after { content: ''; position: absolute; width: 100px; height: 100px; right: -22px; top: -30px; border-radius: 50%; background: var(--subject-color, #dcdcff); opacity: .72; }
      .student-dashboard .assignment-row { background: #fff; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; box-shadow: 0 3px 9px rgba(34,42,57,.08); border-left: 5px solid #d9d5ff; display: flex; justify-content: space-between; gap: 12px; align-items: center; }
      .student-dashboard .event-panel { background: #3a3e49; color: #fff; border-radius: 16px; padding: 22px 14px; }
      .student-dashboard .event-card { padding: 15px; border-radius: 14px; color: #202938; background: linear-gradient(135deg,#f6c4aa,#9eafa5); margin-top: 12px; }
      .student-dashboard .mini-calendar { background: #3a3e49; color: #fff; border-radius: 16px; padding: 22px; }
      @media (max-width: 980px) { .student-dashboard .student-grid { grid-template-columns: 1fr; } }
      @media (max-width: 650px) { .student-dashboard .subject-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .student-dashboard .student-hero { padding: 22px 18px; } }
      @media (max-width: 430px) { .student-dashboard .subject-grid { grid-template-columns: 1fr; } .student-dashboard .assignment-row { align-items: flex-start; flex-direction: column; } }

      .sidebar-user-profile {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: 12px 15px;
        display: flex;
        align-items: center;
      }
      .sidebar-user-profile img {
        object-fit: cover;
        border: 2px solid #ffffff;
        border-radius: 50%;
        margin-right: 8px;
      }
      .sidebar-user-profile .user-name {
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #ffffff;
        font-weight: bold;
      }
      .top-navbar-title {
        font-size: 18px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: bold;
        color: ${COLORS.navy};
      }

      @media (max-width: 760px) {
        .sp-hamburger { display: inline-flex; }
        .sp-sidebar-close { display: inline-flex; }
        .sp-sidebar {
          position: fixed; top: 0; left: 0; height: 100vh; width: 78vw; max-width: 280px;
          z-index: 60; transform: translateX(-100%); box-shadow: 2px 0 18px rgba(0,0,0,0.25);
        }
        .sp-sidebar.sp-sidebar-open { transform: translateX(0); }
        .sp-sidebar-nav { display: flex; flex-direction: column; overflow-x: visible; padding: 8px 0 !important; gap: 0; }
        .sp-sidebar-nav button { white-space: normal; border-bottom: none !important; padding: 12px 20px !important; }
        .sp-sidebar-foot { display: block !important; padding: 16px 20px !important; }
        .sp-sidebar-head { padding: 16px 18px !important; justify-content: space-between !important; }
        .sp-overlay.sp-overlay-open { display: block; position: fixed; inset: 0; background: rgba(15, 23, 32, 0.45); z-index: 55; }
        .sp-content { padding: 16px; }
        .sp-topbar { padding: 14px 16px; }
        .sp-heading.sp-page-title { font-size: 20px !important; }
      }
    `}</style>
  );
}

function Panel({ icon: Icon, title, action, iconOnClick, iconTitle, onTitleClick, titleOpen, children }) {
  return (
    <div style={{ background: '#FFFDF7', border: `1px solid ${COLORS.line}`, borderRadius: 6, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${COLORS.line}`, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Icon && (iconOnClick ? (
            <button type="button" className="sp-btn" onClick={iconOnClick} title={iconTitle} aria-label={iconTitle} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: COLORS.navy, color: '#fff', borderRadius: 4, padding: 3 }}>
              <Icon size={18} />
            </button>
          ) : <Icon size={18} color={COLORS.navy} />)}
          {onTitleClick ? (
            <button type="button" className="sp-btn sp-heading" onClick={onTitleClick} aria-expanded={titleOpen} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 0, background: 'transparent', fontSize: 18, fontWeight: 600, color: COLORS.navy }}>
              {title}<span aria-hidden="true">{titleOpen ? '−' : '+'}</span>
            </button>
          ) : <h3 className="sp-heading" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.navy }}>{title}</h3>}
        </div>
        {action}
      </div>
      {titleOpen === false ? null : <div style={{ padding: 18 }}>{children}</div>}
    </div>
  );
}

function Btn({ children, onClick, variant = 'primary', icon: Icon, disabled, type = 'button' }) {
  const styles = {
    primary: { background: COLORS.navy, color: '#fff', padding: '9px 16px' },
    brass: { background: COLORS.brass, color: '#fff', padding: '9px 16px' },
    outline: { background: 'transparent', color: COLORS.navy, border: `1px solid ${COLORS.navy}`, padding: '8px 15px' },
    danger: { background: 'transparent', color: COLORS.redInk, border: `1px solid ${COLORS.redInk}`, padding: '8px 15px' },
    ghost: { background: 'transparent', color: COLORS.inkSoft, padding: '6px 8px' },
  };
  return (
    <button type={type} className="sp-btn" onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, borderRadius: 4, ...styles[variant] }}>
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

function Badge({ text, tone = 'neutral' }) {
  const tones = {
    good: { bg: COLORS.greenInkBg, fg: COLORS.greenInk },
    bad: { bg: COLORS.redInkBg, fg: COLORS.redInk },
    neutral: { bg: COLORS.paperDark, fg: COLORS.inkSoft },
    brass: { bg: '#F1E3C4', fg: COLORS.brass },
  };
  const t = tones[tone];
  return <span style={{ background: t.bg, color: t.fg, padding: '3px 9px', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 3 }}>{text}</span>;
}

function EmptyState({ text }) {
  return <div style={{ padding: '30px 10px', textAlign: 'center', color: COLORS.inkSoft, fontSize: 14 }}>{text}</div>;
}

/* ---------------------------------------------------------------- */
/* Login Interface                                                  */
/* ---------------------------------------------------------------- */

function ModernLoginScreen({ db, onLogin }) {
  const [loginCategory, setLoginCategory] = useState('faculty');
  const [selectedSubRole, setSelectedSubRole] = useState('super_admin');
  const [idValue, setIdValue] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const idLabel = loginCategory === 'faculty' ? 'Employee ID' : 'Roll Number';
  const idPlaceholder = loginCategory === 'faculty' ? 'e.g. Emp-001' : 'e.g. 001';

  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const idTrim = idValue.trim();
    if (!idTrim || !password) {
      setError(`Please enter your ${idLabel.toLowerCase()} and password.`);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const profile = await signIn(loginCategory, idTrim, password);
      onLogin(profile);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#d8dbe0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <GlobalStyle />
      <div style={{
        width: '100%', maxWidth: '1080px', minHeight: '620px', backgroundColor: '#0d1117', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', display: 'flex', flexWrap: 'wrap', border: '1px solid #21262d'
      }}>
        <div style={{ flex: '1 1 500px', backgroundColor: '#0d1117', backgroundImage: 'radial-gradient(circle at top right, #1f293d, #0d1117 70%)', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div style={{ margin: 'auto 0' }}>
            <h1 style={{ color: '#ffffff', fontSize: '48px', fontWeight: '800', lineHeight: '1.2', letterSpacing: '-0.5px', margin: 0 }}>PMEN Portal</h1>
            <p style={{ color: '#8b949e', fontSize: '15px', marginTop: '12px' }}>Role-Based Management Portal for Faculty, IT Admin & Students.</p>
          </div>
          <div style={{ color: '#484f58', fontSize: '12px', fontWeight: '500' }}>© 2026 PMEN. All Rights Reserved.</div>
        </div>

        <div style={{ flex: '1 1 420px', backgroundColor: '#0d1117', padding: '12px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#ffffff', height: '100%', borderRadius: '18px', padding: '36px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'right' }}><span style={{ fontSize: '12px', color: '#6e7681', fontWeight: '500' }}>English 🌐</span></div>
            <div style={{ width: '100%', maxWidth: '340px', margin: 'auto' }}>
              <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' }}>Login</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>Select portal access type to continue.</p>

              <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: '14px' }}>
                <button type="button" onClick={() => { setLoginCategory('faculty'); setError(''); }} style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', backgroundColor: loginCategory === 'faculty' ? '#ffffff' : 'transparent', color: loginCategory === 'faculty' ? '#0f172a' : '#64748b', boxShadow: loginCategory === 'faculty' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s ease' }}>
                  Faculty / Staff
                </button>
                <button type="button" onClick={() => { setLoginCategory('student'); setError(''); }} style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', backgroundColor: loginCategory === 'student' ? '#ffffff' : 'transparent', color: loginCategory === 'student' ? '#0f172a' : '#64748b', boxShadow: loginCategory === 'student' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s ease' }}>
                  Student
                </button>
              </div>

              {loginCategory === 'faculty' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Faculty Designation Role</label>
                  <select value={selectedSubRole} onChange={(e) => setSelectedSubRole(e.target.value)} style={{ width: '100%', padding: '9px 10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}>
                    {FACULTY_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <form onSubmit={submit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: '6px' }}>{idLabel}</label>
                  <input type="text" required value={idValue} onChange={(e) => setIdValue(e.target.value)} placeholder={idPlaceholder} style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Password</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '20px' }}>
                  <label style={{ color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Remember Me
                  </label>
                  <span style={{ color: '#64748b', textDecoration: 'underline', cursor: 'pointer' }}>Forgot Password?</span>
                </div>

                {error && <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px', border: '1px solid #fecaca' }}>{error}</div>}

                <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Log In</button>
              </form>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '11px', color: '#94a3b8', marginTop: '16px' }}>
              <span>Terms of Service</span><span>•</span><span>Privacy Policy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Sidebar Component                                                */
/* ---------------------------------------------------------------- */

function Sidebar({ user, active, setActive, onLogout, open, onClose, db }) {
  const allNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'profile', label: user.type === 'student' ? 'Student Profile' : 'Staff Profile', icon: UserCheck },
    { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { key: 'grades', label: 'Grades', icon: GraduationCap },
    { key: 'fees', label: 'Fees & Financials', icon: Wallet },
    { key: 'timetable', label: 'Timetable', icon: CalendarDays },
    { key: 'announcements', label: 'Announcements', icon: Megaphone },
    { key: 'tickets', label: 'Fun Fair Tickets', icon: Ticket },
    { key: 'leaves', label: 'Leave Management', icon: ClipboardList },
    { key: 'add_employee', label: 'Add Employee', icon: Users },
    { key: 'access_control', label: 'Role & Access Control', icon: ShieldCheck },
    { key: 'password', label: 'Change Password', icon: KeyRound },
  ];

  let userAllowedModules = [];
  if (user.role === 'super_admin') {
    userAllowedModules = MODULE_LIST.map(m => m.id);
  } else if (user.type === 'student') {
    userAllowedModules = DEFAULT_ROLE_PERMISSIONS.student;
  } else {
    const currentFaculty = (db.faculty || []).find(f => f.id === user.id);
    userAllowedModules = currentFaculty?.allowedModules || user.allowedModules || db.rolePermissions?.[user.role] || DEFAULT_ROLE_PERMISSIONS[user.role] || ['dashboard', 'profile', 'password'];
  }

  const items = allNavItems.filter(item => userAllowedModules.includes(item.key));

  function selectItem(key) {
    setActive(key);
    onClose();
  }

  const roleLabel = FACULTY_ROLES.find(r => r.id === user.role)?.label || user.role;

  return (
    <>
      <div className={`sp-overlay${open ? ' sp-overlay-open' : ''}`} onClick={onClose} />
      <div className={`sp-sidebar${open ? ' sp-sidebar-open' : ''}`}>
        <div className="sp-sidebar-head" style={{ padding: '16px 15px', borderBottom: `1px solid ${COLORS.navyDeep}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          {user.avatar ? (
            <img src={user.avatar} alt="User profile" width="40" height="40" style={{ objectFit: 'cover', border: '2px solid #fff', borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <div aria-label="User profile placeholder" style={{ width: 40, height: 40, border: '2px solid #fff', borderRadius: '50%', background: COLORS.brass, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, flexShrink: 0 }}>
              {(user.name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="user-name" style={{ color: '#ffffff', fontWeight: 700 }}>{user.name}</div>
          </div>
          <button className="sp-sidebar-close sp-btn" onClick={onClose} style={{ background: 'transparent', color: '#C7D2DB' }}>
            <X size={20} />
          </button>
        </div>

        <div className="sp-sidebar-nav" style={{ padding: '16px 0', flex: 1 }}>
          {items.map((it) => {
            const isActive = active === it.key;
            return (
              <button key={it.key} className="sp-nav-item sp-btn" onClick={() => selectItem(it.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px',
                  background: isActive ? COLORS.navyDeep : 'transparent',
                  borderLeft: isActive ? `3px solid ${COLORS.brassLight}` : '3px solid transparent',
                  color: isActive ? '#fff' : '#C7D2DB', fontSize: 14, fontWeight: isActive ? 600 : 400, textAlign: 'left',
                }}>
                <it.icon size={16} />
                {it.label}
              </button>
            );
          })}
        </div>
        <div className="sp-sidebar-foot" style={{ padding: '16px 20px', borderTop: `1px solid ${COLORS.navyDeep}` }}>
          <div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#93A5B4', marginBottom: 12 }}>
              {user.type === 'student' ? `Roll ${user.rollNo} · Class ${user.class}` : `${roleLabel} · ${user.employeeId}`}
            </div>
          </div>
          <button className="sp-btn" onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'transparent', color: '#C7D2DB', fontSize: 13 }}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Dashboard Component                                              */
/* ---------------------------------------------------------------- */

function StatBlock({ label, value, tone }) {
  const colorMap = { navy: COLORS.navy, brass: COLORS.brass, red: COLORS.redInk, green: COLORS.greenInk };
  return (
    <div style={{ background: '#FFFDF7', border: `1px solid ${COLORS.line}`, padding: '16px 18px', borderRadius: 6 }}>
      <div className="sp-heading" style={{ fontSize: 28, fontWeight: 600, color: colorMap[tone] || COLORS.navy }}>{value}</div>
      <div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Dashboard({ user, db, onUserUpdate }) {
  const actions = useActions();
  const latestAnnouncements = [...db.announcements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    actions.uploadAvatar(file);
    e.target.value = '';
  };

  const roleTitle = FACULTY_ROLES.find(r => r.id === user.role)?.label || user.role;

  if (user.type === 'faculty') {
    const campusStudents = scopeToCampus(db.students, user);
    const totalFaculty = db.stats?.faculty ?? scopeToCampus(db.faculty, user).length;
    const totalStudents = campusStudents.length;
    const visibleStudentIds = new Set(campusStudents.map((student) => student.id));
    const unpaidCount = db.stats?.unpaid ?? 0;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ background: COLORS.navy, color: '#fff', padding: '20px 24px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="sp-heading" style={{ margin: 0, fontSize: 24 }}>Welcome back, {user.name} 👋</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 14, color: '#C7D2DB' }}>
              Logged in as <strong>{roleTitle}</strong>.
            </p>
          </div>
        </div>

        <div className="sp-stats">
          <StatBlock label="Total Students" value={totalStudents} tone="navy" />
          <StatBlock label="Faculty & Staff" value={totalFaculty} tone="navy" />
          <StatBlock label="Unpaid Fee Entries" value={unpaidCount} tone="red" />
          <StatBlock label="Announcements" value={db.announcements.length} tone="brass" />
        </div>

        <Panel icon={Megaphone} title="Latest Announcements">
          {latestAnnouncements.length === 0 ? <EmptyState text="No announcements posted yet." /> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {latestAnnouncements.map((a) => (
                <div key={a.id} style={{ borderLeft: `3px solid ${COLORS.brass}`, paddingLeft: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{a.title}</div>
                  <div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 2 }}>{a.body}</div>
                  <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 4 }}>{fmtDate(a.date)} · {a.author}</div>
                </div>
              ))}
            </div>}
        </Panel>
      </div>
    );
  }

  const currentStudent = db.students.find(s => s.id === user.id) || user;
  const myRecords = Object.entries(db.attendance).filter(([k]) => k.startsWith(`${user.class}|`));
  let present = 0, total = 0;
  myRecords.forEach(([, rec]) => { if (rec[user.id]) { total++; if (rec[user.id] === 'P') present++; } });
  const pct = total ? Math.round((present / total) * 100) : 0;
  const myFees = db.fees[user.id] || [];
  const unpaid = myFees.filter((f) => !f.paid).length;
  const myGrades = db.grades[user.id] || [];
  const subjectProgress = SUBJECTS.slice(0, 6).map((subject, index) => {
    const grades = myGrades.filter(g => g.subject === subject);
    const score = grades.length ? Math.round(grades.reduce((sum, g) => sum + Number(g.score || 0), 0) / grades.length) : 0;
    return { subject, score, color: ['#f6d3b8', '#bcdcf2', '#d7d7f8', '#d0e8d6', '#d8d0ee', '#f4d9bd'][index] };
  });
  const upcoming = [...db.announcements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const assignments = myGrades.slice(-4).reverse();

  return (
    <div className="student-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="student-hero">
        <div style={{ fontSize: 14, opacity: .78 }}>{fmtDate(todayISO())}</div>
        <h2 className="sp-heading" style={{ margin: '14px 0 4px', fontSize: 32 }}>Welcome back, {currentStudent.name}!</h2>
        <p style={{ margin: 0, color: '#d8dce5' }}>Learning is a journey, so start it now.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, maxWidth: 390 }}>
          <div style={{ height: 8, flex: 1, background: '#8ca9c9', borderRadius: 10, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#f2c4ac' }} /></div>
          <strong style={{ fontSize: 13 }}>{pct}% Attendance</strong>
        </div>
        <div style={{ marginTop: 20, fontSize: 13, color: '#d8dce5' }}>Class {user.class} · Section {currentStudent.section || 'A'} · Roll No. {user.rollNo}</div>
      </div>

      <div className="student-grid">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 className="sp-heading" style={{ margin: 0, fontSize: 25 }}>My Subjects</h2><span style={{ fontSize: 13, color: COLORS.inkSoft }}>Academic progress</span>
          </div>
          <div className="subject-grid">
            {subjectProgress.map(({ subject, score, color }) => (
              <div className="subject-card" key={subject} style={{ '--subject-color': color }}>
                <div style={{ fontSize: 28, fontWeight: 800, position: 'relative', zIndex: 1 }}>{subject === 'Mathematics' ? '√x' : subject === 'Science' ? '⚛' : subject === 'English' ? '▮' : '◉'}</div>
                <div style={{ marginTop: 22, fontWeight: 700, position: 'relative', zIndex: 1 }}>{subject}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontSize: 12, position: 'relative', zIndex: 1 }}><div style={{ height: 6, flex: 1, background: '#afd0ed', borderRadius: 8 }}><div style={{ height: '100%', width: `${score}%`, background: '#344751', borderRadius: 8 }} /></div>{score}%</div>
              </div>
            ))}
          </div>

          <h2 className="sp-heading" style={{ margin: '28px 0 12px', fontSize: 25 }}>My Recent Grades</h2>
          {assignments.length === 0 ? <EmptyState text="Your grades will appear here once published." /> : assignments.map((g, i) => (
            <div className="assignment-row" key={`${g.subject}-${g.date}-${i}`}><div><strong style={{ fontSize: 16 }}>{g.subject}</strong><div style={{ fontSize: 12, color: COLORS.inkSoft }}>{g.term} · {fmtDate(g.date)}</div></div><Badge text={`${g.score} / 100`} tone="brass" /></div>
          ))}
        </div>

        <div className="event-panel">
          <h2 className="sp-heading" style={{ margin: 0, fontSize: 25 }}>Upcoming<br />Announcements</h2>
          <div style={{ height: 2, background: '#67b8d4', margin: '12px 0 18px' }} />
          {upcoming.length === 0 ? <div style={{ color: '#cbd1dc', fontSize: 13 }}>No upcoming announcements.</div> : upcoming.map((a) => (
            <div className="event-card" key={a.id}><strong>{a.title}</strong><div style={{ fontSize: 12, marginTop: 8 }}>📅 {fmtDate(a.date)}</div><div style={{ fontSize: 12, marginTop: 5, color: '#43505b' }}>{a.body}</div></div>
          ))}
          <div style={{ marginTop: 24, fontSize: 13, color: '#d8dce5' }}>Unpaid fee months: <strong>{unpaid}</strong></div>
        </div>
      </div>

      <div className="mini-calendar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><h2 className="sp-heading" style={{ margin: 0, fontSize: 24 }}>My Schedule</h2><span style={{ fontSize: 13, color: '#cbd1dc' }}>{DAYS.length} school days</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: 10 }}>
          {DAYS.map(day => { const lessons = PERIODS.map(p => db.timetable[`${user.class}|${day}|${p}`]?.subject).filter(Boolean); return <div key={day} style={{ background: '#4a4f5b', padding: 12, borderRadius: 10 }}><strong>{day}</strong><div style={{ fontSize: 12, color: '#cbd1dc', marginTop: 8 }}>{lessons.length ? lessons.slice(0, 3).join(' · ') : 'No classes added'}</div></div>; })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Staff Profile Module (For Faculty & Employees)                   */
/* ---------------------------------------------------------------- */

function StaffProfileModule({ user, db, onUserUpdate }) {
  const actions = useActions();
  const currentFaculty = (db.faculty || []).find((f) => String(f.id) === String(user.id)) || user;

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    actions.uploadAvatar(file);
    e.target.value = '';
  };

  const campusOrDepartment = currentFaculty.campus || currentFaculty.department || currentFaculty.campusDepartment || currentFaculty.campusName || currentFaculty.school;
  const details = [
    ['NAME', currentFaculty.name],
    ['EMP ID', currentFaculty.employeeId],
    ['CAMPUS / DEPARTMENT', campusOrDepartment],
    ['DESIGNATION', getFacultyDesignation(currentFaculty)],
    ['EMAIL', currentFaculty.email],
    ['PHONE', currentFaculty.phone],
    ['CNIC', currentFaculty.cnic],
  ];

  return (
    <Panel icon={UserCheck} title="Staff Profile">
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${COLORS.brass}`, background: COLORS.paperDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {user.avatar ? (
            <img src={user.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Users size={48} color={COLORS.inkSoft} />
          )}
          <label htmlFor="staff-avatar-upload" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', textAlign: 'center', padding: '6px 0', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Change Photo">
            <Camera size={16} />
          </label>
          <input id="staff-avatar-upload" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
        </div>

        <div style={{ flex: 1, minWidth: 280, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {details.map(([label, value]) => (
            <div key={label}>
              <span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>{label}</span>
              <div style={{ fontSize: 15, fontWeight: 500, color: label === 'NAME' ? COLORS.navy : COLORS.ink }}>
                {value || 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function StudentProfileModule({ user, db, onUserUpdate }) {
  const actions = useActions();
  const student = (db.students || []).find((item) => item.id === user.id) || user;

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    actions.uploadAvatar(file);
    e.target.value = '';
  }

  return (
    <Panel icon={UserCheck} title="Student Profile">
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${COLORS.brass}`, background: COLORS.paperDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {user.avatar ? (
            <img src={user.avatar} alt="Student profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Users size={48} color={COLORS.inkSoft} />
          )}
          <label htmlFor="student-avatar-upload" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', textAlign: 'center', padding: '6px 0', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Upload photo">
            <Camera size={16} />
            <span style={{ marginLeft: 5, fontSize: 11 }}>Change photo</span>
          </label>
          <input id="student-avatar-upload" type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, flex: 1, minWidth: 240 }}>
          <div><span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>NAME</span><div style={{ fontSize: 16, fontWeight: 600, color: COLORS.navy }}>{student.name || '—'}</div></div>
          <div><span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>ROLL NUMBER</span><div style={{ fontSize: 16, fontWeight: 600 }}>{student.rollNo || '—'}</div></div>
          <div><span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>REGISTRATION NO.</span><div style={{ fontSize: 16, fontWeight: 600 }}>{student.regNo || '—'}</div></div>
          <div><span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>CLASS & SECTION</span><div style={{ fontSize: 16, fontWeight: 600 }}>{student.class || '—'} · {student.section || '—'}</div></div>
          <div><span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>CAMPUS / SCHOOL</span><div style={{ fontSize: 16, fontWeight: 600 }}>{getCampus(student) || '—'}</div></div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */
/* Access Control Module (Super Admin IT Dept Only)                */
/* ---------------------------------------------------------------- */

function AccessControlManager({ db }) {
  const actions = useActions();
  const [selectedRole, setSelectedRole] = useState('principal');
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const rolePermissions = db.rolePermissions || DEFAULT_ROLE_PERMISSIONS;

  function toggleRolePermission(roleId, moduleId) {
    const current = rolePermissions[roleId] || [];
    const updated = current.includes(moduleId)
      ? current.filter(m => m !== moduleId)
      : [...current, moduleId];

    actions.setRoleModules(roleId, updated);
  }

  function toggleEmployeePermission(empId, moduleId) {
    const f = db.faculty.find((x) => x.id === empId);
    if (!f) return;
    const allowed = f.allowedModules || rolePermissions[f.role] || DEFAULT_ROLE_PERMISSIONS[f.role] || [];
    const newAllowed = allowed.includes(moduleId) ? allowed.filter((m) => m !== moduleId) : [...allowed, moduleId];
    actions.setEmployeeModules(empId, newAllowed);
  }

  const selectedFacultyMember = db.faculty.find(f => f.id === selectedEmployee);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ background: COLORS.greenInkBg, border: `1px solid ${COLORS.greenInk}`, padding: '14px 18px', borderRadius: 6, color: COLORS.greenInk }}>
        <strong>Super Admin Access Control (IT Dept):</strong> You can control module access globally by Role or override permissions individually per Employee.
      </div>

      <Panel icon={ShieldCheck} title="1. Global Role-Based Module Permissions">
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Select Target Role</label>
          <select className="sp-select" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
            {FACULTY_ROLES.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 14 }}>
          {MODULE_LIST.map(m => {
            const isChecked = (rolePermissions[selectedRole] || []).includes(m.id);
            return (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 4, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleRolePermission(selectedRole, m.id)}
                  disabled={selectedRole === 'super_admin' && m.id === 'access_control'}
                />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</span>
              </label>
            );
          })}
        </div>
      </Panel>

      <Panel icon={Users} title="2. Specific Employee Module Access Override">
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Select Employee</label>
          <select className="sp-select" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
            <option value="">-- Choose Employee --</option>
            {db.faculty.map(f => (
              <option key={f.id} value={f.id}>{f.name} ({f.employeeId}) - {f.designation || f.role}</option>
            ))}
          </select>
        </div>

        {selectedFacultyMember ? (
          <div>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 15, color: COLORS.navy }}>
              Access Permissions for {selectedFacultyMember.name} (Role: {selectedFacultyMember.role})
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {MODULE_LIST.map(m => {
                const empAllowed = selectedFacultyMember.allowedModules || rolePermissions[selectedFacultyMember.role] || [];
                const isChecked = empAllowed.includes(m.id);
                return (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleEmployeePermission(selectedFacultyMember.id, m.id)}
                    />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState text="Select an employee from the dropdown above to manage custom module permissions." />
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Add Employee / Registration Manager                              */
/* ---------------------------------------------------------------- */

function AddEmployeeManager({ db, user, onUserUpdate }) {
  const actions = useActions();
  const [tab, setTab] = useState('faculty');
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('faculty');
  const [department, setDepartment] = useState('');
  const [campus, setCampus] = useState(getCampus(user) || CAMPUSES[0]);
  const [designationRole, setDesignationRole] = useState(DESIGNATION_ROLES[0]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cnic, setCnic] = useState('');

  const [studentName, setStudentName] = useState('');
  const [cls, setCls] = useState(CLASSES[0]);
  const [section, setSection] = useState(SECTIONS[0]);
  const [studentCampus, setStudentCampus] = useState(getCampus(user) || CAMPUSES[0]);
  
  const [justRegistered, setJustRegistered] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [directoryCampus, setDirectoryCampus] = useState('');
  const [directoryDepartment, setDirectoryDepartment] = useState('');
  const [directoryCampusDepartment, setDirectoryCampusDepartment] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // The real Employee ID / Roll No. are issued by the database when the record is saved.
  useEffect(() => {
    setEmployeeId('Assigned on save');
  }, []);

  async function addFacultyEmployee(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await actions.createStaff({ name: name.trim(), role, designationRole, department, campus, email, phone, cnic });
    if (!res) return;
    setName('');
    setEmail('');
    setPhone('');
    setCnic('');
    setJustRegistered({ type: 'Faculty Employee', name: name.trim(), idLabel: 'Employee ID', idValue: res.employeeId });
  }

  async function addStudent(e) {
    e.preventDefault();
    if (!studentName.trim()) return;
    const res = await actions.createStudent({
      name: studentName.trim(), className: cls, section,
      campus: isCampusManager(user) ? getCampus(user) : studentCampus,
    });
    if (!res) return;
    setStudentName('');
    setJustRegistered({ type: 'Student', name: studentName.trim(), idLabel: 'Roll Number', idValue: res.rollNo });
  }

  async function saveEdit(e) {
    e.preventDefault();
    let saved;
    if (tab === 'students') {
      saved = await actions.updateStudent(editingItem);
    } else {
      const designation = normalizeDesignation(editingItem.designationRole || editingItem.designation || DESIGNATION_ROLES[0]);
      const updatedItem = { ...editingItem, designationRole: designation, designation };
      saved = await actions.updateStaff(updatedItem);
      if (saved && user?.type === 'faculty' && String(user.id) === String(updatedItem.id)) {
        onUserUpdate?.({ ...user, ...updatedItem });
      }
    }
    if (saved) setEditingItem(null);
  }

  async function resetPw(kind, id, label) {
    if (!window.confirm(`Reset the password for ${label} to the default password?`)) return;
    if (await actions.resetPassword(kind, id)) alert('Password has been reset to the default password.');
  }

  function remove(id) {
    if (!window.confirm('Are you sure you want to delete this record? Their login and all linked data will be permanently removed.')) return;
    actions.deleteUser(tab === 'students' ? 'student' : 'staff', id);
  }

  const visibleFaculty = scopeToCampus(db.faculty, user);
  const visibleStudents = scopeToCampus(db.students, user);
  const filteredFaculty = visibleFaculty.filter(
    (f) =>
      Boolean(directoryCampusDepartment) &&
      ((directoryCampusDepartment.startsWith('campus:') && getCampus(f) === directoryCampusDepartment.slice(7)) ||
        (directoryCampusDepartment.startsWith('department:') && f.department === directoryCampusDepartment.slice(11))) &&
      (
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.department && f.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (getCampus(f) && getCampus(f).toLowerCase().includes(searchQuery.toLowerCase()))
      )
  );

  const filteredStudents = visibleStudents.filter(
    (s) =>
      directoryCampusDepartment.startsWith('campus:') &&
      getCampus(s) === directoryCampusDepartment.slice(7) &&
      (
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNo.includes(searchQuery) ||
        s.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.regNo || '').includes(searchQuery) ||
        (s.section || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {justRegistered && (
        <div style={{ background: COLORS.greenInkBg, border: `1px solid ${COLORS.greenInk}`, padding: '14px 18px', borderRadius: 6, color: COLORS.greenInk }}>
          <strong>Registration Successful!</strong> Created record for <strong>{justRegistered.name}</strong>. Assigned {justRegistered.idLabel}: <strong>{justRegistered.idValue}</strong> (Default password: <code>{DEFAULT_PASSWORD}</code>).
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, borderBottom: `2px solid ${COLORS.line}`, paddingBottom: 10 }}>
        <Btn variant={tab === 'faculty' ? 'primary' : 'outline'} onClick={() => { setTab('faculty'); setEditingItem(null); }}>Faculty & Employees ({visibleFaculty.length})</Btn>
        <Btn variant={tab === 'students' ? 'primary' : 'outline'} onClick={() => { setTab('students'); setEditingItem(null); }}>Students ({visibleStudents.length})</Btn>
      </div>

      {editingItem ? (
        <Panel icon={Edit2} title={`Edit ${tab === 'students' ? 'Student' : 'Employee'}`}>
          <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {tab === 'students' ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Full Name</label>
                    <input className="sp-input" type="text" required value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Class</label>
                    <select className="sp-select" value={editingItem.class} onChange={(e) => setEditingItem({ ...editingItem, class: e.target.value })}>
                      {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Section</label>
                    <select className="sp-select" value={editingItem.section || SECTIONS[0]} onChange={(e) => setEditingItem({ ...editingItem, section: e.target.value })}>
                      {SECTIONS.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Campus / School</label>
                    <select className="sp-select" style={{ width: '100%' }} value={getCampus(editingItem)} disabled={isCampusManager(user)} onChange={(e) => setEditingItem({ ...editingItem, campus: e.target.value })}>
                      <option value="">-- Select Campus --</option>
                      {CAMPUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Registration No.</label>
                    <input className="sp-input" type="text" readOnly value={editingItem.regNo || ''} style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed', fontWeight: 'bold' }} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Employee ID</label>
                    <input className="sp-input" type="text" value={editingItem.employeeId || ''} readOnly style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed', fontWeight: 'bold' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Employee Name</label>
                    <input className="sp-input" type="text" required value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Assigned Role</label>
                    <select className="sp-select" style={{ width: '100%' }} value={editingItem.role} onChange={(e) => setEditingItem({ ...editingItem, role: e.target.value })}>
                      {FACULTY_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      {editingItem.role === 'teacher' && <option value="teacher">Teacher</option>}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Designation Role</label>
                    <select className="sp-select" style={{ width: '100%' }} value={editingItem.designationRole || editingItem.designation || DESIGNATION_ROLES[0]} onChange={(e) => setEditingItem({ ...editingItem, designationRole: e.target.value, designation: e.target.value })}>
                      {DESIGNATION_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Campus / Department</label>
                    <select className="sp-select" style={{ width: '100%' }} value={editingItem.campus ? `campus:${editingItem.campus}` : editingItem.department ? `department:${editingItem.department}` : ''} disabled={isCampusManager(user)} onChange={(e) => { const option = CAMPUS_DEPARTMENT_OPTIONS.find((item) => item.value === e.target.value); if (option) setEditingItem({ ...editingItem, campus: option.campus, department: option.department }); }}>
                      {CAMPUS_DEPARTMENT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
                    <input className="sp-input" type="email" value={editingItem.email || ''} onChange={(e) => setEditingItem({ ...editingItem, email: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Phone</label>
                    <input className="sp-input" type="text" value={editingItem.phone || ''} onChange={(e) => setEditingItem({ ...editingItem, phone: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>CNIC</label>
                    <input className="sp-input" type="text" value={editingItem.cnic || ''} onChange={(e) => setEditingItem({ ...editingItem, cnic: e.target.value })} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <Btn type="submit" variant="primary">Save Changes</Btn>
              <Btn variant="outline" onClick={() => setEditingItem(null)}>Cancel</Btn>
            </div>
          </form>
        </Panel>
      ) : (
        <Panel
          icon={showAddForm ? X : Plus}
          iconOnClick={() => { setShowAddForm((open) => !open); setEditingItem(null); }}
          iconTitle={showAddForm ? 'Close form' : 'Open add form'}
          onTitleClick={() => { setShowAddForm((open) => !open); setEditingItem(null); }}
          titleOpen={showAddForm}
          title={tab === 'faculty' ? 'Add New Faculty / Employee' : 'Register New Student'}
        >
          {showAddForm && tab === 'faculty' ? (
            <form onSubmit={addFacultyEmployee} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Employee ID</label>
                  <input className="sp-input" type="text" value={employeeId} readOnly style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed', fontWeight: 'bold' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Employee Name</label>
                  <input className="sp-input" type="text" placeholder="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Assigned Role</label>
                  <select className="sp-select" style={{ width: '100%' }} value={role} onChange={(e) => setRole(e.target.value)}>
                    {FACULTY_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Designation Role</label>
                  <select className="sp-select" style={{ width: '100%' }} value={designationRole} onChange={(e) => setDesignationRole(e.target.value)}>
                    {DESIGNATION_ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Campus / Department</label>
                  <select className="sp-select" style={{ width: '100%' }} value={campus ? `campus:${campus}` : department ? `department:${department}` : ''} disabled={isCampusManager(user)} onChange={(e) => { const option = CAMPUS_DEPARTMENT_OPTIONS.find((item) => item.value === e.target.value); if (option) { setCampus(option.campus); setDepartment(option.department); } }}>
                    {CAMPUS_DEPARTMENT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
                  <input className="sp-input" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Phone</label>
                  <input className="sp-input" type="text" placeholder="Contact number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>CNIC</label>
                  <input className="sp-input" type="text" placeholder="e.g. 17301-XXXXXXX-X" value={cnic} onChange={(e) => setCnic(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}><Btn type="submit" icon={Plus}>Add Employee</Btn></div>
            </form>
          ) : showAddForm && tab === 'students' ? (
            <form onSubmit={addStudent} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Student Name</label>
                <input className="sp-input" type="text" placeholder="Full name" required value={studentName} onChange={(e) => setStudentName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Class</label>
                <select className="sp-select" value={cls} onChange={(e) => setCls(e.target.value)}>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Section</label>
                <select className="sp-select" value={section} onChange={(e) => setSection(e.target.value)}>
                  {SECTIONS.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Campus / School</label>
                <select className="sp-select" value={isCampusManager(user) ? getCampus(user) : studentCampus} disabled={isCampusManager(user)} onChange={(e) => setStudentCampus(e.target.value)}>
                  {CAMPUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <Btn type="submit" icon={Plus}>Register Student</Btn>
            </form>
          ) : showAddForm && tab === 'students' ? (
            <form onSubmit={addStudent} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Student Name</label>
                <input className="sp-input" type="text" placeholder="Full name" required value={studentName} onChange={(e) => setStudentName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Class</label>
                <select className="sp-select" value={cls} onChange={(e) => setCls(e.target.value)}>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Section</label>
                <select className="sp-select" value={section} onChange={(e) => setSection(e.target.value)}>
                  {SECTIONS.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Campus / School</label>
                <select className="sp-select" value={isCampusManager(user) ? getCampus(user) : studentCampus} disabled={isCampusManager(user)} onChange={(e) => setStudentCampus(e.target.value)}>
                  {CAMPUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <Btn type="submit" icon={Plus}>Register Student</Btn>
            </form>
          ) : null}
        </Panel>
      )}

      <Panel
        icon={Search}
        title={`${tab === 'faculty' ? 'Faculty & Staff' : 'Student'} Directory`}
        onTitleClick={() => setDirectoryOpen((open) => !open)}
        titleOpen={directoryOpen}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <select className="sp-select" style={{ width: '100%' }} value={directoryCampusDepartment} onChange={(e) => { const value = e.target.value; setDirectoryCampusDepartment(value); const option = CAMPUS_DEPARTMENT_OPTIONS.find((item) => item.value === value); setDirectoryCampus(option?.campus || ''); setDirectoryDepartment(option?.department || ''); }}>
            <option value="">-- Select Campus / Department --</option>
            {CAMPUS_DEPARTMENT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: 220, maxWidth: '100%' }}>
              <input className="sp-input" type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: 30 }} />
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: COLORS.inkSoft }} />
            </div>
          </div>
        </div>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                {tab === 'faculty' ? (
                  <>
                    <th>Role & Dept</th>
                    <th>Designation</th>
                    <th>Contact</th>
                  </>
                ) : (
                  <>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Reg No.</th>
                  </>
                )}
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tab === 'faculty' ? (
                filteredFaculty.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState text={directoryCampusDepartment ? 'No employee records found for this campus / department.' : 'Select a campus / department above to view records.'} /></td></tr>
                ) : (
                  filteredFaculty.map((f) => (
                    <tr key={f.id} className="sp-row">
                      <td><strong>{f.employeeId}</strong></td>
                      <td>{f.name}</td>
                      <td>
                        <Badge text={f.role} tone="brass" />
                        <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>{f.department || f.campus || '—'}</div>
                      </td>
                      <td>{getFacultyDesignation(f)}</td>
                      <td>
                        <div style={{ fontSize: 12 }}>{f.email || '—'}</div>
                        <div style={{ fontSize: 11, color: COLORS.inkSoft }}>{f.phone || ''}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Btn variant="ghost" onClick={() => setEditingItem(f)} icon={Edit2} />
                        {f.id !== user.id && <Btn variant="ghost" onClick={() => resetPw('staff', f.id, f.name)} icon={KeyRound} />}
                        <Btn variant="ghost" onClick={() => remove(f.id)} icon={Trash2} />
                      </td>
                    </tr>
                  ))
                )
              ) : (
                filteredStudents.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState text={directoryCampusDepartment ? 'No student records found for this campus.' : 'Select a campus above to view students.'} /></td></tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="sp-row">
                      <td><strong>{s.rollNo}</strong></td>
                      <td>{s.name}</td>
                      <td><Badge text={s.class} /></td>
                      <td><Badge text={s.section || '—'} tone="brass" /></td>
                      <td>#{s.regNo || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Btn variant="ghost" onClick={() => setEditingItem(s)} icon={Edit2} />
                        <Btn variant="ghost" onClick={() => resetPw('student', s.id, s.name)} icon={KeyRound} />
                        <Btn variant="ghost" onClick={() => remove(s.id)} icon={Trash2} />
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Attendance Module                                                */
/* ---------------------------------------------------------------- */

function AttendanceManager({ user, db, }) {
  const actions = useActions();
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const key = `${selectedClass}|${selectedDate}`;
  const record = db.attendance[key] || {};

  function markStatus(studentId, status) {
    actions.markAttendance(studentId, selectedClass, selectedDate, status);
  }

  const classStudents = scopeToCampus(db.students, user).filter((s) => s.class === selectedClass);

  if (user.type === 'student') {
    const studentRecords = Object.entries(db.attendance)
      .filter(([k]) => k.startsWith(`${user.class}|`))
      .map(([k, rec]) => ({ date: k.split('|')[1], status: rec[user.id] }))
      .filter((r) => r.status)
      .sort((a, b) => b.date.localeCompare(a.date));

    return (
      <Panel icon={CalendarCheck} title={`Attendance Log (${user.class})`}>
        {studentRecords.length === 0 ? (
          <EmptyState text="No attendance entries recorded yet." />
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {studentRecords.map((r) => (
                  <tr key={r.date} className="sp-row">
                    <td>{fmtDate(r.date)}</td>
                    <td>
                      <Badge
                        text={r.status === 'P' ? 'Present' : r.status === 'A' ? 'Absent' : 'Leave'}
                        tone={r.status === 'P' ? 'good' : r.status === 'A' ? 'bad' : 'neutral'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Panel icon={CalendarCheck} title="Mark & Review Attendance">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Select Class</label>
            <select className="sp-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Date</label>
            <input className="sp-input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        </div>

        {classStudents.length === 0 ? (
          <EmptyState text={`No students registered in ${selectedClass}.`} />
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th style={{ textAlign: 'right' }}>Attendance Status</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((s) => {
                  const status = record[s.id];
                  return (
                    <tr key={s.id} className="sp-row">
                      <td><strong>{s.rollNo}</strong></td>
                      <td>{s.name}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <Btn variant={status === 'P' ? 'primary' : 'outline'} onClick={() => markStatus(s.id, 'P')}>Present</Btn>
                          <Btn variant={status === 'A' ? 'danger' : 'outline'} onClick={() => markStatus(s.id, 'A')}>Absent</Btn>
                          <Btn variant={status === 'L' ? 'brass' : 'outline'} onClick={() => markStatus(s.id, 'L')}>Leave</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Grades Module                                                    */
/* ---------------------------------------------------------------- */

function GradeManager({ user, db, }) {
  const actions = useActions();
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [term, setTerm] = useState('Mid Term');
  const [marks, setMarks] = useState({});

  const classStudents = scopeToCampus(db.students, user).filter((s) => s.class === selectedClass);

  async function saveGrades(e) {
    e.preventDefault();
    const rows = classStudents
      .filter((st) => marks[st.id] !== undefined && marks[st.id] !== '')
      .map((st) => ({ studentId: st.id, subject: selectedSubject, term, score: Number(marks[st.id]), date: todayISO() }));
    if (!rows.length) return;
    if (await actions.saveGrades(rows)) alert('Grades saved successfully!');
  }

  if (user.type === 'student') {
    const studentGrades = db.grades[user.id] || [];
    return (
      <Panel icon={GraduationCap} title="Academic Grade Sheet">
        {studentGrades.length === 0 ? (
          <EmptyState text="No grade reports published yet." />
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Assessment Term</th>
                  <th>Score / Marks</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {studentGrades.map((g, idx) => (
                  <tr key={idx} className="sp-row">
                    <td><strong>{g.subject}</strong></td>
                    <td><Badge text={g.term} tone="brass" /></td>
                    <td><span style={{ fontSize: 16, fontWeight: 600, color: COLORS.navy }}>{g.score}</span> / 100</td>
                    <td>{fmtDate(g.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel icon={GraduationCap} title="Enter Student Grades">
      <form onSubmit={saveGrades}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Class</label>
            <select className="sp-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Subject</label>
            <select
              className="sp-select"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Assessment Term</label>
            <select className="sp-select" value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="Quiz 1">Quiz 1</option>
              <option value="Quiz 2">Quiz 2</option>
              <option value="Mid Term">Mid Term</option>
              <option value="Final Exam">Final Exam</option>
            </select>
          </div>
        </div>

        {classStudents.length === 0 ? (
          <EmptyState text={`No students found in ${selectedClass}.`} />
        ) : (
          <>
            <div className="sp-table-wrap" style={{ marginBottom: 20 }}>
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th style={{ width: 160 }}>Marks (Out of 100)</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((s) => {
                    const existing = (db.grades[s.id] || []).find((g) => g.subject === selectedSubject && g.term === term);
                    return (
                      <tr key={s.id} className="sp-row">
                        <td><strong>{s.rollNo}</strong></td>
                        <td>{s.name}</td>
                        <td>
                          <input
                            className="sp-input"
                            type="number"
                            min="0"
                            max="100"
                            placeholder={existing ? String(existing.score) : '0-100'}
                            value={marks[s.id] ?? ''}
                            onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Btn type="submit" variant="primary">Save Grade Entries</Btn>
          </>
        )}
      </form>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */
/* Fee Management Module                                            */
/* ---------------------------------------------------------------- */

function FeeManager({ user, db, }) {
  const actions = useActions();
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  const [month, setMonth] = useState('September 2026');
  const [amount, setAmount] = useState('5000');

  async function generateInvoices() {
    const classStudents = scopeToCampus(db.students, user).filter((s) => s.class === selectedClass);
    if (!classStudents.length) return alert('No students in selected class.');
    const added = await actions.generateInvoices(classStudents.map((s) => s.id), month, Number(amount));
    if (added !== false) alert(`Generated fee invoices for ${added} student(s).`);
  }

  function toggleFeeStatus(studentId, feeId) {
    const fee = (db.fees[studentId] || []).find((f) => f.id === feeId);
    if (fee) actions.setFeePaid(feeId, !fee.paid);
  }

  if (user.type === 'student') {
    const myFees = db.fees[user.id] || [];
    return (
      <Panel icon={Wallet} title="Fee & Payment Ledger">
        {myFees.length === 0 ? (
          <EmptyState text="No fee vouchers or dues available." />
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Billing Month</th>
                  <th>Amount (PKR)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {myFees.map((f) => (
                  <tr key={f.id} className="sp-row">
                    <td><strong>{f.month}</strong></td>
                    <td>Rs. {f.amount.toLocaleString()}</td>
                    <td>
                      <Badge
                        text={f.paid ? 'Paid' : 'Unpaid'}
                        tone={f.paid ? 'good' : 'bad'}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    );
  }

  const classStudents = scopeToCampus(db.students, user).filter((s) => s.class === selectedClass);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Panel icon={Plus} title="Generate Fee Vouchers">
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Target Class</label>
            <select className="sp-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Month/Billing Cycle</label>
            <input className="sp-input" type="text" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Amount (PKR)</label>
            <input className="sp-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <Btn onClick={generateInvoices} variant="brass">Issue Invoices</Btn>
        </div>
      </Panel>

      <Panel icon={Wallet} title={`Class Fee Status (${selectedClass})`}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Select Class</label>
          <select className="sp-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {classStudents.length === 0 ? (
          <EmptyState text={`No students in ${selectedClass}.`} />
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Issued Vouchers</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((s) => {
                  const studentFees = db.fees[s.id] || [];
                  return (
                    <tr key={s.id} className="sp-row">
                      <td><strong>{s.rollNo}</strong></td>
                      <td>{s.name}</td>
                      <td>
                        {studentFees.length === 0 ? (
                          <span style={{ fontSize: 12, color: COLORS.inkSoft }}>No invoices</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {studentFees.map((f) => (
                              <button
                                key={f.id}
                                className="sp-btn"
                                onClick={() => toggleFeeStatus(s.id, f.id)}
                                style={{
                                  background: f.paid ? COLORS.greenInkBg : COLORS.redInkBg,
                                  color: f.paid ? COLORS.greenInk : COLORS.redInk,
                                  border: `1px solid ${f.paid ? COLORS.greenInk : COLORS.redInk}`,
                                  padding: '4px 8px',
                                  fontSize: 12,
                                  borderRadius: 4,
                                }}
                              >
                                {f.month}: Rs.{f.amount} ({f.paid ? 'Paid' : 'Mark Paid'})
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Fun Fair Ticket — Visual Ticket Card                              */
/* ---------------------------------------------------------------- */

function TicketCardVisual({ ticket, student }) {
  return (
    <div style={{
      position: 'relative', display: 'flex', borderRadius: 10, overflow: 'hidden',
      boxShadow: '0 6px 16px rgba(0,0,0,0.22)', width: '100%', maxWidth: 380,
    }}>
      {/* Notch cutouts */}
      <div style={{ position: 'absolute', left: -9, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: '50%', background: COLORS.paper, zIndex: 2 }} />
      <div style={{ position: 'absolute', right: -9, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, borderRadius: '50%', background: COLORS.paper, zIndex: 2 }} />

      {/* Left stub: student identity */}
      <div style={{ width: 108, flexShrink: 0, background: '#fff', padding: '12px 9px', display: 'flex', flexDirection: 'column', gap: 5, borderRight: '2px dashed #cbd5e1' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Student Name</div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.15 }}>{student?.name || '—'}</div>

        <div style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>Class</div>
        <div style={{ fontSize: 11.5, fontWeight: 800, background: '#E91E8C', color: '#fff', padding: '2px 6px', borderRadius: 4, width: 'fit-content' }}>{student?.class || '—'}</div>

        <div style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>Section</div>
        <div style={{ fontSize: 11.5, fontWeight: 800, background: '#E91E8C', color: '#fff', padding: '2px 6px', borderRadius: 4, width: 'fit-content' }}>{student?.section || '—'}</div>

        <div style={{ marginTop: 'auto', paddingTop: 6 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Registration No.</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>#{student?.regNo || '—'}</div>
        </div>

        <div style={{ display: 'flex', gap: 1, marginTop: 6, height: 22, alignItems: 'flex-end' }}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{ width: i % 3 === 0 ? 2 : 1, height: '100%', background: '#0f172a' }} />
          ))}
        </div>
      </div>

      {/* Admit One vertical strip */}
      <div style={{ width: 20, flexShrink: 0, background: '#0d1526', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '2px dashed rgba(255,255,255,0.25)' }}>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: '#fff', fontSize: 9.5, fontWeight: 800, letterSpacing: 2 }}>ADMIT ONE</div>
      </div>

      {/* Main body */}
      <div style={{ flex: 1, minWidth: 0, background: 'linear-gradient(155deg,#151d33,#0c1220)', padding: '12px 14px', position: 'relative', color: '#fff' }}>
        <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: 0.5, color: '#F14FB4', lineHeight: 1 }}>FUNFAIR</div>
        <div style={{ display: 'inline-block', background: '#E91E8C', color: '#fff', fontSize: 9.5, fontWeight: 800, letterSpacing: 2, padding: '2px 8px', marginTop: 5, borderRadius: 2 }}>TICKET</div>

        <div style={{ fontSize: 17, fontWeight: 900, marginTop: 8, fontStyle: 'italic' }}>
          <span style={{ color: '#F14FB4' }}>Fun</span><span style={{ color: '#fff' }}>Gala</span>
        </div>
        <div style={{ display: 'inline-block', background: '#E91E8C', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 10px', borderRadius: 2, marginTop: 2 }}>
          ★ {TICKET_EVENT.org} ★
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', marginTop: 3 }}>{TICKET_EVENT.school}</div>

        <div style={{ position: 'absolute', bottom: 10, right: 12, textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 800 }}>{TICKET_EVENT.date}</div>
          <div style={{ fontSize: 9, color: '#94a3b8' }}>Ticket #{ticket?.ticketNo}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Fun Fair Ticket Manager (apply / approve / issue)                 */
/* ---------------------------------------------------------------- */

const LUCKY_DRAW_PRIZES = [
  { name: 'Smartphone', emoji: '📱', color: '#17202c' },
  { name: 'Bicycle', emoji: '🚲', color: '#292216' },
  { name: 'Console', emoji: '🎮', color: '#18181d' },
  { name: 'Headphones', emoji: '🎧', color: '#292319' },
  { name: 'Smart Watch', emoji: '⌚', color: '#121820' },
  { name: 'Movie Tickets', emoji: '🎟️', color: '#332719' },
  { name: 'Gift Hamper', emoji: '🎁', color: '#211b20' },
];

function FullLuckyDrawPanel({ db, }) {
  const actions = useActions();
  const prizes = [
    { name: 'Smartphone', emoji: '📱', color: '#121215' },
    { name: 'Bicycle', emoji: '🚲', color: '#221D10' },
    { name: 'Console', emoji: '🎮', color: '#16161A' },
    { name: 'Headphones', emoji: '🎧', color: '#2A2415' },
    { name: 'Smart Watch', emoji: '⌚', color: '#101012' },
    { name: 'Movie Tickets', emoji: '🎟️', color: '#332B18' },
    { name: 'Gift Hamper', emoji: '🎁', color: '#1A1A1E' },
  ];
  const [phase, setPhase] = useState('idle');
  const [wheelRotation, setWheelRotation] = useState(0);
  const [selected, setSelected] = useState(null);
  const [reel, setReel] = useState([]);
  const [reelIndex, setReelIndex] = useState(0);
  const [winner, setWinner] = useState(null);
  const [live, setLive] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const timers = React.useRef([]);
  const drawLocked = React.useRef(false);
  const leverPulled = React.useRef(false);
  const winners = db.luckyDrawWinners || [];
  const issued = db.tickets || [];
  const claimedPrizes = new Set(winners.map((w) => w.prizeName || w.gift?.name));
  const claimedStudents = new Set(winners.map((w) => w.studentId || w.student?.id));
  const remaining = prizes.filter((p) => !claimedPrizes.has(p.name));
      // Build the draw pool from issued tickets and resolve students using string IDs.
  // This also supports data saved before IDs were consistently typed as strings.
  const claimedStudentKeys = new Set(
    winners.map((w) => {
      const rawStudentId = w.studentId ?? w.student?.id ?? '';
      const student = (db.students || []).find((s) => (
        String(s.id) === String(rawStudentId) ||
        String(s.rollNo) === String(rawStudentId) ||
        String(s.regNo) === String(rawStudentId)
      ));
      return String(student?.id ?? rawStudentId);
    })
  );
  const linkedTickets = issued
    .map((ticket) => {
      const rawStudentId = ticket.studentId ?? ticket.student?.id ?? ticket.studentIdValue;
      const student = (db.students || []).find((s) => (
        String(s.id) === String(rawStudentId) ||
        String(s.rollNo) === String(rawStudentId) ||
        String(s.regNo) === String(rawStudentId)
      ));
      return student ? {
        ticket: { ...ticket, studentId: student.id },
        student,
      } : null;
    })
    .filter((entry) => entry?.ticket?.id && entry?.student?.id);
  const pool = linkedTickets.filter(({ student }) =>
    !claimedStudentKeys.has(String(student.id))
  );
  const participatingStudentCount = new Set(linkedTickets.map(({ student }) => String(student.id))).size;
  const drawDisabledReason = !remaining.length
    ? 'All prizes have been claimed.'
    : !pool.length
      ? 'Approve at least one Fun Fair ticket before starting the draw.'
      : '';

  useEffect(() => () => {
    timers.current.forEach((timerId) => {
      window.clearTimeout(timerId);
      window.clearInterval(timerId);
    });
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => setLive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  function later(fn, ms) { const id = window.setTimeout(fn, ms); timers.current.push(id); return id; }
  function burst() {
    setConfetti(Array.from({ length: 90 }, (_, i) => ({ id: `${Date.now()}-${i}`, left: `${Math.random() * 100}%`, color: ['#D4AF37', '#FCF6BA', '#B38728', '#FFFFFF'][i % 4], delay: `${Math.random() * .8}s`, duration: `${2 + Math.random() * 2.5}s` })));
    later(() => setConfetti([]), 5000);
  }
  function toggleLive() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      setLive(false);
    } else {
      const request = document.querySelector('.fd-app')?.requestFullscreen?.();
      request?.catch(() => setLive(false));
      setLive(true);
    }
  }
  function resetDraw() {
    if (!window.confirm('Reset the entire lucky draw? This will remove all winners and restore every prize. Approved tickets will remain available for testing.')) return;

    timers.current.forEach((timerId) => {
      window.clearTimeout(timerId);
      window.clearInterval(timerId);
    });
    timers.current = [];
    drawLocked.current = false;
    leverPulled.current = false;
    actions.resetWinners();
    setPhase('idle');
    setWheelRotation(0);
    setSelected(null);
    setReel([]);
    setReelIndex(0);
    setWinner(null);
    setConfetti([]);
  }
  function startDraw() {
    if (phase !== 'idle' || drawLocked.current || !remaining.length || !pool.length) return;

    const validPool = pool.filter((item) => item.ticket?.id && item.student?.id);
    if (!validPool.length) return;

    drawLocked.current = true;
    leverPulled.current = false;
    const targetIndex = Math.floor(Math.random() * remaining.length);
    const prize = remaining[targetIndex];
    const segment = 360 / remaining.length;
    const offset = (Math.random() * 0.8 + 0.1) * segment;

    // Select the prize during the spin; the actual eligible student is drawn
    // only when the Super Admin pulls the lever.
    setSelected({ prize });
    setReel([]);
    setReelIndex(0);
    setWinner(null);
    if (remaining.length === 1) {
      setPhase('lever');
      return;
    }

    const finalRotation = 8 * 360 + (360 - (targetIndex * segment + offset));
    setWheelRotation(finalRotation);
    setPhase('spinning');
    later(() => setPhase('lever'), 1700);
  }
  function pullLever() {
    if (phase !== 'lever' || leverPulled.current || !selected?.prize) return;
    leverPulled.current = true;

    const candidates = pool.filter((item) => item.ticket?.id && item.student?.id);
    if (!candidates.length) {
      drawLocked.current = false;
      leverPulled.current = false;
      setPhase('idle');
      return;
    }

    // Each issued ticket is an entry, so students with more approved tickets
    // have proportionally more chances; a student can still win only once.
    const winningEntry = candidates[Math.floor(Math.random() * candidates.length)];
    const sequence = Array.from({ length: 16 }, () =>
      candidates[Math.floor(Math.random() * candidates.length)]
    ).concat(winningEntry);

    setReel(sequence);
    setReelIndex(0);
    setPhase('searching');

    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setReelIndex(Math.min(index, sequence.length - 1));
    }, 90);
    timers.current.push(interval);

    later(() => {
      window.clearInterval(interval);
      const { ticket, student } = winningEntry;
      const result = {
        id: uid(),
        ticketId: ticket.id,
        ticketNo: ticket.ticketNo,
        studentId: student.id,
        studentName: student.name,
        class: student.class,
        section: student.section || '—',
        campus: student.campus || student.school || '—',
        prizeName: selected.prize.name,
        prizeEmoji: selected.prize.emoji,
        drawnAt: new Date().toISOString(),
        drawnBy: 'Super Admin'
      };
      actions.addWinner(result);
      setWinner(result);
      setPhase('winner');
      burst();
    }, 1600);
  }
  const wheelBackground = remaining.length
    ? `conic-gradient(${remaining.map((p, i) => `${p.color} ${i * 360 / remaining.length}deg ${(i + 1) * 360 / remaining.length - 2}deg, #D4AF37 ${(i + 1) * 360 / remaining.length - 2}deg ${(i + 1) * 360 / remaining.length}deg`).join(',')})`
    : '#111';
  const css = `
    .fd-app{background:#030304;color:#fff;border:1px solid rgba(212,175,55,.5);border-radius:24px;padding:20px;position:relative;overflow:hidden;font-family:Inter,system-ui,sans-serif;background-image:radial-gradient(ellipse 120% 45% at 50% 65%,rgba(212,175,55,.22),transparent 75%)}
    .fd-app *{box-sizing:border-box}.fd-top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}.fd-brand{display:flex;align-items:center;gap:12px;background:#0f0f12;border:1px solid rgba(212,175,55,.4);border-radius:12px;padding:8px 16px}.fd-crest{width:55px;height:55px;border:3px solid #d4af37;border-radius:50%;display:grid;place-items:center;color:#d4af37;font-size:25px}.fd-brand b{display:block;font-size:18px;letter-spacing:-.5px}.fd-brand small{display:block;font-size:13px;letter-spacing:1px}.fd-live,.fd-spin,.fd-close{border:0;cursor:pointer;font-weight:900}.fd-live{background:linear-gradient(135deg,#bf953f,#fcf6ba,#aa771c);color:#050505;border-radius:25px;padding:11px 18px}.fd-marquee{text-align:center;margin:20px 0 24px;padding:25px 15px;background:linear-gradient(#16161a,#0a0a0c);border:1px solid rgba(212,175,55,.5);border-radius:22px;box-shadow:inset 0 0 20px rgba(212,175,55,.12)}.fd-tag{display:inline-block;background:linear-gradient(135deg,#bf953f,#fcf6ba,#aa771c);color:#000;border-radius:18px;padding:4px 16px;font-size:11px;font-weight:900;letter-spacing:1px}.fd-headtag{color:#d4af37;font-size:15px;font-weight:800;letter-spacing:1px;margin-top:9px}.fd-title{font-family:Georgia,serif;font-size:clamp(30px,5vw,52px);margin:7px 0;background:linear-gradient(135deg,#bf953f,#fff2b2,#aa771c);-webkit-background-clip:text;color:transparent;letter-spacing:2px}.fd-muted{color:#a1a1aa;font-size:13px}.fd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin-bottom:24px}.fd-stat,.fd-prize,.fd-stage,.fd-history,.fd-slot,.fd-poster{background:rgba(15,15,18,.88);border:1px solid rgba(212,175,55,.4);box-shadow:0 8px 25px #0008,inset 0 0 12px #d4af3710}.fd-stat{border-radius:14px;padding:14px 17px;display:flex;justify-content:space-between}.fd-stat b{font-size:24px}.fd-stat small{display:block;color:#d4af37;font-size:10px;font-weight:800;text-transform:uppercase;margin-top:3px}.fd-layout{display:grid;grid-template-columns:280px 1fr;gap:22px;align-items:start}.fd-panel-title{color:#d4af37;font-weight:900;letter-spacing:1px;margin:4px 0 12px}.fd-prizes{display:flex;flex-direction:column;gap:10px}.fd-prize{display:flex;align-items:center;gap:10px;border-radius:12px;padding:10px}.fd-prize.won{opacity:.35;filter:grayscale(1)}.fd-swatch{font-size:22px;width:40px;height:40px;border:1px solid #d4af3766;border-radius:10px;display:grid;place-items:center}.fd-prize-info{flex:1}.fd-prize-info b{font-size:14px}.fd-prize-info small{display:block;color:#a1a1aa;font-size:11px;margin-top:2px}.fd-badge{font-size:9px;color:#d4af37;border:1px solid #d4af3766;border-radius:5px;padding:3px 6px;font-weight:900}.fd-stage{min-height:600px;border-radius:22px;padding:40px 18px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}.fd-banner{position:absolute;top:18px;background:#0a0a0c;border:1px solid #d4af37;border-radius:25px;padding:9px 20px;color:#fff;font-weight:800;font-size:12px;letter-spacing:.7px;text-align:center}.fd-wheel-wrap{position:relative;width:min(450px,78vw);height:min(450px,78vw);margin-top:25px}.fd-wheel-outer{position:absolute;inset:0;border-radius:50%;border:15px solid #08080a;outline:4px solid #d4af37;box-shadow:0 20px 45px #000,inset 0 0 35px #000;overflow:hidden}.fd-wheel{position:absolute;inset:0;border-radius:50%;transform:rotate(0deg);transition:transform 1.7s cubic-bezier(.12,.82,.16,1);will-change:transform}.fd-wheel.fd-wheel-spinning{animation:fdSpin 1.7s cubic-bezier(.1,.85,.15,1) forwards}@keyframes fdSpin{from{transform:rotate(0deg)}to{transform:rotate(1440deg)}}@keyframes fdSpin{from{transform:rotate(0deg)}to{transform:rotate(1440deg)}}    .fd-wheel-label{position:absolute;top:50%;left:50%;width:38px;height:38px;margin:-19px;display:grid;place-items:center;font-size:28px;z-index:2}.fd-spin{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#bf953f,#fcf6ba,#aa771c);border:4px solid #0a0a0c;font-size:19px}.fd-slot-wrap{width:min(650px,94%);display:flex;align-items:center;justify-content:center;position:relative;margin:30px auto 0;padding-right:38px}.fd-slot{width:min(520px,100%);border:2px solid #d4af37;border-radius:20px;padding:28px 20px;text-align:center;position:relative;z-index:2}.fd-slot h3{margin:7px 0 15px;font-size:22px}.fd-reel{height:90px;overflow:hidden;border:2px solid #d4af3799;border-radius:12px;background:#121215}.fd-reel-inner{transition:transform 1.2s cubic-bezier(.1,.85,.15,1)}.fd-reel-item{height:90px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:24px;font-weight:800}.fd-reel-item small{color:#d4af37;font-family:monospace;font-size:13px;margin-top:4px}.fd-lever-control{width:52px;height:150px;position:relative;flex:none;cursor:pointer;z-index:4}.fd-lever-base{position:absolute;left:0;top:50%;width:32px;height:64px;transform:translateY(-50%);border:2px solid #d4af37;border-left:0;border-radius:0 16px 16px 0;background:#1c1c20;box-shadow:inset -4px 0 10px #0009,5px 5px 15px #000c}.fd-lever-arm{position:absolute;left:15px;top:18px;width:14px;height:82px;border-radius:8px;background:linear-gradient(90deg,#8a7322,#fbf5b7,#8a7322);transform-origin:bottom center;transition:transform .5s cubic-bezier(.175,.885,.32,1.275);box-shadow:3px 3px 10px #000b}.fd-lever-*****{position:absolute;left:-13px;top:-30px;width:40px;height:40px;border:2px solid #d4af37;border-radius:50%;background:radial-gradient(circle at 30% 30%,#fcf6ba,#b38728 70%,#59410d);box-shadow:inset -4px -4px 8px #0008,0 0 15px #d4af3799}.fd-lever-control:hover .fd-lever-arm{transform:rotate(15deg)}.fd-lever-control.is-pulled .fd-lever-arm{transform:rotate(150deg)}.fd-history{margin-top:25px;border-radius:16px;overflow:auto}.fd-history table{background:transparent;color:#fff;border:0}.fd-history th{color:#d4af37;background:#16161a}.fd-history td{border-color:#ffffff10}.fd-poster{max-width:850px;width:100%;border:2px solid #d4af37;border-radius:25px;padding:30px;text-align:center}.fd-poster h2{font-family:Georgia,serif;color:#d4af37}.fd-winners-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.fd-winner-card{background:#111115;border:1px solid #d4af3780;border-radius:15px;padding:18px}.fd-overlay{position:fixed;inset:0;background:#050505f2;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}.fd-modal{background:linear-gradient(#16161a,#0a0a0c);border:2px solid #d4af37;border-radius:25px;padding:35px;text-align:center;max-width:500px;width:100%;box-shadow:0 0 70px #d4af3780}.fd-modal h2{color:#d4af37;font-family:Georgia,serif}.fd-winner-name{font-size:34px;font-weight:900}.fd-ticket{display:inline-block;background:linear-gradient(135deg,#bf953f,#fcf6ba);color:#050505;border-radius:25px;padding:6px 18px;font-family:monospace;font-weight:900;margin:10px}.fd-confetti{position:fixed;top:-18px;width:10px;height:16px;z-index:110;animation:fdFall 4s linear forwards}@keyframes fdFall{to{transform:translateY(110vh) rotate(720deg)}}@media(max-width:800px){.fd-layout{grid-template-columns:1fr}.fd-winners-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){.fd-winners-grid{grid-template-columns:1fr}.fd-stage{min-height:470px}}
    .fd-app{max-width:1280px;margin:0 auto;padding:clamp(14px,2.5vw,28px);background-color:#030304;background-image:radial-gradient(ellipse 120% 40% at 50% 60%,rgba(212,175,55,.22),transparent 75%),radial-gradient(circle at 12% 20%,rgba(255,215,0,.12),transparent 18%),radial-gradient(circle at 85% 70%,rgba(255,200,50,.1),transparent 20%)}
    .fd-app.fd-live-mode{height:100vh;min-height:100vh;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;border:0;border-radius:0;padding:clamp(16px,3vw,40px)}.fd-app.fd-live-mode .fd-history{display:none}.fd-app.fd-live-mode .fd-stage{min-height:min(72vh,850px)}
    .fd-brand{gap:14px;padding:9px 18px;box-shadow:0 4px 20px #000c,inset 0 0 14px rgba(212,175,55,.12);backdrop-filter:blur(8px)}.fd-crest{width:58px;height:58px;border-width:3px;box-shadow:0 0 16px rgba(212,175,55,.45)}.fd-brand b{font-size:16px;letter-spacing:.4px}.fd-brand small{font-size:10px;color:#d4af37;letter-spacing:1.4px;margin-top:3px}
    .fd-marquee{padding:clamp(22px,4vw,36px) 18px;margin-bottom:24px;backdrop-filter:blur(8px)}.fd-title{font-family:Georgia,serif;letter-spacing:3px}.fd-tag,.fd-live{box-shadow:0 0 18px rgba(212,175,55,.35)}
    .fd-stat,.fd-prize,.fd-stage,.fd-history,.fd-poster{backdrop-filter:blur(8px);box-shadow:0 10px 30px #0009,inset 0 0 14px rgba(212,175,55,.06)}.fd-stage{min-height:620px;padding:48px 24px}.fd-prize{padding:12px 14px;transition:transform .2s ease,border-color .2s ease}.fd-prize:not(.won):hover{transform:translateX(3px);border-color:#fcf6ba}
    .fd-wheel-wrap{width:min(480px,78vw);height:min(480px,78vw)}.fd-wheel-outer{border-width:16px;outline-width:4px}    .fd-wheel{transition:transform 1.7s cubic-bezier(.1,.85,.15,1)}.fd-wheel.fd-wheel-spinning{animation:none!important;transition:transform 1.7s cubic-bezier(.1,.85,.15,1)}@keyframes fdWheelSpin{from{transform:rotate(0deg)}to{transform:rotate(var(--fd-target-rotation))}}

    .fd-wheel-pointer{position:absolute;top:-18px;left:50%;margin-left:-22px;width:44px;height:50px;z-index:5;background:linear-gradient(135deg,#bf953f,#fcf6ba,#aa771c);clip-path:polygon(50% 100%,0 0,100% 0);filter:drop-shadow(0 6px 12px #000e)}.fd-last-prize{animation:fdTension .1s infinite alternate}.fd-last-prize .fd-wheel-pointer{animation:fdPointerPulse .4s infinite alternate}@keyframes fdTension{from{transform:scale(1.02) rotate(-1deg)}to{transform:scale(1.02) rotate(1deg)}}@keyframes fdPointerPulse{from{filter:drop-shadow(0 0 5px #ffd700)}to{filter:drop-shadow(0 0 22px #ffdf73);transform:scale(1.12)}}
    .fd-spin{width:90px;height:90px;font-size:20px;box-shadow:0 10px 30px #000c;transition:transform .2s ease,box-shadow .2s ease}.fd-spin:not(:disabled):hover{transform:translate(-50%,-50%) scale(1.1);box-shadow:0 0 38px #d4af37}
    .fd-poster{max-width:880px;padding:clamp(22px,4vw,38px);border-width:2px;border-radius:28px}.fd-poster h2{font-size:clamp(28px,4vw,42px);letter-spacing:2px}.fd-winner-card{position:relative;padding:24px 16px 18px;box-shadow:inset 0 0 15px rgba(212,175,55,.08)}.fd-winner-rank{position:absolute;top:-11px;left:16px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#bf953f,#fcf6ba,#aa771c);color:#090909;font-weight:900}
    .fd-modal{backdrop-filter:blur(12px);padding:clamp(24px,5vw,42px)}.fd-winner-name{font-family:Inter,system-ui,sans-serif}.fd-continue{display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:24px;padding:13px 28px;border:1px solid #fcf6ba;border-radius:999px;background:linear-gradient(135deg,#bf953f 0%,#fcf6ba 48%,#aa771c 100%);color:#111;font:900 13px/1 Inter,system-ui,sans-serif;letter-spacing:1px;text-transform:uppercase;box-shadow:0 5px 18px rgba(212,175,55,.38),inset 0 1px 0 rgba(255,255,255,.7);cursor:pointer;transition:transform .2s ease,box-shadow .2s ease}.fd-continue:hover{transform:translateY(-2px);box-shadow:0 8px 26px rgba(212,175,55,.55),inset 0 1px 0 rgba(255,255,255,.7)}.fd-continue:focus-visible{outline:3px solid #fff;outline-offset:3px}.fd-confetti{pointer-events:none}
    @media(max-width:600px){.fd-stage{min-height:480px;padding:44px 12px}.fd-slot-wrap{padding-right:18px}.fd-slot{padding:22px 14px}.fd-brand{gap:9px;padding:7px 10px}.fd-crest{width:46px;height:46px}.fd-brand b{font-size:13px}.fd-brand small{font-size:9px}}
  `;
  const history = winners.slice().reverse();
  const winnerSection = (entry) => entry.section || (db.students || []).find((student) => String(student.id) === String(entry.studentId))?.section || '—';
  return <div className={`fd-app${live ? ' fd-live-mode' : ''}`}><style>{css}</style>
    <div className="fd-top"><div className="fd-brand"><div className="fd-crest">✦</div><div><b>PESHAWAR MODEL</b><small>EDUCATIONAL NETWORK</small></div></div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button type="button" className="fd-live" onClick={resetDraw}>↻ Reset Entire Draw</button><button className="fd-live" onClick={toggleLive}>{live ? '❌ Exit Live Mode' : '📺 Full Screen Live Draw'}</button></div></div>
    <div className="fd-marquee"><span className="fd-tag">PMS FUNFAIR 2026</span><div className="fd-headtag">🏆 PESHAWAR MODEL SCHOOLS FUN FAIR 2026</div><div className="fd-title">GRAND LUCKY DRAW</div><div className="fd-muted">Where Every Ticket Has a Chance to Win</div></div>
    <div className="fd-stats"><div className="fd-stat"><div><b>{participatingStudentCount}</b><small>Students</small></div><span>👨‍🎓</span></div><div className="fd-stat"><div><b>{linkedTickets.length}</b><small>Total Tickets</small></div><span>🎟️</span></div><div className="fd-stat"><div><b>{remaining.length} / {prizes.length}</b><small>Prizes Left</small></div><span>🎁</span></div><div className="fd-stat"><div><b>{winners.length}</b><small>Winners</small></div><span>🏆</span></div></div>
    <div className="fd-layout"><aside><div className="fd-panel-title">🎁 Available Prizes</div><div className="fd-prizes">{prizes.map((p) => { const won = claimedPrizes.has(p.name); const w = winners.find((x) => (x.prizeName || x.gift?.name) === p.name); return <div className={`fd-prize${won ? ' won' : ''}`} key={p.name}><div className="fd-swatch">{p.emoji}</div><div className="fd-prize-info"><b>{p.name}</b><small>{won ? `Won by ${w?.studentName || w?.student?.name || 'student'}` : '1 Prize Available'}</small></div><span className="fd-badge">{won ? 'CLAIMED' : 'READY'}</span></div>; })}</div></aside>
      <section className="fd-stage">{phase === 'idle' && remaining.length === 1 && <div style={{ width: 'min(420px, 100%)', padding: '38px 24px', textAlign: 'center', border: '2px solid #d4af37', borderRadius: 24, background: 'radial-gradient(circle at 50% 35%, rgba(212,175,55,.2), #101012 68%)', boxShadow: '0 0 45px rgba(212,175,55,.2)' }}><div style={{ fontSize: 96, lineHeight: 1, filter: 'drop-shadow(0 0 18px rgba(252,246,186,.55))' }}>{remaining[0].emoji}</div><div style={{ marginTop: 18, color: '#d4af37', fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>THE FINAL GIFT</div><h2 style={{ color: '#fff2b2', fontFamily: 'Georgia,serif', fontSize: 30, margin: '8px 0 22px' }}>{remaining[0].name}</h2><button type="button" className="fd-live" onClick={startDraw}>REVEAL WINNER</button></div>}{phase === 'idle' && remaining.length > 1 && <><div className="fd-banner">✨ SELECTING PRIZE CATEGORY...</div><div className="fd-wheel-wrap"><div className="fd-wheel-pointer"/><div className="fd-wheel-outer"><div className="fd-wheel" style={{ background: wheelBackground, transform: `rotate(${wheelRotation}deg)` }}>{remaining.map((p, i) => <div className="fd-wheel-label" key={p.name} style={{ transform: `rotate(${i * 360 / remaining.length + 180 / remaining.length}deg) translateY(-${Math.min(170, remaining.length * 24)}px)` }}>{p.emoji}</div>)}</div></div><button type="button" className="fd-spin" onClick={startDraw} disabled={!pool.length || phase !== 'idle'} title={drawDisabledReason || 'Start lucky draw'} aria-label={drawDisabledReason || 'Start lucky draw'}>SPIN</button>{!pool.length && <div style={{ position: 'absolute', top: 'calc(100% + 12px)', width: 280, textAlign: 'center', color: '#f7c948', fontSize: 12 }}>{drawDisabledReason || 'No approved tickets are linked to registered students.'}</div>}</div></>}{phase === 'spinning' && <><div className="fd-banner">✨ SELECTING PRIZE CATEGORY...</div><div className={`fd-wheel-wrap${remaining.length === 1 ? ' fd-last-prize' : ''}`}><div className="fd-wheel-pointer"/><div className="fd-wheel-outer"><div className="fd-wheel" style={{ background: wheelBackground, '--fd-target-rotation': `${wheelRotation}deg`, animation: 'fdWheelSpin 1.7s cubic-bezier(.1,.85,.15,1) forwards', transform: `rotate(${wheelRotation}deg)` }}>{remaining.map((p, i) => <div className="fd-wheel-label" key={p.name} style={{ transform: `rotate(${i * 360 / remaining.length + 180 / remaining.length}deg) translateY(-${Math.min(170, remaining.length * 24)}px)` }}>{p.emoji}</div>)}</div></div><button className="fd-spin" disabled>...</button></div></>}{(phase === 'lever' || phase === 'searching') && selected && <><div className="fd-banner">{phase === 'searching' ? '✨ SEARCHING WINNER...' : '⬇️ PULL THE LEVER TO BEGIN SEARCH ⬇️'}</div><div className="fd-slot-wrap"><div className="fd-slot"><div style={{ color: '#d4af37', fontWeight: 900 }}>{phase === 'searching' ? 'SEARCHING ACTIVE TICKETS' : 'NOMINATED PRIZE'}</div><h3>{selected.prize.emoji} {selected.prize.name.toUpperCase()}</h3><div className="fd-reel"><div className="fd-reel-inner" style={{ transform: `translateY(-${reelIndex * 90}px)` }}>{(reel.length ? reel : [{ student: { name: '-- AWAITING PULL --' }, ticket: {} }]).map((x, i) => <div className="fd-reel-item" key={`${i}-${x.ticket.id || 'wait'}`}>{x.student.name}<small>{x.ticket.ticketNo ? `LD-${x.ticket.ticketNo}` : ''}</small></div>)}</div></div></div><div className={`fd-lever-control${phase === 'searching' ? ' is-pulled' : ''}`} onClick={pullLever} role="button" tabIndex={phase === 'lever' ? 0 : -1} aria-label="Pull lever" onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && phase === 'lever') pullLever(); }}><div className="fd-lever-base" /><div className="fd-lever-arm"><div className="fd-lever-*****" /></div></div></div></>}{phase === 'idle' && !remaining.length && <div className="fd-poster"><div className="fd-tag">✨ PMS 2026 FUNFAIR WINNERS ✨</div><h2>WINNERS OF THE DRAW</h2><p style={{ color: '#d4af37', fontWeight: 800 }}>★ {winners.length} STUDENTS WON PRIZES TODAY! ★</p><div className="fd-winners-grid">{history.map((w, i) => <div className="fd-winner-card" key={w.id}><div className="fd-winner-rank">#{history.length - i}</div><div style={{ fontSize: 32 }}>{w.prizeEmoji}</div><b>{w.prizeName}</b><div style={{ color: '#d4af37', marginTop: 6 }}>{w.studentName}</div><div className="fd-muted" style={{ marginTop: 4 }}>{w.class} · Section {winnerSection(w)}</div><small>LD-{w.ticketNo}</small></div>)}</div></div>}</section></div>
    <div className="fd-history"><div className="fd-panel-title">📜 Winner History</div><table className="sp-table"><thead><tr><th>Prize</th><th>Ticket</th><th>Student Name</th><th>Class</th><th>Section</th><th>Campus</th><th>Time</th></tr></thead><tbody>{history.length ? history.map((w) => <tr key={w.id}><td>{w.prizeEmoji} {w.prizeName}</td><td>LD-{w.ticketNo}</td><td><b>{w.studentName}</b></td><td>{w.class}</td><td>{winnerSection(w)}</td><td>{w.campus}</td><td>{new Date(w.drawnAt).toLocaleTimeString()}</td></tr>) : <tr><td colSpan={7} style={{ textAlign: 'center', padding: 25 }}>No winners yet — spin the wheel to begin.</td></tr>}</tbody></table></div>
    {winner && <div className="fd-overlay"><div className="fd-modal"><div style={{ fontSize: 60 }}>🏆</div><h2>CONGRATULATIONS!</h2><div className="fd-winner-name">{winner.studentName}</div><div className="fd-ticket">LD-{winner.ticketNo}</div><div style={{ color: '#d4af37', fontSize: 19, fontWeight: 800 }}>{winner.prizeEmoji} {winner.prizeName}</div><div className="fd-muted">{winner.class} · Section {winnerSection(winner)} · {winner.campus}</div><button type="button" className="fd-continue" onClick={() => { setWinner(null); drawLocked.current = false; leverPulled.current = false; setPhase('idle'); }}>✨ Continue Draw</button></div></div>}
    {confetti.map((p) => <span key={p.id} className="fd-confetti" style={{ left: p.left, background: p.color, animationDelay: p.delay, animationDuration: p.duration }} />)}
  </div>;
}

function LuckyDrawPanel({ db, }) {
  const actions = useActions();
  const [phase, setPhase] = useState('idle');
  const [selectedPrize, setSelectedPrize] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [reelName, setReelName] = useState('— AWAITING PULL —');
  const [modalWinner, setModalWinner] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [liveMode, setLiveMode] = useState(false);
  const winners = db.luckyDrawWinners || [];
  const issuedTickets = db.tickets || [];
  const wonPrizeNames = new Set(winners.map((item) => item.prizeName));
  const wonStudentIds = new Set(winners.map((item) => item.studentId));
  const prizes = LUCKY_DRAW_PRIZES.map((prize) => ({ ...prize, won: wonPrizeNames.has(prize.name) }));
  const availablePrizes = prizes.filter((prize) => !prize.won);
  const usedTicketIds = new Set(winners.map((item) => item.ticketId));
  const availableTickets = issuedTickets
    .map((ticket) => {
      const studentId = ticket.studentId ?? ticket.student?.id;
      const student = (db.students || []).find((item) => (
        String(item.id) === String(studentId) ||
        String(item.rollNo) === String(studentId) ||
        String(item.regNo) === String(studentId)
      ));
      return student ? { ...ticket, studentId: student.id, student } : null;
    })
    .filter(Boolean)
    .filter((ticket) => !usedTicketIds.has(ticket.id) && !wonStudentIds.has(String(ticket.studentId)));

  function burst() {
    setConfetti(Array.from({ length: 70 }, (_, i) => ({
      id: `${Date.now()}-${i}`, left: `${Math.random() * 100}%`, delay: `${Math.random() * 0.7}s`, color: ['#D4AF37', '#FFF2B2', '#FFFFFF', '#B38728'][i % 4]
    })));
    window.setTimeout(() => setConfetti([]), 4500);
  }

  function toggleLiveMode() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      setLiveMode(false);
    } else {
      document.documentElement.requestFullscreen?.();
      setLiveMode(true);
    }
  }

  function startDraw() {
    if (phase !== 'idle' || !availablePrizes.length || !availableTickets.length) return;
    const prize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
    const ticket = availableTickets[Math.floor(Math.random() * availableTickets.length)];
    const student = ticket.student || (db.students || []).find((item) => String(item.id) === String(ticket.studentId));
    if (!student) return;
    setSelectedPrize(prize);
    setSelectedTicket(ticket);
    setSelectedStudent(student);
    setPhase('spinning');
    window.setTimeout(() => setPhase('lever'), 1700);
  }

  function pullLever() {
    if (phase !== 'lever') return;
    setPhase('searching');
    const candidates = availableTickets.slice(0, 25).map((ticket) => ticket.student || (db.students || []).find((item) => String(item.id) === String(ticket.studentId))).filter(Boolean);
    let index = 0;
    const reelTimer = window.setInterval(() => {
      setReelName(candidates[index % candidates.length]?.name || selectedStudent.name);
      index += 1;
    }, 90);
    window.setTimeout(() => {
      window.clearInterval(reelTimer);
      setReelName(selectedStudent.name);
      const result = {
        id: uid(), ticketId: selectedTicket.id, ticketNo: selectedTicket.ticketNo,
        studentId: selectedStudent.id, studentName: selectedStudent.name,
        class: selectedStudent.class, section: selectedStudent.section || '—',
        campus: selectedStudent.campus || selectedStudent.school || selectedStudent.campusName || '—', prizeName: selectedPrize.name,
        prizeEmoji: selectedPrize.emoji, drawnAt: new Date().toISOString(), drawnBy: 'Super Admin'
      };
      actions.addWinner(result);
      setModalWinner(result);
      setPhase('winner');
      burst();
    }, 1600);
  }

  const wheelBackground = availablePrizes.length
    ? `conic-gradient(${availablePrizes.map((p, i) => `${p.color} ${i * (360 / availablePrizes.length)}deg ${(i + 1) * (360 / availablePrizes.length) - 2}deg, #D4AF37 ${(i + 1) * (360 / availablePrizes.length) - 2}deg ${(i + 1) * (360 / availablePrizes.length)}deg`).join(',')})`
    : '#15151a';

  return (
    <div className="lucky-draw-app">
      <style>{`\n        .lucky-draw-app{background:#030304;color:#fff;border:1px solid #6d5720;border-radius:20px;padding:22px;position:relative;overflow:hidden;font-family:Inter,system-ui,sans-serif}\n        .lucky-draw-app:before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 65%,rgba(212,175,55,.18),transparent 62%),radial-gradient(circle at 12% 20%,rgba(212,175,55,.2),transparent 3%);}\n        .ld-head,.ld-grid,.ld-history{position:relative;z-index:1}.ld-head{text-align:center;background:linear-gradient(#17171b,#0b0b0d);border:1px solid #80651d;border-radius:18px;padding:20px;margin-bottom:16px}.ld-tag{display:inline-block;background:linear-gradient(135deg,#bf953f,#fcf6ba,#aa771c);color:#080808;padding:4px 14px;border-radius:20px;font-size:10px;font-weight:900;letter-spacing:1px}.ld-head h2{font-family:Georgia,serif;font-size:clamp(28px,5vw,48px);letter-spacing:2px;margin:10px 0 5px;background:linear-gradient(135deg,#bf953f,#fff2b2,#aa771c);-webkit-background-clip:text;color:transparent}.ld-head p{color:#999;font-size:12px;margin:0}.ld-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}.ld-stat{background:#111115;border:1px solid #70591f;border-radius:10px;padding:10px}.ld-stat b{font-size:20px}.ld-stat small{display:block;color:#d4af37;font-size:8px;font-weight:800;text-transform:uppercase}.ld-grid{display:grid;grid-template-columns:190px 1fr;gap:18px}.ld-prizes h3,.ld-history h3{color:#d4af37;font-size:12px;margin:4px 0 10px}.ld-prize{display:flex;align-items:center;gap:8px;background:#111115;border:1px solid #70591f;border-radius:9px;padding:8px;margin-bottom:8px;font-size:11px}.ld-prize-icon{font-size:18px;width:28px;text-align:center}.ld-prize span{flex:1}.ld-prize small{display:block;color:#999;font-size:8px}.ld-ready{color:#d4af37;border:1px solid #80651d;border-radius:4px;padding:2px 4px;font-size:7px}.ld-prize.won{opacity:.35;filter:grayscale(1)}.ld-stage{min-height:420px;background:rgba(18,18,20,.9);border:1px solid #80651d;border-radius:18px;display:flex;align-items:center;justify-content:center;position:relative;padding:24px}.ld-banner{position:absolute;top:12px;border:1px solid #e4c85a;background:#09090b;color:#fff;border-radius:20px;padding:8px 18px;font-size:11px;box-shadow:0 0 18px rgba(212,175,55,.45);text-align:center}.ld-wheel-wrap{width:min(340px,78vw);height:min(340px,78vw);position:relative}.ld-wheel{width:100%;height:100%;border-radius:50%;border:12px solid #08080a;outline:3px solid #d4af37;box-shadow:0 15px 35px #000;transition:transform 1.7s cubic-bezier(.1,.85,.15,1);position:relative}.ld-pointer{position:absolute;top:-12px;left:50%;margin-left:-15px;border-left:15px solid transparent;border-right:15px solid transparent;border-top:0;border-bottom:30px solid #d4af37;z-index:3}.ld-wheel-label{position:absolute;left:50%;top:50%;font-size:24px;transform-origin:0 0;margin-left:-12px;margin-top:-12px}.ld-spin{position:absolute;z-index:4;left:50%;top:50%;transform:translate(-50%,-50%);width:68px;height:68px;border-radius:50%;border:3px solid #111;background:linear-gradient(135deg,#bf953f,#fff2b2,#aa771c);font-weight:900;cursor:pointer}.ld-spin:disabled{opacity:.5;cursor:not-allowed}.ld-slot{width:min(390px,90%);border:2px solid #d4af37;border-radius:16px;background:#08080a;padding:28px 18px;text-align:center;box-shadow:0 0 35px rgba(212,175,55,.25)}.ld-slot strong{color:#d4af37;font-size:12px}.ld-slot h3{margin:5px 0 18px}.ld-reel{height:68px;display:flex;align-items:center;justify-content:center;border:1px solid #80651d;border-radius:10px;color:#d4af37;font-weight:800;font-size:18px;background:#121215}.ld-lever{margin-top:18px;background:transparent;border:1px solid #d4af37;color:#d4af37;padding:8px 20px;border-radius:20px;cursor:pointer;font-weight:800}.ld-history{margin-top:20px;overflow:auto}.ld-history table{background:#111115;border:1px solid #70591f;color:#fff}.ld-history th{color:#d4af37;background:#17171b;border-bottom:1px solid #70591f}.ld-history td{border-bottom:1px solid #333}.ld-overlay{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}.ld-winner{background:linear-gradient(#17171b,#09090b);border:2px solid #d4af37;border-radius:20px;padding:30px;text-align:center;max-width:380px;width:100%;box-shadow:0 0 60px rgba(212,175,55,.6)}.ld-winner h2{font-family:Georgia,serif;color:#d4af37}.ld-winner-name{font-size:26px;font-weight:800}.ld-winner-ticket{display:inline-block;background:linear-gradient(135deg,#bf953f,#fff2b2);color:#080808;border-radius:18px;padding:5px 14px;font-weight:900;margin:10px}.ld-confetti{position:fixed;top:-15px;width:8px;height:13px;z-index:110;animation:ldFall 4s linear forwards}@keyframes ldFall{to{transform:translateY(110vh) rotate(720deg)}}@media(max-width:700px){.ld-grid{grid-template-columns:1fr}.ld-stats{grid-template-columns:repeat(2,1fr)}}\n      `}</style>
      <div className="ld-head"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><div style={{ width: 1 }} /><button type="button" onClick={toggleLiveMode} style={{ marginLeft: 'auto', border: 'none', borderRadius: 20, padding: '8px 14px', background: 'linear-gradient(135deg,#bf953f,#fff2b2,#aa771c)', color: '#080808', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>{liveMode ? '❌ EXIT LIVE MODE' : '📺 FULL SCREEN LIVE DRAW'}</button></div><span className="ld-tag">PMS FUNFAIR 2026</span><h2>GRAND LUCKY DRAW</h2><p>Where Every Ticket Has a Chance to Win</p></div>
      <div className="ld-stats">
        <div className="ld-stat"><b>{new Set(issuedTickets.map((t) => t.studentId)).size}</b><small>Students</small></div>
        <div className="ld-stat"><b>{issuedTickets.length}</b><small>Total Tickets</small></div>
        <div className="ld-stat"><b>{availablePrizes.length} / {prizes.length}</b><small>Prizes Left</small></div>
        <div className="ld-stat"><b>{winners.length}</b><small>Winners</small></div>
      </div>
      <div className="ld-grid">
        <aside className="ld-prizes"><h3>🎁 Available Prizes</h3>{prizes.map((prize) => <div className={`ld-prize${prize.won ? ' won' : ''}`} key={prize.name}><div className="ld-prize-icon">{prize.emoji}</div><span><b>{prize.name}</b><small>{prize.won ? 'Prize claimed' : '1 Prize Available'}</small></span><i className="ld-ready">{prize.won ? 'CLAIMED' : 'READY'}</i></div>)}</aside>
        <section className="ld-stage">
          {phase === 'idle' && <><div className="ld-banner">✨ SELECTING PRIZE CATEGORY...</div><div className="ld-wheel-wrap"><div className="ld-pointer"/><div className="ld-wheel" style={{ background: wheelBackground, transform: `rotate(${phase === 'spinning' ? 1440 : 0}deg)` }}>{availablePrizes.map((prize, i) => <div className="ld-wheel-label" key={prize.name} style={{ transform: `rotate(${i * (360 / availablePrizes.length)}deg) translateY(-${Math.min(125, availablePrizes.length * 20)}px)` }}>{prize.emoji}</div>)}</div><button type="button" className="ld-spin" onClick={startDraw} disabled={!availablePrizes.length || !availableTickets.length}>SPIN</button></div></>}
          {phase === 'spinning' && <><div className="ld-banner">✨ SELECTING PRIZE CATEGORY...</div><div className="ld-wheel-wrap"><div className="ld-pointer"/><div className="ld-wheel" style={{ background: wheelBackground, transform: 'rotate(1440deg)' }}/><button className="ld-spin" disabled>...</button></div></>}
          {(phase === 'lever' || phase === 'searching') && <><div className="ld-banner">{phase === 'searching' ? '✨ SEARCHING WINNER...' : '⬇️ PULL THE LEVER TO BEGIN SEARCH ⬇️'}</div><div className="ld-slot"><strong>{phase === 'searching' ? 'SEARCHING ACTIVE TICKETS' : 'NOMINATED PRIZE'}</strong><h3>{selectedPrize?.emoji} {selectedPrize?.name.toUpperCase()}</h3><div className="ld-reel">{phase === 'searching' ? reelName : '-- AWAITING PULL --'}</div>{phase === 'lever' && <button className="ld-lever" onClick={pullLever}>⬇ PULL LEVER</button>}</div></>}
          {!availablePrizes.length && phase === 'idle' && <div style={{ color: '#d4af37', fontWeight: 800 }}>ALL PRIZES HAVE BEEN CLAIMED</div>}
        </section>
      </div>
      <div className="ld-history"><h3>📜 Winner History</h3><div className="sp-table-wrap"><table className="sp-table"><thead><tr><th>Prize</th><th>Ticket</th><th>Student Name</th><th>Class</th><th>Campus</th><th>Time</th></tr></thead><tbody>{winners.length ? winners.slice().reverse().map((item) => <tr key={item.id}><td>{item.prizeEmoji} {item.prizeName}</td><td>{item.ticketNo || item.ticketId}</td><td><b>{item.studentName}</b></td><td>{item.class}</td><td>{item.campus}</td><td>{new Date(item.drawnAt).toLocaleTimeString()}</td></tr>) : <tr><td colSpan={6}><EmptyState text="No winners yet — spin the wheel to begin." /></td></tr>}</tbody></table></div></div>
      {modalWinner && <div className="ld-overlay"><div className="ld-winner"><div style={{ fontSize: 50 }}>🏆</div><h2>CONGRATULATIONS!</h2><div className="ld-winner-name">{modalWinner.studentName}</div><div className="ld-winner-ticket">{modalWinner.ticketNo || modalWinner.ticketId}</div><div style={{ color: '#d4af37', fontWeight: 800 }}>{modalWinner.prizeEmoji} {modalWinner.prizeName}</div><div style={{ color: '#aaa', fontSize: 12, marginTop: 6 }}>{modalWinner.class} · {modalWinner.campus}</div><button className="ld-lever" onClick={() => { setModalWinner(null); setPhase('idle'); }}>Continue Draw</button></div></div>}
      {confetti.map((piece) => <span key={piece.id} className="ld-confetti" style={{ left: piece.left, background: piece.color, animationDelay: piece.delay }} />)}
    </div>
  );
}

function TicketManager({ user, db, }) {
  const actions = useActions();
  const [quantity, setQuantity] = useState(MIN_TICKET_QTY);

  const ticketRequests = db.ticketRequests || [];
  const allTickets = db.tickets || [];
  const requestsForUser = isCampusManager(user)
    ? ticketRequests.filter((request) => Boolean(getCampus(user)) && getCampus((db.students || []).find((student) => student.id === request.studentId)) === getCampus(user))
    : ticketRequests;
  const ticketsForUser = isCampusManager(user)
    ? allTickets.filter((ticket) => Boolean(getCampus(user)) && getCampus((db.students || []).find((student) => student.id === ticket.studentId)) === getCampus(user))
    : allTickets;

  function submitTicketRequest(e) {
    e.preventDefault();
    const qty = Math.max(MIN_TICKET_QTY, parseInt(quantity, 10) || MIN_TICKET_QTY);
    actions.requestTickets(user.id, qty);
    setQuantity(MIN_TICKET_QTY);
  }

  function approveRequest(req) {
    const student = (db.students || []).find((s) => s.id === req.studentId);
    if (!student) return;
    const amountDue = req.quantity * TICKET_PRICE_PER_UNIT;
    const ok = window.confirm(
      `Confirm: Rs. ${amountDue.toLocaleString()} cash payment received from ${student.name} (${req.quantity} ticket${req.quantity > 1 ? 's' : ''})?\n\nThis will approve the request and issue the tickets to the student's portal.`
    );
    if (!ok) return;

    actions.approveTicketRequest(req.id);
  }

  function rejectRequest(req) {
    if (!window.confirm('Reject this ticket request? The student can submit a new request afterwards.')) return;
    actions.rejectTicketRequest(req.id);
  }

  /* ---------------- Student view ---------------- */
  if (user.type === 'student') {
    const student = (db.students || []).find((s) => s.id === user.id) || user;
    const myRequests = ticketRequests
      .filter((r) => r.studentId === user.id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    const myTickets = allTickets.filter((t) => t.studentId === user.id);
    const hasPending = myRequests.some((r) => r.status === 'pending');
    const qtyNum = Math.max(MIN_TICKET_QTY, parseInt(quantity, 10) || MIN_TICKET_QTY);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Panel icon={Ticket} title="Apply for Fun Fair Tickets">
          {hasPending ? (
            <div style={{ padding: '12px 14px', borderRadius: 6, background: '#F1E3C4', color: COLORS.brass, fontSize: 13.5 }}>
              Your ticket request is submitted and waiting for your teacher's approval. Please pay the amount in cash to your teacher to get it approved.
            </div>
          ) : (
            <form onSubmit={submitTicketRequest} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Number of Tickets (minimum {MIN_TICKET_QTY})</label>
                <input className="sp-input" type="number" min={MIN_TICKET_QTY} value={quantity} style={{ width: 130 }} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div style={{ fontSize: 13, color: COLORS.inkSoft }}>
                Amount payable: <strong>Rs. {(qtyNum * TICKET_PRICE_PER_UNIT).toLocaleString()}</strong><br />
                Pay this in cash to your teacher to get your tickets approved.
              </div>
              <Btn type="submit" icon={Plus}>Submit Request</Btn>
            </form>
          )}
        </Panel>

        <Panel icon={Clock3} title="My Ticket Requests">
          {myRequests.length === 0 ? (
            <EmptyState text="You haven't requested any Fun Fair tickets yet." />
          ) : (
            <div className="sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th>Requested On</th>
                    <th>Quantity</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((r) => (
                    <tr key={r.id} className="sp-row">
                      <td>{fmtDate(r.requestedAt)}</td>
                      <td>{r.quantity}</td>
                      <td>Rs. {(r.quantity * TICKET_PRICE_PER_UNIT).toLocaleString()}</td>
                      <td>
                        <Badge
                          text={r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Pending Approval'}
                          tone={r.status === 'approved' ? 'good' : r.status === 'rejected' ? 'bad' : 'brass'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {myTickets.length > 0 && (
          <Panel icon={Ticket} title={`My Tickets (${myTickets.length})`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
              {myTickets.map((t) => (
                <TicketCardVisual key={t.id} ticket={t} student={student} />
              ))}
            </div>
          </Panel>
        )}
      </div>
    );
  }

  /* ---------------- Faculty / Admin view (approval side) ---------------- */
  const allRequests = requestsForUser.slice().sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const pending = allRequests.filter((r) => r.status === 'pending');
  const processed = allRequests.filter((r) => r.status !== 'pending');
  const totalCollected = processed
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + (r.amountCollected || 0), 0);

  function studentInfo(studentId) {
    return (db.students || []).find((s) => s.id === studentId);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="sp-stats">
        <StatBlock label="Pending Requests" value={pending.length} tone="red" />
        <StatBlock label="Tickets Issued" value={ticketsForUser.length} tone="green" />
        <StatBlock label="Amount Collected" value={`Rs. ${totalCollected.toLocaleString()}`} tone="brass" />
      </div>

      <Panel icon={Clock3} title={`Pending Ticket Requests (${pending.length})`}>
        {pending.length === 0 ? (
          <EmptyState text="No pending Fun Fair ticket requests." />
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Reg No.</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Qty</th>
                  <th>Amount Due</th>
                  <th>Requested</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => {
                  const s = studentInfo(r.studentId);
                  return (
                    <tr key={r.id} className="sp-row">
                      <td>#{s?.regNo || '—'}</td>
                      <td><strong>{s?.name || 'Unknown'}</strong></td>
                      <td><Badge text={s?.class || '—'} /></td>
                      <td><Badge text={s?.section || '—'} tone="brass" /></td>
                      <td>{r.quantity}</td>
                      <td>Rs. {(r.quantity * TICKET_PRICE_PER_UNIT).toLocaleString()}</td>
                      <td>{fmtDate(r.requestedAt)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Btn variant="brass" icon={Banknote} onClick={() => approveRequest(r)}>Approve</Btn>{' '}
                        <Btn variant="danger" icon={XCircle} onClick={() => rejectRequest(r)}>Reject</Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel icon={CheckCircle2} title="Processed Requests">
        {processed.length === 0 ? (
          <EmptyState text="No processed ticket requests yet." />
        ) : (
          <div className="sp-table-wrap">
            <table className="sp-table">
              <thead>
                <tr>
                  <th>Reg No.</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Processed By</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {processed.map((r) => {
                  const s = studentInfo(r.studentId);
                  return (
                    <tr key={r.id} className="sp-row">
                      <td>#{s?.regNo || '—'}</td>
                      <td>{s?.name || 'Unknown'}</td>
                      <td><Badge text={s?.class || '—'} /></td>
                      <td>{r.quantity}</td>
                      <td>
                        <Badge text={r.status === 'approved' ? 'Approved' : 'Rejected'} tone={r.status === 'approved' ? 'good' : 'bad'} />
                      </td>
                      <td>{r.approvedBy || '—'}</td>
                      <td>{r.approvedAt ? fmtDate(r.approvedAt) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Timetable Module                                                 */
/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
/* Leave Management Module                                          */
/* ---------------------------------------------------------------- */

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Vacation Leave', 'Emergency Leave'];

function LeaveManager({ user, db, }) {
  const actions = useActions();
  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0]);
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [view, setView] = useState('apply');
  const requests = db.leaveRequests || [];

  const isApprover = user.role === 'principal' || user.role === 'hr' || user.role === 'super_admin';
  const targetRole = user.role === 'teacher' ? 'principal' : 'hr';

  function applyLeave(e) {
    e.preventDefault();
    if (toDate < fromDate || !reason.trim()) return;
    actions.applyLeave({ approverRole: targetRole, leaveType, fromDate, toDate, reason: reason.trim() });
    setReason('');
    setView('history');
  }

  function reviewLeave(request, status) {
    const next = window.prompt(`${status === 'approved' ? 'Approval' : 'Rejection'} remarks (optional):`, '') ?? '';
    actions.reviewLeave(request.id, status, next);
  }

  const myRequests = requests.filter((r) => r.employeeId === user.id);
  const inbox = requests.filter((r) => r.status === 'pending' && (r.approverRole === user.role || user.role === 'super_admin') && (!isCampusManager(user) || (Boolean(getCampus(user)) && getCampus(r) === getCampus(user))));
  const visible = isApprover && view === 'history' ? inbox : myRequests;
  const statusTone = (status) => status === 'approved' ? 'good' : status === 'rejected' ? 'bad' : 'brass';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 10, borderBottom: `2px solid ${COLORS.line}`, paddingBottom: 10, flexWrap: 'wrap' }}>
        {!isApprover && <Btn variant={view === 'apply' ? 'primary' : 'outline'} onClick={() => setView('apply')}>Apply Leave</Btn>}
        <Btn variant={view === 'history' ? 'primary' : 'outline'} onClick={() => setView('history')}>{isApprover ? `Pending Requests (${inbox.length})` : 'Leave History'}</Btn>
      </div>

      {!isApprover && view === 'apply' && (
        <Panel icon={Plus} title="Apply for Leave">
          <form onSubmit={applyLeave} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 680 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Leave Type</label><select className="sp-select" value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={{ width: '100%' }}>{LEAVE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>From</label><input className="sp-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required /></div>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>To</label><input className="sp-input" type="date" min={fromDate} value={toDate} onChange={(e) => setToDate(e.target.value)} required /></div>
            </div>
            <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reason for Leave</label><textarea className="sp-input" rows={4} placeholder="Explain the reason for your leave..." value={reason} onChange={(e) => setReason(e.target.value)} required /></div>
            <div style={{ padding: '10px 12px', background: COLORS.paperDark, borderRadius: 4, fontSize: 13, color: COLORS.inkSoft }}>Your application will be sent to <strong>{targetRole === 'principal' ? 'Principal' : 'HR Department'}</strong> for review.</div>
            <Btn type="submit" icon={ClipboardList}>Submit Leave Application</Btn>
          </form>
        </Panel>
      )}

      {(isApprover || view === 'history') && (
        <Panel icon={ClipboardList} title={isApprover ? 'Leave Requests for Review' : 'My Leave History'}>
          {visible.length === 0 ? <EmptyState text={isApprover ? 'No pending leave applications.' : 'No leave applications submitted yet.'} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visible.map((request) => (
                <div key={request.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 16, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div><strong style={{ fontSize: 16, color: COLORS.navy }}>{request.leaveType}</strong><div style={{ fontSize: 13, color: COLORS.inkSoft, marginTop: 4 }}>{request.fromDate} to {request.toDate} · Applied {fmtDate(request.appliedOn)}</div></div>
                    <Badge text={request.status === 'pending' ? 'Pending' : request.status[0].toUpperCase() + request.status.slice(1)} tone={statusTone(request.status)} />
                  </div>
                  {isApprover && <div style={{ marginTop: 10, fontSize: 13 }}><strong>Applicant:</strong> {request.employeeName} ({request.employeeCode || '—'}) · {request.department || 'Department not specified'}</div>}
                  <div style={{ marginTop: 10, fontSize: 14, color: COLORS.inkSoft }}><strong>Reason:</strong> {request.reason}</div>
                  {request.reviewerRemarks && <div style={{ marginTop: 8, fontSize: 13, color: COLORS.inkSoft }}><strong>Reviewer remarks:</strong> {request.reviewerRemarks}</div>}
                  {isApprover && request.status === 'pending' && <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><Btn variant="brass" icon={CheckCircle2} onClick={() => reviewLeave(request, 'approved')}>Approve</Btn><Btn variant="danger" icon={XCircle} onClick={() => reviewLeave(request, 'rejected')}>Reject</Btn></div>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function TimetableManager({ user, db, }) {
  const actions = useActions();
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);

  function handleCellChange(day, period, field, value) {
    actions.setTimetableCell(selectedClass, day, period, field, value);
  }

  if (user.type === 'student') {
    return (
      <Panel icon={CalendarDays} title={`Weekly Schedule (${user.class})`}>
        <div className="sp-timetable-scroll">
          <div className="sp-timetable-grid">
            {DAYS.map((day) => (
              <div key={day} style={{ background: COLORS.paperDark, padding: 10, borderRadius: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 14, textAlign: 'center', marginBottom: 10, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 6 }}>
                  {day}
                </div>
                {PERIODS.map((p) => {
                  const item = db.timetable[`${user.class}|${day}|${p}`];
                  return (
                    <div key={p} style={{ background: '#fff', padding: 8, borderRadius: 4, marginBottom: 8, border: `1px solid ${COLORS.line}` }}>
                      <div style={{ fontSize: 11, color: COLORS.brass, fontWeight: 600 }}>Period {p}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item?.subject || 'Free Period'}</div>
                      {item?.teacher && <div style={{ fontSize: 11, color: COLORS.inkSoft }}>{item.teacher}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel icon={CalendarDays} title="Manage Class Timetable">
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Select Class</label>
        <select className="sp-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="sp-timetable-scroll">
        <div className="sp-timetable-grid">
          {DAYS.map((day) => (
            <div key={day} style={{ background: COLORS.paperDark, padding: 10, borderRadius: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 14, textAlign: 'center', marginBottom: 10, borderBottom: `1px solid ${COLORS.line}`, paddingBottom: 6 }}>
                {day}
              </div>
              {PERIODS.map((p) => {
                const cellKey = `${selectedClass}|${day}|${p}`;
                const cell = db.timetable[cellKey] || {};
                return (
                  <div key={p} style={{ background: '#fff', padding: 8, borderRadius: 4, marginBottom: 8, border: `1px solid ${COLORS.line}` }}>
                    <div style={{ fontSize: 11, color: COLORS.brass, fontWeight: 600, marginBottom: 4 }}>Period {p}</div>
                    <select
                      className="sp-select"
                      style={{ fontSize: 12, padding: '4px 6px', marginBottom: 4, width: '100%' }}
                      value={cell.subject || ''}
                      onChange={(e) => handleCellChange(day, p, 'subject', e.target.value)}
                    >
                      <option value="">-- Subject --</option>
                      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select
                      className="sp-select"
                      style={{ fontSize: 12, padding: '4px 6px', width: '100%' }}
                      value={cell.teacher || ''}
                      onChange={(e) => handleCellChange(day, p, 'teacher', e.target.value)}
                    >
                      <option value="">-- Teacher --</option>
                      {scopeToCampus(db.faculty, user).map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */
/* Announcement Board Module                                        */
/* ---------------------------------------------------------------- */

function AnnouncementManager({ user, db, }) {
  const actions = useActions();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  function postAnnouncement(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    actions.postAnnouncement(title.trim(), body.trim(), user);
    setTitle('');
    setBody('');
  }

  function remove(id) {
    if (window.confirm('Delete this announcement?')) {
      actions.deleteAnnouncement(id);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {user.type === 'faculty' && (
        <Panel icon={Plus} title="Post New Notice">
          <form onSubmit={postAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notice Title</label>
              <input className="sp-input" type="text" placeholder="e.g. Mid-Term Examination Schedule" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Notice Details</label>
              <textarea className="sp-input" rows={3} placeholder="Write notice details..." value={body} onChange={(e) => setBody(e.target.value)} required />
            </div>
            <div>
              <Btn type="submit" icon={Megaphone}>Publish Notice</Btn>
            </div>
          </form>
        </Panel>
      )}

      <Panel icon={Megaphone} title="Notice Board">
        {db.announcements.length === 0 ? (
          <EmptyState text="No notices posted yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {db.announcements.map((a) => (
              <div key={a.id} style={{ background: '#fff', border: `1px solid ${COLORS.line}`, padding: 16, borderRadius: 6, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0, fontSize: 16, color: COLORS.navy }}>{a.title}</h4>
                  {user.type === 'faculty' && (
                    <Btn variant="ghost" onClick={() => remove(a.id)} icon={Trash2} />
                  )}
                </div>
                <p style={{ margin: '8px 0', fontSize: 14, color: COLORS.inkSoft, whiteSpace: 'pre-wrap' }}>{a.body}</p>
                <div style={{ fontSize: 12, color: COLORS.brass, fontWeight: 600 }}>{fmtDate(a.date)} · Posted by {a.author}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Change Password Module                                           */
/* ---------------------------------------------------------------- */

function PasswordManager({ user, db, onUserUpdate }) {
  const actions = useActions();
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    if (newPass !== confirmPass) {
      return setMsg({ text: 'New passwords do not match.', type: 'bad' });
    }
    if (newPass.length < 6) {
      return setMsg({ text: 'Password must be at least 6 characters long.', type: 'bad' });
    }

    try {
      await changePassword(oldPass, newPass);
    } catch (err) {
      return setMsg({ text: err.message, type: 'bad' });
    }

    setMsg({ text: 'Password updated successfully!', type: 'good' });
    setOldPass('');
    setNewPass('');
    setConfirmPass('');
  }

  return (
    <Panel icon={KeyRound} title="Change Password">
      <form onSubmit={handleSubmit} style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msg.text && (
          <div style={{ padding: '10px 12px', borderRadius: 4, fontSize: 13, background: msg.type === 'good' ? COLORS.greenInkBg : COLORS.redInkBg, color: msg.type === 'good' ? COLORS.greenInk : COLORS.redInk }}>
            {msg.text}
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Current Password</label>
          <input className="sp-input" type="password" required value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>New Password</label>
          <input className="sp-input" type="password" required value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Confirm New Password</label>
          <input className="sp-input" type="password" required value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} />
        </div>
        <div>
          <Btn type="submit" variant="primary">Update Password</Btn>
        </div>
      </form>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */
/* Main Application Component                                       */
/* ---------------------------------------------------------------- */

export default function SchoolPortal() {
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dbRef = useRef(null);
  dbRef.current = db;
  const ttTimers = useRef({});
  const ttCells = useRef({});

  // (Re)load collections from Supabase. Row Level Security decides what each user actually receives.
  const reload = useCallback(async (keys = ALL_KEYS) => {
    const entries = await Promise.all(keys.map(async (k) => {
      try { return [k, await fetchers[k]()]; } catch (err) { console.error(`Failed to load ${k}`, err); return [k, undefined]; }
    }));
    setDb((prev) => {
      const next = { ...(prev || {}) };
      entries.forEach(([k, v]) => {
        if (v === undefined) { if (next[k] === undefined) next[k] = k === 'attendance' || k === 'grades' || k === 'fees' || k === 'timetable' || k === 'rolePermissions' ? {} : []; return; }
        next[k] = k === 'rolePermissions' ? { ...DEFAULT_ROLE_PERMISSIONS, ...v } : v;
      });
      return next;
    });
  }, []);

  // Restore the Supabase session (if any) and react to sign-out / token expiry.
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        if (isSupabaseConfigured) {
          const profile = await getSessionProfile();
          if (profile && active) { await reload(); setUser(profile); }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) { setDb((prev) => prev || {}); setLoading(false); }
      }
    }
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setUser(null); setDb({}); setActiveTab('dashboard'); }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [reload]);

  const actions = useMemo(() => {
    // run(): call a mutation, refresh the affected collections, alert on error. Resolves false on failure.
    const run = (fn, keys = []) => async (...args) => {
      try {
        const result = await fn(...args);
        if (keys.length) await reload(keys);
        return result === undefined ? true : result;
      } catch (err) {
        window.alert(err?.message || 'Something went wrong. Please try again.');
        return false;
      }
    };
    const staffId = user?.id;
    return {
      createStaff: run(mutations.createStaff, ['faculty', 'stats']),
      createStudent: run(mutations.createStudent, ['students']),
      deleteUser: run(mutations.deleteUser, ['faculty', 'students', 'attendance', 'grades', 'fees', 'ticketRequests', 'tickets', 'leaveRequests', 'stats']),
      resetPassword: run(mutations.resetPassword),
      updateStaff: run(mutations.updateStaff, ['faculty']),
      updateStudent: run(mutations.updateStudent, ['students']),
      setRoleModules: run(mutations.setRoleModules, ['rolePermissions']),
      setEmployeeModules: run(mutations.setEmployeeModules, ['faculty']),
      markAttendance: run((sid, cls, date, status) => mutations.markAttendance(sid, cls, date, status, staffId), ['attendance']),
      saveGrades: run(mutations.saveGrades, ['grades']),
      generateInvoices: run(mutations.generateInvoices, ['fees', 'stats']),
      setFeePaid: run(mutations.setFeePaid, ['fees', 'stats']),
      postAnnouncement: run(mutations.postAnnouncement, ['announcements']),
      deleteAnnouncement: run(mutations.deleteAnnouncement, ['announcements']),
      requestTickets: run(mutations.requestTickets, ['ticketRequests']),
      approveTicketRequest: run(mutations.approveTicketRequest, ['ticketRequests', 'tickets']),
      rejectTicketRequest: run(mutations.rejectTicketRequest, ['ticketRequests']),
      addWinner: run(mutations.addWinner, ['luckyDrawWinners']),
      resetWinners: run(mutations.resetWinners, ['luckyDrawWinners']),
      applyLeave: run((r) => mutations.applyLeave(r, staffId), ['leaveRequests']),
      reviewLeave: run(mutations.reviewLeave, ['leaveRequests']),
      uploadAvatar: run(async (file) => {
        const { path, url } = await uploadAvatar(user, file);
        setUser((u) => ({ ...u, avatar: url, avatarPath: path }));
      }, [user?.type === 'student' ? 'students' : 'faculty']),
      // Timetable cells are typed into live: update the screen immediately, save to the DB shortly after.
      setTimetableCell: (cls, day, period, field, value) => {
        const key = `${cls}|${day}|${period}`;
        const cell = { ...(ttCells.current[key] || dbRef.current?.timetable?.[key] || {}), [field]: value };
        ttCells.current[key] = cell;
        setDb((prev) => ({ ...prev, timetable: { ...prev.timetable, [key]: cell } }));
        clearTimeout(ttTimers.current[key]);
        ttTimers.current[key] = setTimeout(async () => {
          try { await mutations.saveTimetableCell(cls, day, period, ttCells.current[key]); }
          catch (err) { window.alert(err?.message || 'Could not save the timetable.'); }
          delete ttCells.current[key];
        }, 600);
      },
    };
  }, [reload, user]);

  async function handleLogin(loggedUser) {
    await reload();
    setUser(loggedUser);
    setActiveTab('dashboard');
  }

  async function handleLogout() {
    await signOut();
    setUser(null);
    setDb({});
    setActiveTab('dashboard');
  }

  if (!isSupabaseConfigured) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.paper, padding: 24 }}>
        <div style={{ maxWidth: 520, background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 24, color: COLORS.ink }}>
          <h2 style={{ marginTop: 0 }}>Supabase is not configured</h2>
          <p>Copy <code>.env.example</code> to <code>.env</code>, set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.paper }}>
        <Loader2 className="animate-spin" size={32} color={COLORS.navy} />
      </div>
    );
  }

  if (!user) {
    return <ModernLoginScreen db={db} onLogin={handleLogin} />;
  }

  const userCampusOrDepartment = user.campus || user.department || user.campusDepartment || user.campusName || user.school;
  const schoolOrCampusName = userCampusOrDepartment || 'Peshawar Model School';

  return (
    <ActionsContext.Provider value={actions}>
    <div className="sp-root">
      <GlobalStyle />
      <div className="sp-shell">
        <Sidebar
          user={user}
          active={activeTab}
          setActive={setActiveTab}
          onLogout={handleLogout}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          db={db}
        />

        <div className="sp-main">
          <div className="sp-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="sp-hamburger" onClick={() => setSidebarOpen(true)}>
                <Menu size={22} />
              </button>

              <div className="top-navbar-title">
                <span>
                  {userCampusOrDepartment
                    ? `${userCampusOrDepartment} - Dashboard`
                    : `${schoolOrCampusName} - Dashboard`}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: COLORS.inkSoft }}>
              {fmtDate(todayISO())}
            </div>
          </div>

          <div className="sp-content">
            {activeTab === 'dashboard' && (
              <Dashboard user={user} db={db} onUserUpdate={setUser} />
            )}
            {activeTab === 'profile' && (
              user.type === 'student' ? (
                <StudentProfileModule user={user} db={db} onUserUpdate={setUser} />
              ) : (
                <StaffProfileModule user={user} db={db} onUserUpdate={setUser} />
              )
            )}
            {activeTab === 'access_control' && (
              <AccessControlManager db={db} />
            )}
            {activeTab === 'add_employee' && (
              <AddEmployeeManager db={db} user={user} onUserUpdate={setUser} />
            )}
            {activeTab === 'attendance' && (
              <AttendanceManager user={user} db={db} />
            )}
            {activeTab === 'grades' && (
              <GradeManager user={user} db={db} />
            )}
            {activeTab === 'fees' && (
              <FeeManager user={user} db={db} />
            )}
            {activeTab === 'timetable' && (
              <TimetableManager user={user} db={db} />
            )}
            {activeTab === 'announcements' && (
              <AnnouncementManager user={user} db={db} />
            )}
            {activeTab === 'tickets' && (
              user.role === 'super_admin' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <TicketManager user={user} db={db} />
                  <FullLuckyDrawPanel db={db} />
                </div>
              ) : (
                <TicketManager user={user} db={db} />
              )
            )}
            {activeTab === 'leaves' && (
              <LeaveManager user={user} db={db} />
            )}
            {activeTab === 'password' && (
              <PasswordManager user={user} db={db} onUserUpdate={setUser} />
            )}
          </div>
        </div>
      </div>
    </div>
    </ActionsContext.Provider>
  );
}