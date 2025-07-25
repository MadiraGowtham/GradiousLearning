// Global variables
let teacherDataCache = null;
let currentUser = null;
let notifications = [];

// API endpoints
const API_BASE = '/api';

// Initialize the teacher dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeTeacherDashboard();
});

async function initializeTeacherDashboard() {
    try {
        // Check if user is logged in and is a teacher
        if (!checkTeacherAccess()) {
            return;
        }
        
        // Setup UI components
        setupUI();
        
        // Load dashboard data
        await loadDashboardData();
        
        // Setup event listeners
        setupEventListeners();
        
        // Render all components
        renderDashboard();
        
        // Load notifications
        await loadNotifications();
        
    } catch (error) {
        console.error('Error initializing teacher dashboard:', error);
        showToast('Failed to load dashboard. Please refresh the page.', 'error');
    }
}

function checkTeacherAccess() {
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
  
  if (!user) {
        showToast('Please log in to access this page.', 'error');
        setTimeout(() => {
            window.location.href = '/HTML/login.html';
        }, 2000);
    return false;
  }
  
    if (user.type !== 'teacher') {
        showToast('This page is only accessible to teachers.', 'error');
        setTimeout(() => {
            if (user.type === 'student') {
                window.location.href = '/HTML/index.html';
            } else if (user.type === 'admin') {
                window.location.href = '/HTML/adminIndex.html';
    } else {
                window.location.href = '/HTML/login.html';
    }
        }, 2000);
    return false;
  }
  
    currentUser = user;
  return true;
}

function setupUI() {
    // Update teacher name
    document.getElementById('teacherName').textContent = currentUser.name;
    
    // Setup profile dropdown
    setupProfileDropdown();
    
    // Setup search functionality
    setupSearch();
}

function setupProfileDropdown() {
    const loginButton = document.getElementById('loginButton');
  if (!loginButton) return;
  
    const names = currentUser.name.split(' ');
    const initials = names.length > 1 
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : names[0][0];
      
    loginButton.outerHTML = `
      <div class="profile-dropdown">
        <button class="profile-btn">${initials.toUpperCase()}</button>
        <div class="dropdown-content">
          <a href="/HTML/profile.html">View Profile</a>
          <a href="#" onclick="logoutUser()">Logout</a>
        </div>
      </div>
    `;
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase();
        
        if (query.length < 2) {
            // Reset to original state
            renderDashboard();
    return;
  }
  
        // Filter courses
        const filteredCourses = teacherDataCache.courses.filter(course => 
            course.toLowerCase().includes(query)
        );
        
        // Filter assignments
        const filteredAssignments = teacherDataCache.assignments.filter(assignment => 
            assignment.name.toLowerCase().includes(query) ||
            assignment.assignment.toLowerCase().includes(query) ||
            assignment.course.toLowerCase().includes(query)
        );
        
        // Update display with filtered results
        renderCourses(filteredCourses);
        renderAssignments(filteredAssignments);
    });
}

async function loadDashboardData() {
    let teacherArr = [], enrollments = [], assignmentSubs = [], courses = [], students = [], teacherDashboard = {}, performanceSummary = [];
    try {
        // Fetch all relevant data in parallel
        const [teacherResponse, enrollmentsResponse, assignmentSubsResponse, coursesResponse, studentsResponse, dashboardResponse] = await Promise.all([
            fetch(`${API_BASE}/teachers?email=${currentUser.email}`),
            fetch(`${API_BASE}/enrollments`),
            fetch(`${API_BASE}/assignmentSubmissions`),
            fetch(`${API_BASE}/courses`),
            fetch(`${API_BASE}/students`),
            fetch(`${API_BASE}/teacherDashboard`)
        ]);
        teacherArr = teacherResponse.ok ? await teacherResponse.json() : [];
        enrollments = enrollmentsResponse.ok ? await enrollmentsResponse.json() : [];
        assignmentSubs = assignmentSubsResponse.ok ? await assignmentSubsResponse.json() : [];
        courses = coursesResponse.ok ? await coursesResponse.json() : [];
        students = studentsResponse.ok ? await studentsResponse.json() : [];
        teacherDashboard = dashboardResponse.ok ? await dashboardResponse.json() : {};
        performanceSummary = teacherDashboard.performanceSummary || [];
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        showToast('Some data could not be loaded. Showing what is available.', 'warning');
    }
    try {
        const teacher = teacherArr[0] || { courses: [], domain: '', students: 0 };
        const teacherCourses = teacher.courses || [];
        // For each course, get stats and assignments
        const courseStats = teacherCourses.map(courseTitle => {
            // Students in this course
            const studentsInCourse = enrollments.filter(e => (e.courseTitle || e.course) === courseTitle).map(e => e.studentId);
            const uniqueStudents = [...new Set(studentsInCourse)];
            // Assignments for this course
            const assignmentsForCourse = assignmentSubs.filter(sub => sub.course === courseTitle);
            // Pending assignments
            const pendingAssignments = assignmentsForCourse.filter(a => a.status !== 'completed' && a.status !== 'graded').length;
            // Avg performance
            const graded = assignmentsForCourse.filter(a => a.status === 'graded' && typeof a.score === 'number');
            const avgPerformance = graded.length > 0 ? Math.round(graded.reduce((sum, a) => sum + a.score, 0) / graded.length) : 0;
            return {
                course: courseTitle,
                students: uniqueStudents.length,
                assignments: assignmentsForCourse,
                pendingAssignments,
                avgPerformance
            };
        });
        // Aggregate for all courses
        const allAssignments = courseStats.flatMap(cs => cs.assignments.map(a => ({...a, course: cs.course})));
        const allStudents = [...new Set(courseStats.flatMap(cs => cs.assignments.map(a => a.studentId)))];
        const totalPending = courseStats.reduce((sum, cs) => sum + cs.pendingAssignments, 0);
        const avgPerformance = courseStats.length > 0 ? Math.round(courseStats.reduce((sum, cs) => sum + cs.avgPerformance, 0) / courseStats.length) : 0;
        teacherDataCache = {
            courses: teacherCourses,
            assignments: allAssignments,
            performance: performanceSummary,
            teacherDomain: teacher.domain,
            students: allStudents.length, // not used for quick stats anymore
            pendingAssignments: totalPending,
            avgPerformance,
            courseStats,
            assignmentSubs,
            studentsList: students,
            coursesList: courses,
            enrollmentsList: enrollments // <-- add this
        };
        renderDashboard();
        console.log('Dashboard data loaded:', teacherDataCache);
    } catch (error) {
        console.error('Error processing dashboard data:', error);
        teacherDataCache = {
            courses: [],
            assignments: [],
            performance: [],
            teacherDomain: '',
            students: 0,
            pendingAssignments: 0,
            avgPerformance: 0,
            courseStats: [],
            assignmentSubs: [],
            studentsList: [],
            coursesList: [],
            enrollmentsList: []
        };
        renderDashboard();
        showToast('Dashboard loaded with no data.', 'warning');
    }
}

function updateQuickStats() {
    let stats = teacherDataCache;
    // Calculate total students based on enrollments in teacher's courses
    const teacherCourses = teacherDataCache.courses;
    const enrollments = teacherDataCache.enrollmentsList || [];
    const enrolledStudents = enrollments.filter(e => teacherCourses.includes(e.courseTitle || e.course));
    const uniqueStudentIds = [...new Set(enrolledStudents.map(e => e.studentId))];
    document.getElementById('totalCourses').textContent = teacherCourses.length;
    document.getElementById('totalStudents').textContent = uniqueStudentIds.length;
    // Calculate pending reviews based on assignments currently shown in Recent Assignments section
    const assignments = assignmentFilterValue
        ? teacherDataCache.assignmentSubs.filter(a => a.course === assignmentFilterValue)
        : teacherDataCache.assignmentSubs;
    // Consider assignments with status not 'completed' and not 'graded' as pending review
    const pending = assignments.filter(a => a.status !== 'completed' && a.status !== 'graded').length;
    document.getElementById('pendingAssignments').textContent = pending;
    document.getElementById('avgPerformance').textContent = `${stats.avgPerformance || 0}%`;
}

function updateQuickStatsFromData(teacherCourses, enrollments, assignmentSubs) {
    // Active Courses
    document.getElementById('totalCourses').textContent = teacherCourses.length;
    // Total Students
    const enrolledStudents = enrollments.filter(e => teacherCourses.includes(e.courseTitle || e.course));
    const uniqueStudentIds = [...new Set(enrolledStudents.map(e => e.studentId))];
    document.getElementById('totalStudents').textContent = uniqueStudentIds.length;
    // Pending Reviews
    const pending = assignmentSubs.filter(a => teacherCourses.includes(a.course) && a.status !== 'completed' && a.status !== 'graded').length;
    document.getElementById('pendingAssignments').textContent = pending;
    // Avg Performance
    const graded = assignmentSubs.filter(a => teacherCourses.includes(a.course) && a.status === 'graded' && typeof a.score === 'number');
    const avg = graded.length > 0 ? Math.round(graded.reduce((sum, a) => sum + a.score, 0) / graded.length) : 0;
    document.getElementById('avgPerformance').textContent = `${avg}%`;
}

function renderDashboard() {
    if (!teacherDataCache) return;
    updateQuickStats();
    // Render all sections
    const courses = teacherDataCache.courses;
    renderCourses(courses);
    renderAssignmentFilter(courses);
    // Assignments section: use renderRecentAssignments
    const assignments = assignmentFilterValue
        ? teacherDataCache.assignmentSubs.filter(a => a.course === assignmentFilterValue)
        : teacherDataCache.assignmentSubs;
    renderRecentAssignments(teacherDataCache.courses, assignments, teacherDataCache.studentsList, teacherDataCache.coursesList);
    renderPerformanceFilter(courses);
    // Performance section: use teacherDashboard.performanceSummary
    const perf = performanceFilterValue
        ? teacherDataCache.performance.filter(p => p.course === performanceFilterValue)
        : teacherDataCache.performance;
    renderPerformance(perf);
}

function renderCourses(courses) {
    const container = document.getElementById('courseContainer');
    container.innerHTML = '';
    
    if (courses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book"></i>
                <h3>No Courses</h3>
                <p>No courses have been assigned yet.</p>
            </div>
        `;
        return;
    }
    
    // Show first 4 courses
  const displayCourses = courses.slice(0, 4);
  
  displayCourses.forEach(course => {
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        courseItem.innerHTML = `
            <div class="course-info">
                <h3>${course}</h3>
                <p>Active Course</p>
            </div>
            <div class="course-actions">
                <button class="course-btn" onclick="viewCourse('${course}')">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        `;
        container.appendChild(courseItem);
    });
    
    // Add "View All" button if there are more courses
  if (courses.length > 4) {
        const viewAllItem = document.createElement('div');
        viewAllItem.className = 'course-item view-all-item';
        viewAllItem.innerHTML = `
            <div class="course-info">
                <h3>View All Courses</h3>
                <p>${courses.length} total courses</p>
            </div>
            <div class="course-actions">
                <button class="course-btn" onclick="viewAllCourses()">
                    <i class="fas fa-arrow-right"></i> View All
                </button>
            </div>
        `;
        container.appendChild(viewAllItem);
    }
}

function renderCoursesSection(teacherCourses, coursesData) {
    const container = document.getElementById('courseContainer');
    container.innerHTML = '';
    if (!teacherCourses.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-book"></i><h3>No Courses</h3><p>No courses have been assigned yet.</p></div>`;
        return;
    }
    const displayCourses = teacherCourses.slice(0, 4);
    displayCourses.forEach(title => {
        const course = coursesData.find(c => c.title === title);
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        courseItem.innerHTML = `
            <div class="course-info">
                <h3>${title}</h3>
                <p>${course ? course.level : 'Active Course'}</p>
            </div>
            <div class="course-actions">
                <button class="course-btn" onclick="viewCourse('${title}')"><i class="fas fa-eye"></i> View</button>
            </div>
        `;
        container.appendChild(courseItem);
    });
    if (teacherCourses.length > 4) {
        const viewAllItem = document.createElement('div');
        viewAllItem.className = 'course-item view-all-item';
        viewAllItem.innerHTML = `
            <div class="course-info"><h3>View All Courses</h3><p>${teacherCourses.length} total courses</p></div>
            <div class="course-actions"><button class="course-btn" onclick="viewAllCourses()"><i class="fas fa-arrow-right"></i> View All</button></div>
        `;
        container.appendChild(viewAllItem);
    }
}

function renderAssignmentFilter(courses) {
    const filter = document.getElementById('assignmentFilter');
    filter.innerHTML = '<option value="">All Courses</option>';
    
  courses.forEach(course => {
        const option = document.createElement('option');
    option.value = course;
    option.textContent = course;
        filter.appendChild(option);
  });
}

// Update renderAssignments to show all assignment submissions for teacher's courses
async function renderAssignments(assignments) {
    const container = document.getElementById('assignmentContainer');
    container.innerHTML = '';
    // No data should be rendered in the review assignments tab
    // (intentionally left blank)
}

function renderRecentAssignments(teacherCourses, assignmentSubs, students, coursesData) {
    const container = document.getElementById('assignmentContainer');
    container.innerHTML = '';
    const filtered = assignmentSubs.filter(a => teacherCourses.includes(a.course));
    if (!filtered.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-file-alt"></i><h3>No Assignment Submissions</h3><p>No assignments have been submitted yet.</p></div>`;
        return;
    }
    // Sort by date descending, show up to 5
    filtered.sort((a, b) => new Date(b.date || b.submittedAt) - new Date(a.date || a.submittedAt));
    filtered.slice(0, 5).forEach(a => {
        const student = students.find(s => s.id === a.studentId) || {};
        const course = coursesData.find(c => c.title === a.course) || {};
        const assignmentItem = document.createElement('div');
        assignmentItem.className = 'assignment-item';
        assignmentItem.innerHTML = `
            <div class="assignment-info">
                <h4>${a.assignment || a.title || 'Assignment'}</h4>
                <p><strong>Student:</strong> ${student.name || a.studentName || a.studentId}</p>
                <p><strong>Course:</strong> ${a.course}</p>
                <p><strong>Submitted:</strong> ${(a.date || a.submittedAt) ? new Date(a.date || a.submittedAt).toLocaleDateString() : ''}</p>
                <span class="assignment-status">${a.status === 'completed' ? 'Completed' : a.status === 'graded' ? 'Graded' : 'Pending Review'}</span>
            </div>
            <div class="assignment-actions">
                <button class="course-btn" onclick="reviewCourse('${a.course}')">Review</button>
                <button class="course-btn mark-reviewed-btn" onclick="markAssignmentReviewed('${a.id}')">Mark as Reviewed</button>
            </div>
        `;
        container.appendChild(assignmentItem);
    });
}

// Consistent with viewCourse, add reviewCourse for review redirection
function reviewCourse(courseName) {
    localStorage.setItem('selectedCourse', courseName);
    window.location.href = '/HTML/teacherCourse.html';
}
window.reviewCourse = reviewCourse;

function renderPerformanceFilter(courses) {
    const filter = document.getElementById('performanceFilter');
    filter.innerHTML = '<option value="">All Courses</option>';
    
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course;
        option.textContent = course;
        filter.appendChild(option);
  });
}

function renderPerformance(performance) {
    const container = document.getElementById('performanceContainer');
    container.innerHTML = '';
  
  if (performance.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-bar"></i>
                <h3>No Performance Data</h3>
                <p>No performance data available yet.</p>
            </div>
        `;
    return;
  }
  
    // Sort by score (highest first)
    const sortedPerformance = performance.sort((a, b) => b.score - a.score);
    
    sortedPerformance.forEach((item, index) => {
        const performanceItem = document.createElement('div');
        performanceItem.className = 'performance-item';
        performanceItem.innerHTML = `
            <div class="performance-rank">${index + 1}</div>
        <div class="performance-info">
                <h4>${item.name}</h4>
                <p>${item.course}</p>
            </div>
            <div class="performance-score">${item.score}%</div>
        `;
        container.appendChild(performanceItem);
    });
}

function renderPerformanceOverview(teacherCourses, assignmentSubs, students) {
    const container = document.getElementById('performanceContainer');
    container.innerHTML = '';
    // Group by course, show avg score per course
    const perf = teacherCourses.map(title => {
        const subs = assignmentSubs.filter(a => a.course === title && a.status === 'graded' && typeof a.score === 'number');
        const avg = subs.length ? Math.round(subs.reduce((sum, a) => sum + a.score, 0) / subs.length) : null;
        return { course: title, avg };
    });
    if (!perf.some(p => p.avg !== null)) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-chart-bar"></i><h3>No Performance Data</h3><p>No performance data available yet.</p></div>`;
        return;
    }
    perf.forEach(p => {
        const perfItem = document.createElement('div');
        perfItem.className = 'performance-item';
        perfItem.innerHTML = `
            <div class="performance-info">
                <h4>${p.course}</h4>
            </div>
            <div class="performance-score">${p.avg !== null ? p.avg + '%' : 'N/A'}</div>
        `;
        container.appendChild(perfItem);
    });
}

async function renderTeacherStats(assignments, assignmentSubmissions) {
    // Fetch enrollments and students
    let enrollments = [];
    let students = [];
    try {
        const [enrollRes, studentRes] = await Promise.all([
            fetch('/api/enrollments'),
            fetch('/api/students')
        ]);
        enrollments = await enrollRes.json();
        students = await studentRes.json();
    } catch (e) {
        // fallback: show error
        document.getElementById('teacherStats').innerHTML = '<div class="empty-state"><h3>Failed to load stats</h3></div>';
        return;
    }
    // Get teacher's courses
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const teacherCourses = (loggedInUser && loggedInUser.courses) || [];
    // Find all enrollments for teacher's courses
    const enrolledStudents = enrollments.filter(e => teacherCourses.includes(e.courseTitle || e.course));
    // Get unique student IDs
    const uniqueStudentIds = [...new Set(enrolledStudents.map(e => e.studentId))];
    // Count
    const totalStudents = uniqueStudentIds.length;
    // Aggregate for all courses
    const allAssignments = assignments.map(a => ({...a, course: a.course}));
    const allStudents = [...new Set(assignments.map(a => a.studentId))];
    const totalPending = assignments.filter(a => a.status !== 'completed' && a.status !== 'graded').length;
    const avgPerformance = assignments.filter(a => a.status === 'graded' && typeof a.score === 'number').length > 0 ? Math.round(assignments.filter(a => a.status === 'graded' && typeof a.score === 'number').reduce((sum, a) => sum + a.score, 0) / assignments.filter(a => a.status === 'graded' && typeof a.score === 'number').length) : 0;
    const courseStats = assignments.map(a => ({
        course: a.course,
        students: [...new Set(assignmentSubmissions.filter(sub => sub.assignmentId === a.id).map(sub => sub.studentId))].length,
        assignments: [a],
        pendingAssignments: assignmentSubmissions.filter(sub => sub.assignmentId === a.id && sub.status !== 'completed' && sub.status !== 'graded').length,
        avgPerformance: assignmentSubmissions.filter(sub => sub.assignmentId === a.id && sub.status === 'graded' && typeof sub.score === 'number').length > 0 ? Math.round(assignmentSubmissions.filter(sub => sub.assignmentId === a.id && sub.status === 'graded' && typeof sub.score === 'number').reduce((sum, sub) => sum + sub.score, 0) / assignmentSubmissions.filter(sub => sub.assignmentId === a.id && sub.status === 'graded' && typeof sub.score === 'number').length) : 0
    }));

    // Update the stats UI (assuming you have an element with id 'totalStudentsStat')
    const totalStudentsStat = document.getElementById('totalStudentsStat');
    if (totalStudentsStat) {
        totalStudentsStat.textContent = totalStudents;
    }
}

async function updateTotalStudentsStat() {
    // Fetch enrollments
    let enrollments = [];
    try {
        const enrollRes = await fetch('/api/enrollments');
        enrollments = await enrollRes.json();
    } catch (e) {
        const stat = document.getElementById('totalStudentsStat');
        if (stat) stat.textContent = '0';
        return;
    }
    // Get teacher's courses
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const teacherCourses = (loggedInUser && loggedInUser.courses) || [];
    // Find all enrollments for teacher's courses
    const enrolledStudents = enrollments.filter(e => teacherCourses.includes(e.courseTitle || e.course));
    // Get unique student IDs
    const uniqueStudentIds = [...new Set(enrolledStudents.map(e => e.studentId))];
    // Update the stat
    const stat = document.getElementById('totalStudentsStat');
    if (stat) stat.textContent = uniqueStudentIds.length;
}
// Call this on page load
updateTotalStudentsStat();

async function loadNotifications() {
    try {
        // Mock notifications - in real app, this would come from API
        notifications = [
            {
                id: 1,
                title: 'New Assignment Submission',
                message: 'John Doe submitted Assignment 3 for review',
                time: '2 hours ago',
                read: false,
                type: 'assignment'
            },
            {
                id: 2,
                title: 'Course Update',
                message: 'New content added to Machine Learning course',
                time: '4 hours ago',
                read: false,
                type: 'course'
            },
            {
                id: 3,
                title: 'Student Enrolled',
                message: 'Sarah Wilson enrolled in Data Science course',
                time: '6 hours ago',
                read: true,
                type: 'student'
            }
        ];
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}



// Utility Functions
function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function viewCourse(courseName) {
    // Store the selected course in localStorage for teacherCourse.html
    localStorage.setItem('selectedCourse', courseName);
    // Navigate to teacher course page
    window.location.href = '/HTML/teacherCourse.html';
}

function viewAllCourses() {
    // Navigate to mycourses page
    window.location.href = '/HTML/mycourses.html';
}

function reviewAssignment(studentName, assignmentName) {
    // Find the assignment data from the cache
    const assignment = teacherDataCache.assignments.find(a => 
        a.name === studentName && a.assignment === assignmentName
    );
    
    if (!assignment) {
        showToast('Assignment data not found', 'error');
        return;
    }
    
    // Store assignment data for the assignment page
    const assignmentData = {
        id: assignment.id || Math.random().toString(36).substr(2, 9),
        title: assignment.assignment,
        course: assignment.course,
        studentName: assignment.name,
        studentId: assignment.studentId || 'STD' + Math.random().toString(36).substr(2, 6),
        submittedDate: assignment.date,
        userType: 'teacher',
        status: 'pending'
    };
    
    localStorage.setItem('currentAssignment', JSON.stringify(assignmentData));
    
    // Redirect to assignment page with teacher role
    window.location.href = '/HTML/assignment.html?role=teacher&assignmentId=' + assignmentData.id;
}

function submitReview(studentName, assignmentName) {
    const score = document.getElementById('assignmentScore').value;
    const feedback = document.getElementById('assignmentFeedback').value;
    
    if (!score) {
        showToast('Please enter a score', 'error');
        return;
    }
    
    showToast(`Review submitted for ${studentName}'s ${assignmentName}`, 'success');
    closeModal();
    
    // Refresh assignments list
    renderAssignments(teacherDataCache.assignments);
}

// Global logout function
function logoutUser() {
    localStorage.clear();
    sessionStorage.clear();
    showToast('You have been logged out successfully.', 'success');
    setTimeout(() => {
        window.location.href = '/HTML/login.html';
    }, 1500);
}

// Export functions for global access
window.viewCourse = viewCourse;
window.viewAllCourses = viewAllCourses;
window.reviewAssignment = reviewAssignment;
window.submitReview = submitReview;
window.closeModal = closeModal;
window.logoutUser = logoutUser;

// Add a global function to view the submitted PDF
window.reviewAssignmentPDF = function(fileName) {
    if (!fileName) return alert('No file uploaded.');
    // For demo, just open a blank PDF or show file name
    const fakeUrl = fileName.endsWith('.pdf') ? 'about:blank' : '';
    if (fakeUrl) {
        window.open(fakeUrl, '_blank');
    } else {
        alert(`File: ${fileName}\n(No preview available)`);
    }
};

// Add global filter state for independent filtering
let assignmentFilterValue = '';
let performanceFilterValue = '';

// Add event listeners for assignment and performance filters
function setupEventListeners() {
    const assignmentFilter = document.getElementById('assignmentFilter');
    if (assignmentFilter) {
        assignmentFilter.addEventListener('change', function(e) {
            assignmentFilterValue = e.target.value;
            // Only update assignments section
            const assignments = assignmentFilterValue
                ? teacherDataCache.assignmentSubs.filter(a => a.course === assignmentFilterValue)
                : teacherDataCache.assignmentSubs;
            renderRecentAssignments(teacherDataCache.courses, assignments, teacherDataCache.studentsList, teacherDataCache.coursesList);
            updateQuickStats(); // Update quick stats for pending reviews
        });
    }
    const performanceFilter = document.getElementById('performanceFilter');
    if (performanceFilter) {
        performanceFilter.addEventListener('change', function(e) {
            performanceFilterValue = e.target.value;
            // Only update performance section
            const perf = performanceFilterValue
                ? teacherDataCache.performance.filter(p => p.course === performanceFilterValue)
                : teacherDataCache.performance;
            renderPerformance(perf);
        });
    }
}

// Add global handler to mark assignment as reviewed and remove from db.json
window.markAssignmentReviewed = async function(assignmentId) {
    try {
        // Remove from backend
        const res = await fetch(`${API_BASE}/assignmentSubmissions/${assignmentId}`, { method: 'DELETE' });
        if (res.ok) {
            // Remove from UI by reloading dashboard data
            showToast('Assignment marked as reviewed and removed.', 'success');
            await loadDashboardData();
        } else {
            showToast('Failed to remove assignment from backend.', 'error');
        }
    } catch (err) {
        showToast('Error removing assignment: ' + err, 'error');
    }
}