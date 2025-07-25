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

// Fetch and render admin dashboard data dynamically
const API_URL = '/api/adminDashboard';

// DOM Elements
const pieChartContainer = document.getElementById('myPieChart');
const barChartContainer = document.getElementById('updateChart');
const issuesContainer = document.getElementById('issuesList');

// Loading indicators
const pieChartLoading = document.getElementById('pieChartLoading');
const barChartLoading = document.getElementById('barChartLoading');
const issuesLoading = document.getElementById('issuesLoading');

function showLoading(el) {
  if (el) el.style.display = 'block';
}
function hideLoading(el) {
  if (el) el.style.display = 'none';
}

async function fetchDashboardData() {
  showLoading(pieChartLoading);
  showLoading(barChartLoading);
  showLoading(issuesLoading);

  try {
    // Fetch all resources in parallel
    const [
      studentsRes, assignmentsRes, quizzesRes, videoSessionsRes, issuesRes, assignmentSubsRes, quizSubsRes, teachersRes, coursesRes
    ] = await Promise.all([
      fetch('/api/students'),
      fetch('/api/assignments'),
      fetch('/api/quizzes'),
      fetch('/api/videoSessions'),
      fetch('/api/issues'),
      fetch('/api/assignmentSubmissions'),
      fetch('/api/quizSubmissions'),
      fetch('/api/teachers'),
      fetch('/api/courses')
    ]);
    const [students, assignments, quizzes, videoSessions, issues, assignmentSubs, quizSubs, teachers, courses, enrollmentsRes] = await Promise.all([
      studentsRes.json(), assignmentsRes.json(), quizzesRes.json(), videoSessionsRes.json(), issuesRes.json(), assignmentSubsRes.json(), quizSubsRes.json(), teachersRes.json(), coursesRes.json(), fetch('/api/enrollments').then(r => r.json())
    ]);

    // Student Distribution (by course, using enrollments)
    const studentDistribution = {};
    enrollmentsRes.forEach(e => {
      if (e.status === 'active') {
        if (!studentDistribution[e.courseTitle]) studentDistribution[e.courseTitle] = 0;
        studentDistribution[e.courseTitle]++;
      }
    });

    // All-time Activity (totals)
    const allTimeActivity = {
      "Total Assignments": assignments.length,
      "Total Videos": videoSessions.length,
      "Total Quizzes": quizzes.length,
      "Total Issues": issues.length,
      "Total Students": students.length,
      "Total Teachers": teachers.length,
      "Total Courses": courses.length
    };

    // Issues (from issues resource)
    // Already fetched as 'issues'

    return {
      studentDistribution,
      allTimeActivity,
      issues
    };
  } catch (err) {
    if (pieChartLoading) pieChartLoading.textContent = 'Error loading chart.';
    if (barChartLoading) barChartLoading.textContent = 'Error loading activity.';
    if (issuesLoading) issuesLoading.textContent = 'Error loading issues.';
    throw err;
  }
}

function renderStudentDistBarChart(studentDistribution) {
  hideLoading(pieChartLoading);
  const ctx = document.getElementById('studentDistBarChart').getContext('2d');
  // Destroy previous chart if exists
  if (window.studentDistBarChartInstance) window.studentDistBarChartInstance.destroy();
  window.studentDistBarChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(studentDistribution),
      datasets: [{
        label: 'Enrolled Students',
        data: Object.values(studentDistribution),
        backgroundColor: [
          '#1025a1', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#6f42c1', '#fd7e14', '#20c997', '#17a2b8', '#6610f2'
        ],
        borderRadius: 8,
        maxBarThickness: 32
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Student Distribution by Course',
          font: { size: 20, weight: 'bold' }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.parsed.x} students`;
            }
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'right',
          color: '#1025a1',
          font: { weight: 'bold', size: 14 },
          formatter: function(value) { return value; }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#333', font: { size: 14 } },
          grid: { color: '#e9ecef' }
        },
        y: {
          ticks: { color: '#1025a1', font: { size: 15, weight: 'bold' } },
          grid: { display: false }
        }
      }
    },
    plugins: [window.ChartDataLabels || {}]
  });
}

// Update renderBarChart to use allTimeActivity instead of todaysActivity
function renderBarChart(allTimeActivity) {
  hideLoading(barChartLoading);
  const ctx = barChartContainer.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(allTimeActivity),
      datasets: [{
        label: 'Count',
        data: Object.values(allTimeActivity),
        backgroundColor: '#36b9cc'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Platform Totals (All Time)'
        }
      }
    }
  });
}

// Utility for focus management
function focusFirstInput(form) {
  const input = form.querySelector('input, textarea');
  if (input) input.focus();
}

// --- Issues Search & Actions ---
const issueSearch = document.getElementById('issueSearch');
let allIssues = [];
function renderIssues(issues) {
  hideLoading(issuesLoading);
  issuesContainer.innerHTML = '';
  issues.forEach((issue) => {
    const div = document.createElement('div');
    div.className = 'issueContainer' + (issue.status === 'resolved' ? ' resolved' : '');
    div.tabIndex = 0;
    div.innerHTML = `
      <div class="name">
        <p class="diff"><b>StudentID:</b> ${issue.studentId}</p>
        <p class="diff"><b>Course:</b> ${issue.course}</p>
        <p><b>Date of Issue :</b> ${issue.date}</p>
      </div>
      <p>${issue.description}</p>
      <div class="issue-actions">
        ${issue.status === 'resolved' ? '' : `<button class="issue-action-btn" aria-label="Resolve Issue" data-id="${issue.id}">Resolve</button>`}
        <button class="issue-action-btn" aria-label="Delete Issue" data-id="${issue.id}">Delete</button>
      </div>
    `;
    // Action handlers
    div.querySelectorAll('.issue-action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = btn.textContent.trim();
        const issueId = btn.getAttribute('data-id');
        if (action === 'Resolve') {
          // Mark as resolved in db.json (PATCH)
          try {
            await fetch(`/api/issues/${issueId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'resolved' })
            });
            allIssues = allIssues.map(issue => issue.id == issueId ? { ...issue, status: 'resolved' } : issue);
            renderIssues(allIssues);
            showNotification('Issue resolved!', 'success');
          } catch (err) {
            showNotification('Failed to resolve issue in database.', 'error');
          }
        } else if (action === 'Delete') {
          // Remove from db.json via DELETE
          try {
            await fetch(`/api/issues/${issueId}`, { method: 'DELETE' });
            allIssues = allIssues.filter(issue => issue.id != issueId);
            renderIssues(allIssues);
            showNotification('Issue deleted!', 'success');
          } catch (err) {
            showNotification('Failed to delete issue in database.', 'error');
          }
        }
      });
    });
    issuesContainer.appendChild(div);
  });
}
if (issueSearch) {
  issueSearch.addEventListener('input', () => {
    const q = issueSearch.value.trim().toLowerCase();
    renderIssues(allIssues.filter(issue =>
      issue.description.toLowerCase().includes(q) ||
      issue.studentId.toLowerCase().includes(q) ||
      issue.course.toLowerCase().includes(q)
    ));
  });
}

// --- Dashboard Search (global) ---
const dashboardSearch = document.getElementById('dashboardSearch');
if (dashboardSearch) {
  dashboardSearch.addEventListener('input', () => {
    const q = dashboardSearch.value.trim().toLowerCase();
    // Filter only issues
    renderIssues(allIssues.filter(issue =>
      issue.description.toLowerCase().includes(q) ||
      issue.studentId.toLowerCase().includes(q) ||
      issue.course.toLowerCase().includes(q)
    ));
  });
}

// --- Accessibility: Keyboard navigation for Add Feedback ---
// Remove feedbacks-related keyboard navigation

// --- Render admin name ---
const adminNameSpan = document.getElementById('adminName');
if (adminNameSpan) {
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (user && user.name) adminNameSpan.textContent = user.name;
}

// --- Main dashboard rendering ---
async function renderDashboard() {
  try {
    const data = await fetchDashboardData();
    allIssues = Array.isArray(data.issues) ? [...data.issues] : [];
    renderStudentDistBarChart(data.studentDistribution);
    renderBarChart(data.allTimeActivity);
    renderIssues(allIssues);
  } catch (err) {
    // Error already shown in loading indicators
  }
}

// Profile/Login button logic for header
function renderProfileOrLogin() {
  const container = document.getElementById('profileOrLogin');
  if (!container) return;
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (user) {
    // Get initials from first and last name
    const names = user.name.split(' ');
    const initials = names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}` : names[0][0];
    container.innerHTML = `
      <div class="profile-dropdown">
        <button class="profile-btn">${initials.toUpperCase()}</button>
        <div class="dropdown-menu">
          <a href="/HTML/profile.html">Go to Profile</a>
          <a href="#" id="logout-link">Logout</a>
        </div>
      </div>
    `;
    document.getElementById('logout-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.clear();
      sessionStorage.clear();
      alert('You have been logged out.');
      window.location.href = '/HTML/login.html';
    });
  } else {
    container.innerHTML = '<button class="btn1">Login</button>';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Check access first
  if (!checkAdminAccess()) {
    return;
  }
  
  // Continue with page initialization
  renderProfileOrLogin();
  renderDashboard();
}); 