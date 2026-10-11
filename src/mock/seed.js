import { DEFAULT_TENANT_ID, DEMO_PASSWORD } from '../services/config'

/**
 * Demo data for the local-storage mode. Everything here is fictional.
 * The shapes mirror what the Core returns so the UI needs no changes.
 * Dates are relative to "today" so the calendar / overdue counters always look alive.
 */

// Deterministic uuid-looking ids, so a reset always produces the same records.
function makeIdFactory(seed = 20260101) {
  let a = seed
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0)
  }
  const hex = (n) => Array.from({ length: n }, () => (next() & 15).toString(16)).join('')
  return () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
}

const DAY = 86400000
const dayStr = (offset) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)
const agoIso = (minutes) => new Date(Date.now() - minutes * 60000).toISOString()

export const PERMISSION_CATALOGUE = [
  { module: 'Identity', name: 'users.view', description: 'View users' },
  { module: 'Identity', name: 'users.create', description: 'Create users' },
  { module: 'Identity', name: 'users.update', description: 'Update users' },
  { module: 'Identity', name: 'users.assign_roles', description: 'Assign roles to users' },
  { module: 'Identity', name: 'users.assign_permissions', description: 'Assign direct permissions to users' },
  { module: 'Identity', name: 'roles.view', description: 'View roles' },
  { module: 'Identity', name: 'roles.create', description: 'Create roles' },
  { module: 'Identity', name: 'roles.update', description: 'Update roles' },
  { module: 'Identity', name: 'roles.assign_permissions', description: 'Assign permissions to roles' },
  { module: 'Identity', name: 'permissions.view', description: 'View permissions' },
  { module: 'Identity', name: 'org_chart.view', description: 'View organisation chart' },
  { module: 'Identity', name: 'groups.view', description: 'View groups' },
  { module: 'Identity', name: 'groups.create', description: 'Create groups' },
  { module: 'Identity', name: 'groups.update', description: 'Update groups' },
  { module: 'Identity', name: 'groups.assign_permissions', description: 'Assign permissions to groups' },
  { module: 'Identity', name: 'groups.manage_members', description: 'Manage group members' },
  { module: 'Platform', name: 'tenants.view', description: 'View tenants' },
  { module: 'Platform', name: 'tenants.create', description: 'Create tenants' },
  { module: 'Platform', name: 'audit_logs.view', description: 'View audit logs' },
  { module: 'Platform', name: 'settings.view', description: 'View settings' },
  { module: 'Platform', name: 'settings.update', description: 'Update settings' },
]

export const DB_VERSION = 1

export function buildSeed() {
  const id = makeIdFactory()
  const tenantId = DEFAULT_TENANT_ID

  const permissions = PERMISSION_CATALOGUE.map((p) => ({ id: id(), ...p }))
  const allNames = permissions.map((p) => p.name)

  /* ---------------------------- roles ---------------------------- */
  const R = {}
  const roles = []
  const addRole = (key, name, description, parentKey, perms, isSystem = false) => {
    R[key] = id()
    roles.push({
      id: R[key], tenantId, name, description,
      parentRoleId: parentKey ? R[parentKey] : null,
      isSystem, permissions: perms,
    })
  }
  const base = ['users.view', 'roles.view', 'org_chart.view']
  addRole('admin', 'مدیر سیستم', 'دسترسی کامل به همه بخش‌ها', null, allNames, true)
  addRole('pm', 'مدیر پروژه', 'مسئول برنامه‌ریزی و کنترل پروژه‌ها', 'admin', [...base, 'groups.view', 'permissions.view'])
  addRole('lead', 'سرپرست مهندسی', 'سرپرستی تیم اجرایی و فنی', 'pm', base)
  addRole('eng', 'مهندس اجرا', 'اجرای فعالیت‌های کارگاهی و فنی', 'lead', ['users.view'])
  addRole('coord', 'کارشناس هماهنگی', 'هماهنگی بین پیمانکاران و تیم پروژه', 'pm', ['users.view'])
  addRole('cfo', 'مدیر مالی', 'مدیریت بودجه و گزارش‌های مالی', 'admin', [...base, 'audit_logs.view'])
  addRole('fin', 'کارشناس مالی', 'ثبت و کنترل اسناد مالی', 'cfo', ['users.view'])
  addRole('hr', 'کارشناس منابع انسانی', 'مدیریت پرسنل و ساختار سازمانی', 'admin', [...base, 'users.create', 'users.update', 'users.assign_roles'])

  /* ---------------------------- users ---------------------------- */
  const U = {}
  const users = []
  const addUser = (key, email, displayName, roleKeys, extra = {}) => {
    U[key] = id()
    const [firstName, ...rest] = displayName.split(' ')
    users.push({
      id: U[key], tenantId, email, displayName, password: DEMO_PASSWORD,
      isActive: extra.isActive ?? true,
      roleIds: roleKeys.map((k) => R[k]),
      directPermissionIds: [],
      lastLoginAtUtc: extra.lastLogin ?? agoIso(60 * 24 * 2),
      profile: {
        firstName, lastName: rest.join(' '), nationalCode: extra.nationalCode || '', birthDate: extra.birthDate || null,
        mobileNumber: extra.mobile || '', phoneNumber: '', emergencyContactName: '', emergencyContactPhone: '', address: '',
        employeeCode: extra.code || '', jobTitle: extra.jobTitle || '', department: extra.department || '',
        officeLocation: extra.office || 'دفتر مرکزی تهران', hireDate: extra.hireDate || null,
        employmentType: extra.employmentType || 'تمام‌وقت', language: 'fa', timeZone: 'Asia/Tehran', notes: '',
      },
    })
  }
  addUser('admin', 'admin@nexus.local', 'مدیر سیستم', ['admin'], { jobTitle: 'مدیر سامانه', department: 'فناوری اطلاعات', code: 'RZ-1001', lastLogin: agoIso(12), hireDate: '2021-03-21', mobile: '09120000001' })
  addUser('ali', 'ali.rezaei@rozet.ir', 'علی رضایی', ['pm'], { jobTitle: 'مدیر پروژه ارشد', department: 'پروژه‌ها', code: 'RZ-1002', lastLogin: agoIso(95), hireDate: '2020-06-10', mobile: '09121112233' })
  addUser('maryam', 'maryam.ahmadi@rozet.ir', 'مریم احمدی', ['lead'], { jobTitle: 'سرپرست مهندسی', department: 'مهندسی', code: 'RZ-1003', lastLogin: agoIso(240), hireDate: '2021-01-15', mobile: '09122223344' })
  addUser('sina', 'sina.mohammadi@rozet.ir', 'سینا محمدی', ['eng'], { jobTitle: 'مهندس اجرا', department: 'مهندسی', code: 'RZ-1004', lastLogin: agoIso(60 * 5), hireDate: '2022-02-01', mobile: '09123334455' })
  addUser('hamid', 'hamid.jafari@rozet.ir', 'حمید جعفری', ['eng'], { jobTitle: 'کارشناس فنی', department: 'مهندسی', code: 'RZ-1005', lastLogin: agoIso(60 * 26), hireDate: '2022-08-23', mobile: '09124445566' })
  addUser('zahra', 'zahra.karimi@rozet.ir', 'زهرا کریمی', ['coord'], { jobTitle: 'کارشناس هماهنگی', department: 'پروژه‌ها', code: 'RZ-1006', lastLogin: agoIso(60 * 3), hireDate: '2021-11-07', mobile: '09125556677' })
  addUser('reza', 'reza.hosseini@rozet.ir', 'رضا حسینی', ['cfo'], { jobTitle: 'مدیر مالی', department: 'مالی', code: 'RZ-1007', lastLogin: agoIso(30), hireDate: '2019-09-01', mobile: '09126667788' })
  addUser('narges', 'narges.sadeghi@rozet.ir', 'نرگس صادقی', ['fin'], { jobTitle: 'کارشناس مالی', department: 'مالی', code: 'RZ-1008', lastLogin: agoIso(60 * 8), hireDate: '2023-04-12', mobile: '09127778899' })
  addUser('fatemeh', 'fatemeh.moradi@rozet.ir', 'فاطمه مرادی', ['hr'], { jobTitle: 'کارشناس منابع انسانی', department: 'منابع انسانی', code: 'RZ-1009', lastLogin: agoIso(60 * 30), hireDate: '2022-05-30', mobile: '09128889900' })
  addUser('mehdi', 'mehdi.bagheri@rozet.ir', 'مهدی باقری', [], { jobTitle: 'کارآموز', department: 'مهندسی', code: 'RZ-1010', employmentType: 'کارآموز', lastLogin: agoIso(60 * 72), hireDate: '2026-01-04' })
  addUser('leila', 'leila.naseri@rozet.ir', 'لیلا ناصری', ['eng'], { isActive: false, jobTitle: 'مهندس اجرا', department: 'مهندسی', code: 'RZ-1011', employmentType: 'قراردادی', lastLogin: agoIso(60 * 24 * 40), hireDate: '2022-10-10' })
  addUser('saeed', 'saeed.tavakoli@rozet.ir', 'سعید توکلی', [], { jobTitle: 'مشاور بیرونی', department: 'پروژه‌ها', code: 'RZ-1012', employmentType: 'پیمانکار', lastLogin: agoIso(60 * 24 * 6) })

  /* ---------------------------- groups ---------------------------- */
  const permId = (name) => permissions.find((p) => p.name === name).id
  const groups = [
    { id: id(), tenantId, name: 'کمیته راهبری', description: 'تصمیم‌گیری درباره پروژه‌های کلان', isActive: true, permissionIds: ['audit_logs.view', 'org_chart.view', 'users.view'].map(permId), memberIds: [U.admin, U.ali, U.reza] },
    { id: id(), tenantId, name: 'تیم مالی', description: 'گزارش‌دهی و کنترل هزینه', isActive: true, permissionIds: ['users.view'].map(permId), memberIds: [U.reza, U.narges] },
    { id: id(), tenantId, name: 'تیم اجرایی کارگاه', description: 'هماهنگی روزانه کارگاه‌ها', isActive: true, permissionIds: ['users.view', 'groups.view'].map(permId), memberIds: [U.maryam, U.sina, U.hamid, U.zahra] },
    { id: id(), tenantId, name: 'کارگروه قدیمی تأسیسات', description: 'منحل‌شده', isActive: false, permissionIds: [], memberIds: [] },
  ]

  /* ---------------------------- projects ---------------------------- */
  const P = { mall: id(), tower: id(), aftab: id(), hq: id() }
  const projects = [
    { id: P.mall, tenantId, name: 'پروژه توسعه مرکز تجاری', code: 'RZT-101', type: 0, status: 1, managerUserId: U.ali, ownerUserId: U.admin, startDate: dayStr(-120), endDate: dayStr(240), cost: 48500000000, goal: 'ساخت و بهره‌برداری فاز دوم مرکز تجاری روزت', description: 'توسعه ۱۲ هزار متر مربع فضای تجاری و پارکینگ طبقاتی.', createdAt: agoIso(60 * 24 * 120) },
    { id: P.tower, tenantId, name: 'پروژه برج اداری روزت', code: 'RZT-102', type: 0, status: 1, managerUserId: U.maryam, ownerUserId: U.admin, startDate: dayStr(-60), endDate: dayStr(420), cost: 112000000000, goal: 'احداث برج ۲۲ طبقه اداری', description: 'برج اداری با استاندارد انرژی سبز.', createdAt: agoIso(60 * 24 * 60) },
    { id: P.aftab, tenantId, name: 'پروژه مجتمع مسکونی آفتاب', code: 'RZT-103', type: 1, status: 1, managerUserId: U.ali, ownerUserId: U.reza, startDate: dayStr(-30), endDate: dayStr(300), cost: 76000000000, goal: 'تحویل ۱۲۰ واحد مسکونی', description: 'اجرای چابک با اسپرینت‌های دو هفته‌ای.', createdAt: agoIso(60 * 24 * 30) },
    { id: P.hq, tenantId, name: 'بازسازی دفتر مرکزی', code: 'RZT-090', type: 1, status: 3, managerUserId: U.zahra, ownerUserId: U.admin, startDate: dayStr(-240), endDate: dayStr(-20), cost: 6200000000, goal: 'نوسازی دفتر مرکزی', description: 'پروژه تکمیل‌شده.', createdAt: agoIso(60 * 24 * 240) },
  ]

  const task = (projectId, title, resp, appr, offset, priority, status, sprint, description = '') => ({
    id: id(), tenantId, projectId, title, description, responsibleUserId: U[resp], approverUserId: U[appr],
    dueDate: dayStr(offset), priority, status, sprintNumber: sprint, createdAt: agoIso(60 * 24 * 10),
  })
  const tasks = [
    task(P.mall, 'تکمیل برنامه زمان‌بندی فاز دوم', 'sina', 'ali', 3, 2, 1, 4, 'بازنگری شبکه فعالیت‌ها بر اساس تأخیر تأمین مصالح'),
    task(P.mall, 'بررسی و تأیید نقشه‌های اجرایی', 'maryam', 'ali', 6, 1, 1, 4),
    task(P.mall, 'هماهنگی جلسه با پیمانکار تأسیسات', 'zahra', 'ali', -2, 0, 2, 3),
    task(P.mall, 'جمع‌آوری مستندات قرارداد', 'hamid', 'maryam', 9, 1, 0, 5),
    task(P.mall, 'تهیه گزارش هفتگی پیشرفت', 'sina', 'ali', -1, 2, 0, 4),
    task(P.tower, 'بازبینی طرح سازه طبقات ۱ تا ۸', 'maryam', 'ali', 12, 3, 1, 2),
    task(P.tower, 'استعلام قیمت آسانسورها', 'narges', 'reza', 5, 1, 0, 2),
    task(P.tower, 'اخذ مجوز شهرداری', 'zahra', 'ali', -4, 3, 1, 1, 'در انتظار پاسخ کمیسیون ماده ۵'),
    task(P.tower, 'نهایی‌سازی قرارداد مشاور ناظر', 'reza', 'admin', -9, 2, 2, 1),
    task(P.aftab, 'طراحی پلان واحدهای نمونه', 'hamid', 'maryam', 7, 1, 1, 6),
    task(P.aftab, 'خرید و انتقال میلگرد بلوک B', 'narges', 'reza', 2, 2, 1, 6),
    task(P.aftab, 'بازدید کیفی بتن‌ریزی بلوک A', 'sina', 'maryam', 0, 3, 0, 6),
    task(P.aftab, 'ثبت صورت‌وضعیت ماه جاری', 'narges', 'reza', 15, 1, 0, 7),
    task(P.aftab, 'تحویل ساختمان نمونه به بازاریابی', 'zahra', 'ali', -12, 0, 2, 5),
    task(P.hq, 'تحویل نهایی دفتر مرکزی', 'zahra', 'admin', -22, 1, 2, 3),
  ]

  const act = (projectId, name, resp, start, end, planned, actual, weight) => ({
    id: id(), tenantId, projectId, parentActivityId: null, name, description: '', deliverableId: null,
    responsibleUserId: U[resp], approverUserId: U.ali, startDate: dayStr(start), endDate: dayStr(end),
    durationDays: end - start, manHours: (end - start) * 8, weight, plannedProgress: planned, actualProgress: actual,
  })
  const activities = [
    act(P.mall, 'گودبرداری و پایدارسازی', 'sina', -110, -60, 100, 100, 2),
    act(P.mall, 'اجرای فونداسیون', 'sina', -60, -10, 100, 96, 3),
    act(P.mall, 'اسکلت بتنی طبقات ۱ تا ۳', 'maryam', -10, 80, 22, 18, 5),
    act(P.mall, 'نصب تأسیسات مکانیکی', 'hamid', 60, 160, 0, 0, 3),
    act(P.mall, 'نماکاری و محوطه‌سازی', 'zahra', 140, 230, 0, 0, 2),
    act(P.tower, 'مطالعات ژئوتکنیک', 'maryam', -55, -30, 100, 100, 1),
    act(P.tower, 'طراحی معماری و سازه', 'hamid', -40, 40, 55, 48, 4),
    act(P.aftab, 'آماده‌سازی کارگاه', 'sina', -28, -14, 100, 100, 1),
    act(P.aftab, 'اجرای سازه بلوک A', 'sina', -14, 70, 25, 21, 4),
  ]

  const prog = (projectId, offset, planned, actual, desc, delay = null) => {
    const deviation = Math.round((actual - planned) * 10) / 10
    return {
      id: id(), tenantId, projectId, registerDate: dayStr(offset), statusDescription: desc, plannedProgress: planned,
      actualProgress: actual, deviation, performanceClassification: deviation >= -2 ? 0 : deviation > -10 ? 1 : 2, delayReasons: delay,
    }
  }
  const progressUpdates = [
    prog(P.mall, -42, 28, 27, 'پایان عملیات خاکی'),
    prog(P.mall, -28, 35, 32, 'شروع فونداسیون', 'تأخیر در تحویل میلگرد'),
    prog(P.mall, -14, 41, 36, 'ادامه فونداسیون', 'بارندگی و توقف بتن‌ریزی'),
    prog(P.mall, -2, 47, 38, 'آماده‌سازی اسکلت', 'کمبود نیروی ماهر قالب‌بند'),
    prog(P.tower, -20, 15, 15, 'تکمیل مطالعات ژئوتکنیک'),
    prog(P.tower, -6, 22, 20, 'ادامه طراحی سازه', 'بازنگری بار زلزله'),
    prog(P.aftab, -10, 12, 12, 'پایان آماده‌سازی کارگاه'),
    prog(P.aftab, -3, 18, 15, 'شروع اجرای سازه بلوک A', 'تأخیر در ورود جرثقیل'),
  ]

  const doc = (projectId, description, documentType, fileName, sizeBytes, offset, approvalStatus) => ({
    id: id(), tenantId, projectId, description, documentType, fileName, sizeBytes, registerDate: dayStr(offset), approvalStatus,
  })
  const documents = [
    doc(P.mall, 'گزارش هفتگی پیشرفت - هفته ۱۸', 0, 'weekly-report-18.pdf', 842000, -3, 2),
    doc(P.mall, 'صورت‌جلسه هماهنگی با پیمانکار تأسیسات', 2, 'meeting-minutes-mep.docx', 215000, -9, 2),
    doc(P.mall, 'نامه درخواست تمدید مهلت تحویل مصالح', 1, 'extension-letter.pdf', 96000, -15, 1),
    doc(P.tower, 'گزارش ژئوتکنیک نهایی', 0, 'geotech-final.pdf', 5400000, -25, 2),
    doc(P.tower, 'نقشه‌های معماری - ویرایش ۳', 3, 'architecture-r3.zip', 18200000, -5, 1),
  ]

  const D = { m1: id(), m2: id(), t1: id(), a1: id() }
  const deliverables = [
    { id: D.m1, tenantId, projectId: P.mall, title: 'تحویل فونداسیون و تأییدیه ناظر', description: 'پایان اجرای فونداسیون', acceptanceCriteria: 'گواهی آزمایش بتن و تأیید ناظر', responsibleUserId: U.sina, targetDate: dayStr(10), status: 1 },
    { id: D.m2, tenantId, projectId: P.mall, title: 'تکمیل اسکلت طبقات ۱ تا ۳', description: '', acceptanceCriteria: 'مطابق نقشه‌های اجرایی', responsibleUserId: U.maryam, targetDate: dayStr(80), status: 0 },
    { id: D.t1, tenantId, projectId: P.tower, title: 'طرح نهایی سازه', description: '', acceptanceCriteria: 'تأیید سازمان نظام مهندسی', responsibleUserId: U.hamid, targetDate: dayStr(40), status: 1 },
    { id: D.a1, tenantId, projectId: P.aftab, title: 'ساختمان نمونه', description: '', acceptanceCriteria: 'بازدید و تأیید بازاریابی', responsibleUserId: U.zahra, targetDate: dayStr(-12), status: 3 },
  ]
  const kpis = [
    { id: id(), tenantId, projectId: P.mall, deliverableId: D.m1, type: 1, description: 'درصد پیشرفت فیزیکی فونداسیون', formula: 'حجم بتن ریخته‌شده / حجم کل × ۱۰۰', targetValue: 100 },
    { id: id(), tenantId, projectId: P.mall, deliverableId: D.m1, type: 0, description: 'رضایت ناظر از کیفیت اجرا', formula: '', targetValue: null },
    { id: id(), tenantId, projectId: P.mall, deliverableId: D.m2, type: 1, description: 'شاخص عملکرد زمانی (SPI)', formula: 'EV / PV', targetValue: 0.95 },
    { id: id(), tenantId, projectId: P.tower, deliverableId: D.t1, type: 1, description: 'تعداد اصلاحات طرح پس از بازبینی', formula: '', targetValue: 3 },
  ]

  const risk = (projectId, description, p, s, i, plan, owner) => ({
    id: id(), tenantId, projectId, description, probabilityScore: p, severityScore: s, impactScore: i, rpn: p * s * i, responsePlan: plan, riskOwnerUserId: U[owner],
  })
  const risks = [
    risk(P.mall, 'نوسان قیمت میلگرد و سیمان', 4, 4, 5, 'قرارداد خرید پیش‌پرداختی با تأمین‌کننده معتبر', 'reza'),
    risk(P.mall, 'کمبود نیروی ماهر قالب‌بند', 3, 3, 4, 'قرارداد با دو پیمانکار جایگزین', 'ali'),
    risk(P.mall, 'تأخیر در تأمین تجهیزات تأسیسات', 3, 4, 3, 'سفارش‌گذاری زودهنگام اقلام کلیدی', 'hamid'),
    risk(P.tower, 'تأخیر در صدور پروانه ساخت', 4, 5, 5, 'پیگیری هفتگی و پشتیبانی حقوقی', 'zahra'),
    risk(P.tower, 'تغییر ضوابط شهرسازی', 2, 4, 4, '', 'maryam'),
  ]

  const stakeholder = (projectId, name, isInternal, power, interest, expectations, strategy) => ({
    id: id(), tenantId, projectId, name, isInternal, power, interest, expectations, notes: '', engagementStrategy: strategy, requirements: '',
  })
  const stakeholders = [
    stakeholder(P.mall, 'هیئت مدیره گروه روزت', true, 2, 2, 'تحویل در موعد و در چارچوب بودجه', 'گزارش ماهانه و جلسه راهبری'),
    stakeholder(P.mall, 'شهرداری منطقه ۵', false, 2, 1, 'رعایت ضوابط و پروانه ساخت', 'هماهنگی از طریق کارشناس هماهنگی'),
    stakeholder(P.mall, 'پیمانکار تأسیسات', false, 1, 2, 'پرداخت به‌موقع صورت‌وضعیت‌ها', 'جلسه هماهنگی هفتگی'),
    stakeholder(P.tower, 'سرمایه‌گذار اصلی', false, 2, 2, 'بازگشت سرمایه طبق برنامه', 'گزارش فصلی و بازدید کارگاه'),
  ]

  const member = (projectId, userKey, roleTitle) => ({ id: id(), tenantId, projectId, userId: U[userKey], roleTitle })
  const teamMembers = [
    member(P.mall, 'ali', 'مدیر پروژه'), member(P.mall, 'maryam', 'سرپرست مهندسی'), member(P.mall, 'sina', 'مهندس اجرا'),
    member(P.mall, 'zahra', 'هماهنگ‌کننده'), member(P.mall, 'hamid', 'کارشناس فنی'),
    member(P.tower, 'maryam', 'مدیر طراحی'), member(P.tower, 'hamid', 'طراح سازه'),
    member(P.aftab, 'ali', 'مدیر پروژه'), member(P.aftab, 'sina', 'سرپرست کارگاه'),
  ]
  const governanceRoles = [
    { id: id(), tenantId, projectId: P.mall, title: 'کارفرما', userId: U.admin, personnelNumber: 'RZ-1001', phone: '021-88000001', email: 'admin@nexus.local', serviceLocation: 'دفتر مرکزی' },
    { id: id(), tenantId, projectId: P.mall, title: 'ناظر عالی', userId: U.reza, personnelNumber: 'RZ-1007', phone: '021-88000007', email: 'reza.hosseini@rozet.ir', serviceLocation: 'دفتر مرکزی' },
    { id: id(), tenantId, projectId: P.tower, title: 'مدیر پروژه', userId: U.maryam, personnelNumber: 'RZ-1003', phone: '', email: 'maryam.ahmadi@rozet.ir', serviceLocation: 'کارگاه برج' },
  ]

  /* ---------------------------- chat ---------------------------- */
  const conv = (a, b, lastMessageAt) => ({ id: id(), type: 'Direct', title: null, participantIds: [U[a], U[b]], lastMessage: '', lastMessageAt })
  const conversations = [
    conv('admin', 'ali', agoIso(25)),
    conv('admin', 'maryam', agoIso(60 * 5)),
    conv('admin', 'reza', agoIso(60 * 27)),
    conv('ali', 'maryam', agoIso(60 * 3)),
    conv('ali', 'reza', agoIso(60 * 6)),
  ]
  const messages = []
  const say = (convIndex, from, text, minutesAgo, readBy = []) => {
    const c = conversations[convIndex]
    messages.push({ id: id(), conversationId: c.id, senderUserId: U[from], text, sentAt: agoIso(minutesAgo), readBy: [U[from], ...readBy.map((k) => U[k])] })
  }
  say(0, 'admin', 'سلام علی جان، وضعیت گزارش هفتگی مرکز تجاری چطوره؟', 60 * 26, ['ali'])
  say(0, 'ali', 'سلام، گزارش آماده است؛ فقط منتظر عدد نهایی صورت‌وضعیت هستم.', 60 * 25, ['admin'])
  say(0, 'admin', 'عالیه. لطفاً تا پایان وقت اداری در سامانه ثبت کنید.', 60 * 25 - 5, ['ali'])
  say(0, 'ali', 'حتماً. به‌علاوه تأخیر فونداسیون را در بخش ریسک‌ها هم ثبت کردم.', 60 * 2, ['admin'])
  say(0, 'ali', 'جلسه هماهنگی با پیمانکار تأسیسات فردا ساعت ۱۰ است، شما هم می‌آیید؟', 25, [])
  say(1, 'maryam', 'نقشه‌های اجرایی برج را بازبینی کردم؛ دو مورد اصلاحیه دارد.', 60 * 6)
  say(1, 'admin', 'ممنون مریم، اصلاحیه‌ها را به آقای جعفری هم بفرستید.', 60 * 5, ['maryam'])
  say(2, 'reza', 'بودجه فاز دوم مرکز تجاری برای تأیید نهایی آماده است.', 60 * 28)
  say(2, 'admin', 'می‌بینمش و تا فردا نظر می‌دهم.', 60 * 27, ['reza'])
  say(3, 'ali', 'مریم، ظرفیت تیم اجرا برای اسپرینت آینده چقدره؟', 60 * 4, ['maryam'])
  say(3, 'maryam', 'حدود ۸۰٪؛ دو نفر در مرخصی هستند.', 60 * 3, ['ali'])
  say(4, 'reza', 'صورت‌وضعیت ماه جاری را برایتان ایمیل کردم.', 60 * 6, ['ali'])
  for (const c of conversations) {
    const last = messages.filter((m) => m.conversationId === c.id).sort((x, y) => y.sentAt.localeCompare(x.sentAt))[0]
    if (last) { c.lastMessage = last.text; c.lastMessageAt = last.sentAt }
  }

  /* ---------------------------- notifications ---------------------------- */
  const note = (userKey, title, message, minutesAgo, isRead = false) => ({ id: id(), userId: U[userKey], title, message, isRead, createdAt: agoIso(minutesAgo) })
  const notifications = [
    note('admin', 'ریسک جدید ثبت شد', 'ریسک «نوسان قیمت میلگرد و سیمان» برای پروژه مرکز تجاری ثبت شد.', 40),
    note('admin', 'وظیفه دارای تأخیر', 'وظیفه «اخذ مجوز شهرداری» از موعد خود عبور کرده است.', 90),
    note('admin', 'گزارش پیشرفت تأیید شد', 'گزارش هفته ۱۸ پروژه مرکز تجاری توسط مدیر پروژه تأیید شد.', 60 * 5),
    note('admin', 'کاربر جدید', 'حساب «سعید توکلی» ایجاد شد و منتظر اختصاص سمت سازمانی است.', 60 * 26, true),
    note('admin', 'خوش آمدید', 'به نسخه نمایشی سامانه مدیریت روزت خوش آمدید.', 60 * 48, true),
    note('ali', 'وظیفه جدید به شما واگذار شد', 'تهیه گزارش هفتگی پیشرفت - پروژه مرکز تجاری', 30),
    note('reza', 'در انتظار تأیید', 'یک صورت‌وضعیت برای تأیید مالی منتظر شماست.', 55),
  ]

  /* ---------------------------- audit log ---------------------------- */
  const auditLogs = []
  const log = (action, userKey, minutesAgo, details = null, ip = null) => auditLogs.push({
    id: id(), tenantId, action, userId: U[userKey], occurredAtUtc: agoIso(minutesAgo), ipAddress: ip || `192.168.100.${20 + auditLogs.length % 60}`, details,
  })
  log('identity.login', 'admin', 12, 'ورود از مرورگر Chrome')
  log('identity.login', 'reza', 30, 'ورود از مرورگر Edge')
  log('identity.login', 'ali', 95)
  log('users.assign_roles', 'admin', 130, 'تغییر سمت «سعید توکلی»')
  log('users.create', 'admin', 60 * 26, 'ایجاد کاربر سعید توکلی')
  log('identity.login_failed', 'sina', 60 * 5, 'رمز عبور نادرست', '192.168.100.77')
  log('identity.login', 'sina', 60 * 5 - 2)
  log('roles.assign_permissions', 'admin', 60 * 28, 'ویرایش دسترسی‌های «مدیر مالی»')
  log('identity.login', 'zahra', 60 * 3)
  log('identity.forgot_password', 'hamid', 60 * 30, 'درخواست بازیابی رمز عبور')
  log('identity.reset_password', 'hamid', 60 * 30 - 6)
  log('identity.login', 'hamid', 60 * 26)
  log('users.update', 'fatemeh', 60 * 40, 'غیرفعال‌سازی «لیلا ناصری»')
  log('identity.login_failed', 'leila', 60 * 24 * 40, 'حساب غیرفعال', '10.20.30.40')
  log('roles.create', 'admin', 60 * 24 * 3, 'ایجاد سمت «کارشناس هماهنگی»')
  log('identity.login', 'maryam', 240)
  log('identity.login', 'narges', 60 * 8)
  log('identity.login', 'fatemeh', 60 * 30)
  log('users.update', 'admin', 60 * 24 * 4, 'ویرایش مشخصات «علی رضایی»')
  log('identity.login', 'ali', 60 * 24 * 2)
  auditLogs.sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc))

  return {
    __version: DB_VERSION,
    tenant: { id: tenantId, name: 'گروه اقتصادی روزت', slug: 'rozet' },
    permissions, roles, users, groups,
    projects, tasks, activities, progressUpdates, documents, deliverables, kpis, risks, stakeholders, teamMembers, governanceRoles,
    conversations, messages, notifications, auditLogs,
    resetTokens: {},
    demoUserIds: { admin: U.admin, pm: U.ali, cfo: U.reza },
  }
}
