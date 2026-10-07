import { supabase, loginEmail } from './supabase';

/* ------------------------------------------------------------------ */
/* Row <-> UI shape mappers (keep the shapes the existing UI expects)  */
/* ------------------------------------------------------------------ */

export const staffToUi = (r) => ({
  id: r.id, employeeId: r.employee_id, name: r.name, role: r.role,
  designationRole: r.designation_role || r.designation || undefined, designation: r.designation || r.designation_role || undefined,
  department: r.department || '', campus: r.campus || '', email: r.email || '', phone: r.phone || '', cnic: r.cnic || '',
  allowedModules: r.allowed_modules || undefined, avatarPath: r.avatar_path || null,
});

export const studentToUi = (r) => ({
  id: r.id, rollNo: r.roll_no, regNo: r.reg_no, name: r.name, class: r.class_name,
  section: r.section, campus: r.campus || '', avatarPath: r.avatar_path || null,
});

/* PostgREST returns max 1000 rows per request, so page through big tables. */
async function fetchAll(table, columns = '*', order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (order) q = q.order(order);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export const fetchers = {
  async students() { return (await fetchAll('students', '*', 'roll_no')).map(studentToUi); },
  async faculty() { return (await fetchAll('staff', '*', 'employee_id')).map(staffToUi); },
  async rolePermissions() {
    const rows = await fetchAll('role_permissions');
    return Object.fromEntries(rows.map((r) => [r.role, r.modules]));
  },
  async attendance() {
    const out = {};
    (await fetchAll('attendance_records')).forEach((r) => {
      const key = `${r.class_name}|${r.attendance_date}`;
      (out[key] ||= {})[r.student_id] = r.status;
    });
    return out;
  },
  async grades() {
    const out = {};
    (await fetchAll('grades')).forEach((r) => {
      (out[r.student_id] ||= []).push({ subject: r.subject, term: r.term, score: Number(r.score), date: r.graded_on });
    });
    return out;
  },
  async fees() {
    const out = {};
    (await fetchAll('fee_invoices', '*', 'due_date')).forEach((r) => {
      (out[r.student_id] ||= []).push({ id: r.id, month: r.month, amount: Number(r.amount), paid: r.paid, dueDate: r.due_date });
    });
    return out;
  },
  async timetable() {
    const out = {};
    (await fetchAll('timetable_entries')).forEach((r) => {
      out[`${r.class_name}|${r.day}|${r.period}`] = { subject: r.subject, teacher: r.teacher };
    });
    return out;
  },
  async announcements() {
    return (await fetchAll('announcements', '*', 'created_on')).reverse().map((r) => ({
      id: r.id, title: r.title, body: r.body, author: r.author_name, date: r.created_on,
    }));
  },
  async ticketRequests() {
    return (await fetchAll('ticket_requests', '*', 'requested_at')).map((r) => ({
      id: r.id, studentId: r.student_id, quantity: r.quantity, status: r.status, requestedAt: r.requested_at,
      approvedAt: r.approved_at, approvedBy: r.approved_by, amountCollected: r.amount_collected == null ? null : Number(r.amount_collected),
    }));
  },
  async tickets() {
    return (await fetchAll('tickets', '*', 'ticket_no')).map((r) => ({
      id: r.id, ticketNo: r.ticket_no, requestId: r.request_id, studentId: r.student_id, seq: r.seq, issuedAt: r.issued_at,
    }));
  },
  async luckyDrawWinners() {
    return (await fetchAll('lucky_draw_winners', '*', 'drawn_at')).map((r) => ({
      id: r.id, ticketId: r.ticket_id, ticketNo: r.ticket_no, studentId: r.student_id, studentName: r.student_name,
      class: r.class_name, section: r.section, campus: r.campus, prizeName: r.prize_name, prizeEmoji: r.prize_emoji,
      drawnAt: r.drawn_at, drawnBy: r.drawn_by,
    }));
  },
  async leaveRequests() {
    return (await fetchAll('leave_requests', '*', 'applied_on')).reverse().map((r) => ({
      id: r.id, employeeId: r.employee_id, employeeName: r.employee_name, employeeCode: r.employee_code,
      department: r.department, campus: r.campus, applicantRole: r.applicant_role, approverRole: r.approver_role,
      leaveType: r.leave_type, fromDate: r.from_date, toDate: r.to_date, reason: r.reason, status: r.status,
      appliedOn: r.applied_on, reviewedOn: r.reviewed_on, reviewedBy: r.reviewed_by, reviewerRemarks: r.reviewer_remarks,
    }));
  },
  async stats() {
    const { data } = await supabase.rpc('dashboard_stats');
    return data || { faculty: 0, unpaid: 0 };
  },
};

export const ALL_KEYS = Object.keys(fetchers);

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export async function avatarUrl(path) {
  if (!path) return undefined;
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
  return data?.signedUrl;
}

/** Build the `user` object the UI expects from the signed-in auth user. */
export async function loadProfile(authUserId) {
  const { data: s } = await supabase.from('staff').select('*').eq('id', authUserId).maybeSingle();
  if (s) {
    const f = staffToUi(s);
    return { type: 'faculty', ...f, avatar: await avatarUrl(f.avatarPath) };
  }
  const { data: st } = await supabase.from('students').select('*').eq('id', authUserId).maybeSingle();
  if (st) {
    const x = studentToUi(st);
    return { type: 'student', role: 'student', ...x, avatar: await avatarUrl(x.avatarPath) };
  }
  return null;
}

export async function signIn(category, idValue, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail(category, idValue), password });
  if (error) throw new Error(category === 'faculty' ? 'Incorrect Employee ID or password.' : 'Incorrect Roll Number or password.');
  const profile = await loadProfile(data.user.id);
  if (!profile) { await supabase.auth.signOut(); throw new Error('This account has no portal profile. Contact the IT department.'); }
  return profile;
}

export const signOut = () => supabase.auth.signOut();

export async function getSessionProfile() {
  const { data } = await supabase.auth.getSession();
  return data.session ? loadProfile(data.session.user.id) : null;
}

export async function changePassword(oldPass, newPass) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPass });
  if (e1) throw new Error('Current password is incorrect.');
  const { error } = await supabase.auth.updateUser({ password: newPass });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------------ */
/* Avatars (private Storage bucket, one folder per user)               */
/* ------------------------------------------------------------------ */

function resizeImage(file, max = 512) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Image conversion failed'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Could not read the image'));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadAvatar(user, file) {
  const blob = await resizeImage(file);
  const path = `${user.id}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  const table = user.type === 'student' ? 'students' : 'staff';
  const { error: e2 } = await supabase.from(table).update({ avatar_path: path }).eq('id', user.id);
  if (e2) throw e2;
  if (user.avatarPath) await supabase.storage.from('avatars').remove([user.avatarPath]);
  return { path, url: await avatarUrl(path) };
}

/* ------------------------------------------------------------------ */
/* Mutations. Each one throws on failure; `createActions` wraps them.  */
/* ------------------------------------------------------------------ */

async function callAdminFn(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
const ok = ({ error }) => { if (error) throw error; };

export const mutations = {
  createStaff: (f) => callAdminFn({ action: 'create_staff', ...f }),
  createStudent: (f) => callAdminFn({ action: 'create_student', ...f }),
  deleteUser: (kind, id) => callAdminFn({ action: 'delete_user', kind, id }),
  resetPassword: (kind, id) => callAdminFn({ action: 'reset_password', kind, id }),

  async updateStaff(i) {
    ok(await supabase.from('staff').update({
      name: i.name, role: i.role, designation_role: i.designationRole, designation: i.designation,
      department: i.department || '', campus: i.campus || '', email: i.email || null, phone: i.phone || null, cnic: i.cnic || null,
    }).eq('id', i.id));
  },
  async updateStudent(i) {
    ok(await supabase.from('students').update({ name: i.name, class_name: i.class, section: i.section }).eq('id', i.id));
  },
  async setRoleModules(role, modules) { ok(await supabase.from('role_permissions').upsert({ role, modules })); },
  async setEmployeeModules(id, modules) { ok(await supabase.from('staff').update({ allowed_modules: modules }).eq('id', id)); },

  async markAttendance(studentId, className, date, status, staffId) {
    ok(await supabase.from('attendance_records').upsert(
      { student_id: studentId, class_name: className, attendance_date: date, status, marked_by: staffId },
      { onConflict: 'student_id,attendance_date' }));
  },
  async saveGrades(rows) {
    ok(await supabase.from('grades').upsert(
      rows.map((r) => ({ student_id: r.studentId, subject: r.subject, term: r.term, score: r.score, graded_on: r.date })),
      { onConflict: 'student_id,subject,term' }));
  },
  async generateInvoices(studentIds, month, amount, dueDate) {
    const { data, error } = await supabase.from('fee_invoices').upsert(
      studentIds.map((id) => ({ student_id: id, month, amount, due_date: dueDate, paid: false })),
      { onConflict: 'student_id,month', ignoreDuplicates: true }).select('id');
    if (error) throw error;
    return data.length;
  },
  async setFeePaid(feeId, paid) { ok(await supabase.from('fee_invoices').update({ paid }).eq('id', feeId)); },

  async saveTimetableCell(className, day, period, cell) {
    ok(await supabase.from('timetable_entries').upsert(
      { class_name: className, day, period, subject: cell.subject || '', teacher: cell.teacher || '' },
      { onConflict: 'class_name,day,period' }));
  },

  async postAnnouncement(title, body, user) {
    ok(await supabase.from('announcements').insert({ title, body, author_id: user.id, author_name: user.name }));
  },
  async deleteAnnouncement(id) { ok(await supabase.from('announcements').delete().eq('id', id)); },

  async requestTickets(studentId, quantity) { ok(await supabase.from('ticket_requests').insert({ student_id: studentId, quantity })); },
  async approveTicketRequest(id) { ok(await supabase.rpc('approve_ticket_request', { p_request: id })); },
  async rejectTicketRequest(id) { ok(await supabase.rpc('reject_ticket_request', { p_request: id })); },

  async addWinner(w) {
    ok(await supabase.from('lucky_draw_winners').insert({
      ticket_id: w.ticketId, ticket_no: w.ticketNo, student_id: w.studentId, student_name: w.studentName,
      class_name: w.class, section: w.section, campus: w.campus, prize_name: w.prizeName, prize_emoji: w.prizeEmoji,
      drawn_at: w.drawnAt, drawn_by: w.drawnBy,
    }));
  },
  async resetWinners() { ok(await supabase.from('lucky_draw_winners').delete().not('id', 'is', null)); },

  async applyLeave(r, staffId) {
    ok(await supabase.from('leave_requests').insert({
      employee_id: staffId, approver_role: r.approverRole, leave_type: r.leaveType,
      from_date: r.fromDate, to_date: r.toDate, reason: r.reason,
    }));
  },
  async reviewLeave(id, status, remarks) { ok(await supabase.rpc('review_leave', { p_id: id, p_status: status, p_remarks: remarks })); },
};
