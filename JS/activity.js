// Access control - only admins can access this page
function checkAdminAccess() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user) {
    alert("Please log in to access this page.");
    window.location.href = "/HTML/login.html";
    return false;
  }
  if (user.type !== "admin") {
    alert("This page is only accessible to administrators.");
    if (user.type === "student") {
      window.location.href = "/HTML/index.html";
    } else if (user.type === "teacher") {
      window.location.href = "/HTML/teacherIndex.html";
    } else {
      window.location.href = "/HTML/login.html";
    }
    return false;
  }
  return true;
}

const API_BASE = '/api';

// DOM Elements
const userTypeSelect = document.getElementById('userType');
const domainSelect = document.getElementById('domainSelect');
const courseSelect = document.getElementById('courseSelect');
const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');
const logoutBtn = document.getElementById('logoutBtn');
const summaryCardsRow = document.getElementById('summaryCardsRow');
const activityLogTable = document.getElementById('activityLogTable')?.querySelector('tbody');
const assignmentStatusSelect = document.getElementById('assignmentStatus');
const quizStatusSelect = document.getElementById('quizStatus');
const scoreRange = document.getElementById('scoreRange');
const attendanceRange = document.getElementById('attendanceRange');
const scoreRangeValue = document.getElementById('scoreRangeValue');
const attendanceRangeValue = document.getElementById('attendanceRangeValue');
const liveSearchInput = document.getElementById('liveSearch');

let DATA = {};
let allDomains = new Set();
let allCourses = new Set();
let courseList = [];
let chartInstances = [];

// Fetch all relevant resources from db.json
async function fetchAllData() {
  summaryCardsRow.innerHTML = `<div class='text-center'><div class='spinner-border text-primary'></div></div>`;
  const endpoints = [
    'students', 'teachers', 'courses', 'assignments', 'quizzes', 'assignmentSubmissions',
    'quizSubmissions', 'chats', 'notifications', 'applications', 'enrollments',
    'videoSessions', 'materials', 'issues', 'profiles'
  ];
  const fetches = endpoints.map(ep => fetch(`${API_BASE}/${ep}`).then(r => r.json()));
  const results = await Promise.all(fetches);
  endpoints.forEach((ep, i) => { DATA[ep] = results[i]; });
  courseList = DATA.courses || [];
  extractDomainsAndCourses();
  populateDomainFilter();
  populateCourseFilter();
  renderDashboard();
}

function extractDomainsAndCourses() {
  allDomains = new Set();
  (DATA.students || []).forEach(item => { if (item.domain) allDomains.add(item.domain); });
  (DATA.teachers || []).forEach(item => { if (item.domain) allDomains.add(item.domain); });
  (DATA.courses || []).forEach(course => { if (course.domain) allDomains.add(course.domain); });
  allCourses = new Set();
  (DATA.courses || []).forEach(course => { if (course.title) allCourses.add(course.title); });
}

function populateDomainFilter() {
  if (!domainSelect) return;
  domainSelect.innerHTML = '<option value="">All Domains</option>';
  Array.from(allDomains).sort().forEach(domain => {
    const opt = document.createElement('option');
    opt.value = domain;
    opt.textContent = domain;
    domainSelect.appendChild(opt);
  });
}

function populateCourseFilter() {
  if (!courseSelect) return;
  courseSelect.innerHTML = '<option value="">All Courses</option>';
  let filteredCourses = Array.from(allCourses);
  const selectedDomain = domainSelect?.value;
  if (selectedDomain) {
    filteredCourses = courseList.filter(course => course.domain === selectedDomain).map(course => course.title);
  } else {
    filteredCourses = courseList.map(course => course.title);
  }
  Array.from(new Set(filteredCourses)).sort().forEach(course => {
    const opt = document.createElement('option');
    opt.value = course;
    opt.textContent = course;
    courseSelect.appendChild(opt);
  });
}

[userTypeSelect, domainSelect, courseSelect, dateFromInput, dateToInput, assignmentStatusSelect, quizStatusSelect, scoreRange, attendanceRange, liveSearchInput].forEach(el => {
  if (el) el.addEventListener('input', renderDashboard);
});
if (scoreRange) {
  scoreRange.addEventListener('input', () => {
    scoreRangeValue.textContent = scoreRange.value + '+';
  });
}
if (attendanceRange) {
  attendanceRange.addEventListener('input', () => {
    attendanceRangeValue.textContent = attendanceRange.value + '%+';
  });
}
if (domainSelect) {
  domainSelect.addEventListener('input', () => {
    populateCourseFilter();
    renderDashboard();
  });
}
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    sessionStorage.clear();
    alert('You have been logged out.');
    window.location.href = '/HTML/login.html';
  });
}

// Context-aware filter UI logic
function updateFilterVisibility() {
  const userType = userTypeSelect?.value;
  // Assignment, quiz, score, attendance filters
  const assignmentDiv = assignmentStatusSelect?.closest('.col-12, .col-md-2');
  const quizDiv = quizStatusSelect?.closest('.col-12, .col-md-2');
  const scoreDiv = scoreRange?.closest('.col-12, .col-md-2');
  const attendanceDiv = attendanceRange?.closest('.col-12, .col-md-2');

  if (userType === 'teacher') {
    if (assignmentStatusSelect) assignmentStatusSelect.disabled = true;
    if (quizStatusSelect) quizStatusSelect.disabled = true;
    if (scoreRange) scoreRange.disabled = true;
    if (attendanceRange) attendanceRange.disabled = true;
    if (assignmentDiv) assignmentDiv.style.opacity = 0.5;
    if (quizDiv) quizDiv.style.opacity = 0.5;
    if (scoreDiv) scoreDiv.style.opacity = 0.5;
    if (attendanceDiv) attendanceDiv.style.opacity = 0.5;
  } else {
    if (assignmentStatusSelect) assignmentStatusSelect.disabled = false;
    if (quizStatusSelect) quizStatusSelect.disabled = false;
    if (scoreRange) scoreRange.disabled = false;
    if (attendanceRange) attendanceRange.disabled = false;
    if (assignmentDiv) assignmentDiv.style.opacity = 1;
    if (quizDiv) quizDiv.style.opacity = 1;
    if (scoreDiv) scoreDiv.style.opacity = 1;
    if (attendanceDiv) attendanceDiv.style.opacity = 1;
  }
}

// Attach to userType change
if (userTypeSelect) {
  userTypeSelect.addEventListener('input', () => {
    updateFilterVisibility();
    renderDashboard();
  });
}
// Initial call
updateFilterVisibility();

function getFilteredData() {
  let data = [];
  const userType = userTypeSelect?.value;
  if (!userType) {
    data = [
      ...(DATA.students || []).map(s => ({...s, type: 'student'})),
      ...(DATA.teachers || []).map(t => ({...t, type: 'teacher'}))
    ];
  } else if (userType === 'student') {
    data = (DATA.students || []).map(s => ({...s, type: 'student'}));
  } else if (userType === 'teacher') {
    data = (DATA.teachers || []).map(t => ({...t, type: 'teacher'}));
  }

  // --- Domain filter ---
  const domain = domainSelect?.value;
  if (domain) {
    data = data.filter(item => {
      if (item.type === 'teacher') {
        return item.domain === domain;
      } else if (item.type === 'student') {
        // Find all course titles with this domain
        const domainCourses = (DATA.courses || []).filter(c => c.domain === domain).map(c => c.title);
        // Find all course titles this student is enrolled in
        const enrolledCourses = (DATA.enrollments || []).filter(e => e.studentId === item.id).map(e => e.courseTitle);
        // If any enrolled course is in the domain, include
        return enrolledCourses.some(c => domainCourses.includes(c));
      }
      return false;
    });
  }

  // --- Course filter ---
  const course = courseSelect?.value;
  if (course) {
    data = data.filter(item => {
      if (item.type === 'teacher') {
        return Array.isArray(item.courses) && item.courses.includes(course);
      } else if (item.type === 'student') {
        // Check if student is enrolled in this course
        return (DATA.enrollments || []).some(e => e.studentId === item.id && e.courseTitle === course);
      }
      return false;
    });
  }

  // Date filter: only filter users with activityLog, but do not exclude those without
  const from = dateFromInput?.value;
  const to = dateToInput?.value;
  if (from || to) {
    data = data.filter(item => {
      if (!item.activityLog) return true; // keep users without activityLog
      return item.activityLog.some(dateStr => {
        const d = new Date(dateStr);
        if (from && d < new Date(from)) return false;
        if (to && d > new Date(to)) return false;
        return true;
      });
    });
  }
  // Assignment status filter (students only)
  const assignmentStatus = assignmentStatusSelect?.value;
  if (assignmentStatus) {
    data = data.filter(item => {
      if (item.type !== 'student') return true;
      if (!item.assignments) return false;
      return item.assignments[assignmentStatus] > 0;
    });
  }
  // Quiz type filter (students only)
  const quizType = quizStatusSelect?.value;
  if (quizType) {
    data = data.filter(item => {
      if (item.type !== 'student') return true;
      if (!item.quizTypes) return false;
      return item.quizTypes[quizType] > 0;
    });
  }
  // Score range filter (students only)
  const minScore = parseInt(scoreRange?.value || '0', 10);
  data = data.filter(item => {
    if (item.type !== 'student') return true;
    return (item.score === undefined || item.score >= minScore);
  });
  // Attendance range filter (students only)
  const minAttendance = parseInt(attendanceRange?.value || '0', 10);
  data = data.filter(item => {
    if (item.type !== 'student') return true;
    return (item.attendance === undefined || item.attendance >= minAttendance);
  });
  // Live search filter
  const search = (liveSearchInput && liveSearchInput.value.trim().toLowerCase()) || '';
  if (search) {
    data = data.filter(item => {
      return (
        (item.name && item.name.toLowerCase().includes(search)) ||
        (item.domain && item.domain.toLowerCase().includes(search)) ||
        (item.course && item.course.toLowerCase().includes(search)) ||
        (item.type && item.type.toLowerCase().includes(search))
      );
    });
  }
  return data;
}

function renderDashboard() {
  const data = getFilteredData();
  renderSummaryCards(data);
  renderCharts(data);
  renderActivityLog();
}

function renderSummaryCards(data) {
  // Compute stats
  const totalStudents = (DATA.students || []).length;
  const totalTeachers = (DATA.teachers || []).length;
  const totalCourses = (DATA.courses || []).length;
  const totalAssignments = (DATA.assignments || []).length;
  const totalQuizzes = (DATA.quizzes || []).length;
  const totalAssignmentSubmissions = (DATA.assignmentSubmissions || []).length;
  const totalQuizSubmissions = (DATA.quizSubmissions || []).length;
  const totalChats = (DATA.chats || []).length;
  const totalNotifications = (DATA.notifications || []).length;
  const totalApplications = (DATA.applications || []).length;
  const totalEnrollments = (DATA.enrollments || []).length;
  const totalVideoSessions = (DATA.videoSessions || []).length;
  const totalMaterials = (DATA.materials || []).length;
  const totalIssues = (DATA.issues || []).length;
  const avgScore = ((DATA.students || []).reduce((sum, d) => sum + (d.score || 0), 0) / ((DATA.students || []).length || 1)).toFixed(1);
  const avgAttendance = ((DATA.students || []).reduce((sum, d) => sum + (d.attendance || 0), 0) / ((DATA.students || []).length || 1)).toFixed(1);

  summaryCardsRow.innerHTML = `
    <div class="summary-cards-row" style="display: flex; flex-wrap: wrap; gap: 18px; justify-content: center;">
      <div style="display: flex; flex: 1 1 100%; gap: 18px; justify-content: center; flex-wrap: wrap;">
        <div class="summary-card"><h2>${totalStudents}</h2><span>Students</span></div>
        <div class="summary-card"><h2>${totalTeachers}</h2><span>Teachers</span></div>
        <div class="summary-card"><h2>${totalCourses}</h2><span>Courses</span></div>
        <div class="summary-card"><h2>${totalAssignments}</h2><span>Assignments</span></div>
        <div class="summary-card"><h2>${totalQuizzes}</h2><span>Quizzes</span></div>
        <div class="summary-card"><h2>${totalAssignmentSubmissions}</h2><span>Assignment Submissions</span></div>
        <div class="summary-card"><h2>${totalQuizSubmissions}</h2><span>Quiz Submissions</span></div>
        <div class="summary-card"><h2>${totalChats}</h2><span>Chats</span></div>
      </div>
      <div style="display: flex; flex: 1 1 100%; gap: 18px; justify-content: center; flex-wrap: wrap;">
        <div class="summary-card"><h2>${totalNotifications}</h2><span>Notifications</span></div>
        <div class="summary-card"><h2>${totalApplications}</h2><span>Applications</span></div>
        <div class="summary-card"><h2>${totalEnrollments}</h2><span>Enrollments</span></div>
        <div class="summary-card"><h2>${totalVideoSessions}</h2><span>Video Sessions</span></div>
        <div class="summary-card"><h2>${totalMaterials}</h2><span>Materials</span></div>
        <div class="summary-card"><h2>${totalIssues}</h2><span>Issues</span></div>
        <div class="summary-card"><h2>${avgScore}</h2><span>Avg. Score</span></div>
        <div class="summary-card"><h2>${avgAttendance}%</h2><span>Avg. Attendance</span></div>
      </div>
    </div>
  `;
}

function clearCharts() {
  chartInstances.forEach(chart => chart.destroy && chart.destroy());
  chartInstances = [];
}

function renderCharts(data) {
  clearCharts();
  // Chart 1: Users per Course (students: by enrollments, teachers: by courses)
  const courseCounts = {};
  // Build a map of studentId -> student object for quick lookup
  const studentMap = {};
  data.forEach(d => { if (d.type === 'student' && d.id) studentMap[d.id] = d; });
  // Count students per course based on enrollments
  (DATA.enrollments || []).forEach(enroll => {
    if (studentMap[enroll.studentId]) {
      courseCounts[enroll.courseTitle] = (courseCounts[enroll.courseTitle] || 0) + 1;
    }
  });
  // Count teachers per course based on their 'courses' array
  data.forEach(d => {
    if (d.type === 'teacher' && Array.isArray(d.courses)) {
      d.courses.forEach(c => {
        courseCounts[c] = (courseCounts[c] || 0) + 1;
      });
    }
  });
  chartInstances.push(new Chart(document.getElementById('chart1'), {
    type: 'bar',
    data: {
      labels: Object.keys(courseCounts),
      datasets: [{ label: 'Users', data: Object.values(courseCounts), backgroundColor: '#4e73df' }]
    },
    options: { plugins: { title: { display: true, text: 'Users per Course' } }, responsive: true }
  }));

  // Get filtered student IDs
  const filteredStudentIds = new Set(data.filter(d => d.type === 'student' && d.id).map(d => d.id));

  // Chart 2: Assignment Submissions per Course (filtered)
  const assignmentSubmissionsByCourse = {};
  (DATA.assignmentSubmissions || []).forEach(sub => {
    if (filteredStudentIds.has(sub.studentId)) {
      assignmentSubmissionsByCourse[sub.course] = (assignmentSubmissionsByCourse[sub.course] || 0) + 1;
    }
  });
  chartInstances.push(new Chart(document.getElementById('chart2'), {
    type: 'pie',
    data: {
      labels: Object.keys(assignmentSubmissionsByCourse),
      datasets: [{ label: 'Assignment Submissions', data: Object.values(assignmentSubmissionsByCourse), backgroundColor: ['#e74a3b', '#f6c23e', '#1cc88a', '#36b9cc', '#4e73df'] }]
    },
    options: { plugins: { title: { display: true, text: 'Assignment Submissions by Course' } }, responsive: true }
  }));

  // Chart 3: Quiz Submissions per Course (filtered)
  const quizSubmissionsByCourse = {};
  (DATA.quizSubmissions || []).forEach(sub => {
    if (filteredStudentIds.has(sub.studentId)) {
      quizSubmissionsByCourse[sub.course] = (quizSubmissionsByCourse[sub.course] || 0) + 1;
    }
  });
  chartInstances.push(new Chart(document.getElementById('chart3'), {
    type: 'bar',
    data: {
      labels: Object.keys(quizSubmissionsByCourse),
      datasets: [{ label: 'Quiz Submissions', data: Object.values(quizSubmissionsByCourse), backgroundColor: '#36b9cc' }]
    },
    options: { plugins: { title: { display: true, text: 'Quiz Submissions by Course' } }, responsive: true }
  }));

  // Chart 4: Activity Over Time (filtered)
  const activityByDate = {};
  // User activity
  data.forEach(d => {
    (d.activityLog || []).forEach(dateStr => {
      activityByDate[dateStr] = (activityByDate[dateStr] || 0) + 1;
    });
  });
  // Assignment submissions (filtered)
  (DATA.assignmentSubmissions || []).forEach(sub => {
    if (filteredStudentIds.has(sub.studentId)) {
      const date = sub.submittedAt ? sub.submittedAt.split('T')[0] : null;
      if (date) activityByDate[date] = (activityByDate[date] || 0) + 1;
    }
  });
  // Quiz submissions (filtered)
  (DATA.quizSubmissions || []).forEach(sub => {
    if (filteredStudentIds.has(sub.studentId)) {
      const date = sub.submittedAt ? sub.submittedAt.split('T')[0] : null;
      if (date) activityByDate[date] = (activityByDate[date] || 0) + 1;
    }
  });
  // Issues (filtered by studentName or studentId)
  (DATA.issues || []).forEach(issue => {
    if (
      (issue.studentId && filteredStudentIds.has(issue.studentId)) ||
      (issue.studentName && data.some(d => d.name === issue.studentName))
    ) {
      const date = issue.date;
      if (date) activityByDate[date] = (activityByDate[date] || 0) + 1;
    }
  });
  const sortedDates = Object.keys(activityByDate).sort();
  chartInstances.push(new Chart(document.getElementById('chart4'), {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{ label: 'Activity Count', data: sortedDates.map(d => activityByDate[d]), borderColor: '#4e73df', backgroundColor: 'rgba(78,115,223,0.1)', fill: true }]
    },
    options: { plugins: { title: { display: true, text: 'Activity Over Time' } }, responsive: true }
  }));
}

function renderActivityLog() {
  if (!activityLogTable) return;
  let logs = [];
  // User activity
  (DATA.students || []).forEach(d => {
    (d.activityLog || []).forEach(dateStr => {
      logs.push({
        user: d.name,
        type: 'Student',
        domain: d.domain || '',
        course: '',
        activity: 'Learning',
        date: dateStr
      });
    });
  });
  (DATA.teachers || []).forEach(d => {
    (d.activityLog || []).forEach(dateStr => {
      logs.push({
        user: d.name,
        type: 'Teacher',
        domain: d.domain || '',
        course: '',
        activity: 'Teaching',
        date: dateStr
      });
    });
  });
  // Assignment submissions
  (DATA.assignmentSubmissions || []).forEach(sub => {
    logs.push({
      user: sub.studentName,
      type: 'Student',
      domain: '',
      course: sub.course,
      activity: 'Assignment Submitted',
      date: sub.submittedAt ? sub.submittedAt.split('T')[0] : ''
    });
  });
  // Quiz submissions
  (DATA.quizSubmissions || []).forEach(sub => {
    logs.push({
      user: sub.studentName,
      type: 'Student',
      domain: '',
      course: sub.course,
      activity: 'Quiz Attempted',
      date: sub.submittedAt ? sub.submittedAt.split('T')[0] : ''
    });
  });
  // Chats
  (DATA.chats || []).forEach(chat => {
    logs.push({
      user: chat.participants.join(', '),
      type: 'Chat',
      domain: '',
      course: chat.course,
      activity: 'Chat Created',
      date: chat.createdAt ? chat.createdAt.split('T')[0] : ''
    });
  });
  // Notifications
  (DATA.notifications || []).forEach(note => {
    logs.push({
      user: note.userId,
      type: 'Notification',
      domain: '',
      course: '',
      activity: note.type,
      date: note.timestamp ? note.timestamp.split('T')[0] : ''
    });
  });
  // Issues
  (DATA.issues || []).forEach(issue => {
    logs.push({
      user: issue.studentName || issue.studentId || '',
      type: 'Issue',
      domain: '',
      course: issue.course || '',
      activity: 'Issue Reported',
      date: issue.date || ''
    });
  });
  logs.sort((a, b) => new Date(b.date) - new Date(a.date));
  activityLogTable.innerHTML = logs.slice(0, 10).map(log => `
    <tr>
      <td>${log.user}</td>
      <td>${log.type}</td>
      <td>${log.domain}</td>
      <td>${log.course}</td>
      <td>${log.activity}</td>
      <td>${log.date}</td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-muted">No recent activity found.</td></tr>`;
}

function logoutUser() {
  localStorage.clear();
  sessionStorage.clear();
  alert('You have been logged out.');
  window.location.href = '/HTML/login.html';
}

function renderProfileOrLogin() {
  const container = document.getElementById('profileOrLogin');
  if (!container) return;
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (user) {
    const names = user.name.split(' ');
    const initials = names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}` : names[0][0];
    container.innerHTML = `
      <div class="profile-dropdown">
        <button class="profile-btn">${initials.toUpperCase()}</button>
        <div class="dropdown-content">
          <a href="/HTML/profile.html">View Profile</a>
          <a href="#" onclick="logoutUser()">Logout</a>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = '<button class="btn1">Login</button>';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  if (!checkAdminAccess()) return;
  const darkModeBtn = document.getElementById('darkModeToggle');
  const prefersDark = localStorage.getItem('darkMode') === 'true';
  if (prefersDark) document.body.classList.add('dark-mode');
  if (darkModeBtn) {
    darkModeBtn.onclick = function() {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    };
  }
  renderProfileOrLogin();
  fetchAllData();
}); 