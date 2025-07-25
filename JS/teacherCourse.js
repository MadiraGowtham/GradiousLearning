// ========================================
// TEACHER COURSE PAGE - FULLY DYNAMIC & MODERN (IMPROVED)
// ========================================

const API_BASE_URL = '/api';
let teacherCurrentCourse = null;
let teacherCourseDetails = null;
let teacherAllQuizzes = [];
let teacherAssignmentsResource = [];
let allQuizSubmissions = [];
let allAssignmentSubmissions = [];
let teacherLoggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
let quizFilterStatus = '';

// --- Loading/Error Overlay Helpers ---
function showLoading(show = true) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}
function showErrorOverlay(msg = 'Something went wrong. Please try again.', type = 'error') {
  const overlay = document.getElementById('errorOverlay');
  const msgEl = document.getElementById('errorOverlayMsg');
  const titleEl = document.getElementById('errorOverlayTitle');
  const iconEl = document.getElementById('popupIcon');
  const stateEl = document.getElementById('errorState');
  if (msgEl) msgEl.textContent = msg;
  if (titleEl) titleEl.textContent = type === 'success' ? 'Success' : 'Error';
  if (iconEl) iconEl.innerHTML = type === 'success' ? '&#10003;' : '&#9888;';
  if (stateEl) {
    stateEl.classList.remove('success');
    if (type === 'success') stateEl.classList.add('success');
  }
  if (overlay) overlay.style.display = 'flex';
  setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 2800);
}

// --- Profile Dropdown ---
function setupProfileDropdown() {
  const nav = document.querySelector('nav');
  const profileBtn = nav?.querySelector('.btn1#loginButton');
  if (teacherLoggedInUser && profileBtn) {
    const names = teacherLoggedInUser.name.split(' ');
    const initials = names.length > 1 
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : names[0][0];
    const dropdown = document.createElement('div');
    dropdown.className = 'profile-dropdown';
    dropdown.innerHTML = `
      <button class="btn1 profile-btn">${initials.toUpperCase()}</button>
        <div class="dropdown-content">
          <a href="/HTML/profile.html">View Profile</a>
          <a href="#" onclick="logoutUser()">Logout</a>
      </div>
    `;
    profileBtn.replaceWith(dropdown);
    const profileBtnNew = dropdown.querySelector('.profile-btn');
    const dropdownContent = dropdown.querySelector('.dropdown-content');
    profileBtnNew.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', function(e) {
      if (!dropdown.contains(e.target)) {
        dropdownContent.style.display = 'none';
      }
    });
  }
}

window.logoutUser = function() {
  localStorage.clear();
  sessionStorage.clear();
  alert('You have been logged out.');
  window.location.href = '/HTML/login.html';
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
  initializeTeacherCoursePage();
});

async function initializeTeacherCoursePage() {
  try {
    showLoading(true);
    if (!teacherLoggedInUser || teacherLoggedInUser.type !== 'teacher') {
      alert('Please log in as a teacher to access this page.');
      window.location.href = '/HTML/login.html';
      return;
    }
    // Get selected course from localStorage
    const selectedCourse = localStorage.getItem('selectedCourse');
    if (!selectedCourse) {
      alert('No course selected.');
      window.location.href = '/HTML/mycourses.html';
      return;
    }
    // Fetch course data by title
    const coursesRes = await fetch(`${API_BASE_URL}/courses`);
    const coursesArr = await coursesRes.json();
    teacherCurrentCourse = coursesArr.find(c => c.title === selectedCourse);
    if (!teacherCurrentCourse) {
      alert('Course not found.');
      window.location.href = '/HTML/mycourses.html';
        return;
    }
    await loadTeacherCourseData();
    updateTeacherCourseDisplay();
    renderTeacherAllSections();
    setupTeacherEventListeners();
    setupProfileDropdown();
    showLoading(false);
  } catch (error) {
    showLoading(false);
    showErrorOverlay('Failed to load course. Please refresh and try again.');
    console.error('Error initializing teacher course page:', error);
  }
}

async function loadTeacherCourseData() {
  // Fetch all quizzes
  const quizzesRes = await fetch(`${API_BASE_URL}/quizzes`);
  teacherAllQuizzes = quizzesRes.ok ? await quizzesRes.json() : [];
  // Fetch assignments
  const assignmentsRes = await fetch(`${API_BASE_URL}/assignments`);
  teacherAssignmentsResource = assignmentsRes.ok ? await assignmentsRes.json() : [];
  // Fetch quiz submissions
  const submissionsRes = await fetch(`${API_BASE_URL}/quizSubmissions`);
  allQuizSubmissions = submissionsRes.ok ? await submissionsRes.json() : [];
  // Fetch assignment submissions
  const assignmentSubmissionsRes = await fetch(`${API_BASE_URL}/assignmentSubmissions`);
  allAssignmentSubmissions = assignmentSubmissionsRes.ok ? await assignmentSubmissionsRes.json() : [];
  // Fetch videoSessions and materials
  const videoSessionsRes = await fetch(`${API_BASE_URL}/videoSessions`);
  const allVideoSessions = videoSessionsRes.ok ? await videoSessionsRes.json() : [];
  const materialsRes = await fetch(`${API_BASE_URL}/materials`);
  const allMaterials = materialsRes.ok ? await materialsRes.json() : [];
  // Fetch courseDetails from db.json
  const dbRes = await fetch(`${API_BASE_URL}/db.json`);
  const dbData = dbRes.ok ? await dbRes.json() : {};
  const courseDetailsData = dbData.courseDetails || {};
  if (courseDetailsData[teacherCurrentCourse.title]) {
    teacherCourseDetails = courseDetailsData[teacherCurrentCourse.title];
        } else {
    // Try partial match
    const courseKeys = Object.keys(courseDetailsData);
    const matchingKey = courseKeys.find(key =>
      key.toLowerCase().includes(teacherCurrentCourse.title.toLowerCase()) ||
      teacherCurrentCourse.title.toLowerCase().includes(key.toLowerCase())
    );
    if (matchingKey) {
      teacherCourseDetails = courseDetailsData[matchingKey];
    } else {
      teacherCourseDetails = {
        title: teacherCurrentCourse.title,
        description: teacherCurrentCourse.description,
        coordinator: teacherCurrentCourse.coordinator,
        image: teacherCurrentCourse.img || teacherCurrentCourse.image,
        quiz: [],
        sessions: [],
        resources: [],
        assignments: []
      };
    }
  }
  // Filter quizzes for this course
  teacherCourseDetails.quiz = teacherAllQuizzes.filter(quiz => quiz.course && quiz.course.trim() === teacherCurrentCourse.title.trim());
  // Use global videoSessions and materials if not present in courseDetails
  teacherCourseDetails.sessions = (teacherCourseDetails.sessions && teacherCourseDetails.sessions.length > 0)
    ? teacherCourseDetails.sessions
    : allVideoSessions.filter(v => !v.course || v.course === teacherCurrentCourse.title);
  teacherCourseDetails.resources = (teacherCourseDetails.resources && teacherCourseDetails.resources.length > 0)
    ? teacherCourseDetails.resources
    : allMaterials.filter(m => !m.course || m.course === teacherCurrentCourse.title);
  // Assignments will be handled from assignmentsResource
}

function updateTeacherCourseDisplay() {
  if (!teacherCurrentCourse || !teacherCourseDetails) return;
  document.title = `${teacherCourseDetails.title || teacherCurrentCourse.title} - LearnEdge LMS (Teacher)`;
  const titleElement = document.getElementById('dynamic-course-title');
  if (titleElement) titleElement.textContent = teacherCourseDetails.title || teacherCurrentCourse.title;
  const descElement = document.getElementById('dynamic-course-desc');
  if (descElement) descElement.textContent = teacherCourseDetails.description || teacherCurrentCourse.description || 'Course description will be available soon.';
  const durationElement = document.getElementById('dynamic-course-duration');
  if (durationElement) durationElement.textContent = `Duration: ${teacherCourseDetails.duration || teacherCurrentCourse.duration || 'TBD'}`;
  const imageElement = document.getElementById('dynamic-course-img');
  if (imageElement) {
    imageElement.src = teacherCourseDetails.image || teacherCurrentCourse.img || teacherCurrentCourse.image || '../images/Consultant.jpeg';
    imageElement.alt = teacherCourseDetails.title || teacherCurrentCourse.title;
    imageElement.onerror = function() { this.src = '../images/Consultant.jpeg'; };
  }
}

function renderTeacherAllSections() {
  renderTeacherQuizSection();
  renderTeacherSessionsSection();
  renderTeacherResourcesSection();
  renderTeacherAssignmentsSection();
  setupQuizSearch();
  setupAssignmentSearch();
}

// --- QUIZ SECTION ---
function renderTeacherQuizSection() {
    const quizStats = document.getElementById('quizStats');
    const quizContainer = document.getElementById('quizContainer');
    let quizzes = teacherCourseDetails.quiz || [];
    // Filter by search/filter
    if (quizFilterStatus) {
      quizzes = quizzes.filter(q => {
        if (quizFilterStatus === 'pending') return !q.completed && !q.overdue;
        if (quizFilterStatus === 'completed') return q.completed;
        if (quizFilterStatus === 'overdue') return q.overdue;
        return true;
      });
    }
    // Calculate average score from submissions
    const courseQuizIds = quizzes.map(q => q.id);
    const relevantSubmissions = (allQuizSubmissions || []).filter(sub => courseQuizIds.includes(sub.quizId));
    const totalScore = relevantSubmissions.reduce((acc, sub) => acc + (sub.score || 0), 0);
    const avgScore = relevantSubmissions.length > 0 ? Math.round(totalScore / relevantSubmissions.length) : 0;
    // Stats
    quizStats.innerHTML = `
        <div class="stat-card"><i class="fas fa-clipboard-list"></i><div class="stat-info"><span class="stat-number">${quizzes.length}</span><span class="stat-label">Total Quizzes</span></div></div>
        <div class="stat-card"><i class="fas fa-star"></i><div class="stat-info"><span class="stat-number">${avgScore}</span><span class="stat-label">Avg Score</span></div></div>
    `;
    quizContainer.innerHTML = quizzes.length === 0 ? '<div class="empty-state">No quizzes available.</div>' :
        quizzes.map((quiz, idx) => `
            <div class="quiz-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 24px; display: flex; flex-direction: column; gap: 12px; border: 1.5px solid #e0e0e0;">
                <div style="display: flex; flex-direction: row; align-items: center; gap: 18px;">
                    <img src="${quiz.image || '../images/quiz.jpeg'}" alt="Quiz Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/quiz.jpeg'">
                    <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 1.2rem; font-weight: 600; color: #1025a1;">${quiz.title}</div>
                        <div style="font-size: 0.95rem; color: #555;">${quiz.description || ''}</div>
                        <div style="font-size: 0.9rem; color: #888;">Due: ${quiz.due || quiz.dueDate || ''}</div>
                    </div>
                </div>
                <div class="quiz-actions" style="display: flex; gap: 10px; margin-top: 8px;">
                    <button class="btn btn-primary" onclick="openQuizEditModal(${idx})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteQuiz(${idx})">Delete</button>
                </div>
            </div>
        `).join('');
}

function setupQuizSearch() {
  const quizSearch = document.getElementById('quizSearch');
  if (quizSearch) {
    // Add clear button if not present
    if (!document.getElementById('quizSearchClear')) {
      const clearBtn = document.createElement('button');
      clearBtn.id = 'quizSearchClear';
      clearBtn.type = 'button';
      clearBtn.innerHTML = '<i class="fas fa-times"></i>';
      clearBtn.className = 'btn btn2';
      clearBtn.style.marginLeft = '6px';
      quizSearch.parentNode.appendChild(clearBtn);
      clearBtn.onclick = () => {
        quizSearch.value = '';
        filterQuizCards('');
      };
    }
    quizSearch.addEventListener('input', function(e) {
      filterQuizCards(e.target.value);
    });
  }
}

// --- SESSIONS SECTION ---
function renderTeacherSessionsSection() {
  const sessionContainer = document.getElementById('sessionContainer');
  const sessions = teacherCourseDetails.sessions || [];
  sessionContainer.innerHTML = sessions.length === 0 ? '<div class="empty-state">No video sessions available.</div>' :
    sessions.map((session, idx) => `
      <div class="session-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
        <img src="${session.image || '../images/videoSessions.jpeg'}" alt="Session Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/videoSessions.jpeg'">
        <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${session.title || 'Untitled Session'}</div>
          <div style="font-size: 0.95rem; color: #555;">${session.description || ''}</div>
        </div>
        <button class="btn btn-primary" onclick="showTeacherModal('sessions','edit',${encodeURIComponent(JSON.stringify(session))},${idx})">Edit</button>
        <button class="btn btn-danger" onclick="deleteSession(${idx})">Delete</button>
      </div>
    `).join('');
}

// --- RESOURCES SECTION ---
function renderTeacherResourcesSection() {
  const resourceContainer = document.getElementById('resourceContainer');
  const resources = teacherCourseDetails.resources || [];
  resourceContainer.innerHTML = resources.length === 0 ? '<div class="empty-state">No resources available.</div>' :
    resources.map((resource, idx) => `
      <div class="resource-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
        <img src="${resource.image || '../images/materials.jpeg'}" alt="Resource Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/materials.jpeg'">
        <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${resource.title || 'Untitled Resource'}</div>
          <div style="font-size: 0.95rem; color: #555;">${resource.description || ''}</div>
        </div>
        <button class="btn btn-primary" onclick="showTeacherModal('resources','edit',${encodeURIComponent(JSON.stringify(resource))},${idx})">Edit</button>
        <button class="btn btn-danger" onclick="deleteResource(${idx})">Delete</button>
      </div>
    `).join('');
}

// --- ASSIGNMENTS SECTION ---
function renderTeacherAssignmentsSection() {
  const assignmentStats = document.getElementById('assignmentStats');
  const assignmentContainer = document.getElementById('assignmentContainer');
  const assignments = teacherAssignmentsResource.filter(a => a.course === teacherCurrentCourse.title);
  // Calculate average score
  const scoredSubmissions = (allAssignmentSubmissions || []).filter(sub => courseAssignmentIds.includes(sub.assignmentId));
  const totalScore = scoredSubmissions.reduce((acc, sub) => acc + (sub.score || 0), 0);
  const avgScore = scoredSubmissions.length > 0 ? Math.round(totalScore / scoredSubmissions.length) : 0;
  // Stats
  assignmentStats.innerHTML = `
    <div class="stat-card"><i class="fas fa-clipboard-list"></i><div class="stat-info"><span class="stat-number">${assignments.length}</span><span class="stat-label">Total Assignments</span></div></div>
    <div class="stat-card"><i class="fas fa-star"></i><div class="stat-info"><span class="stat-number">${avgScore}</span><span class="stat-label">Avg Score</span></div></div>
  `;
  assignmentContainer.innerHTML = assignments.length === 0 ? '<div class="empty-state">No assignments available.</div>' :
    assignments.map((assignment, idx) => `
      <div class="assignment-card">
        <div class="assignment-header-card" style="display:flex;align-items:center;gap:10px;">
          <h3 class="assignment-title" style="margin:0;flex:1;text-align:left;">${assignment.assignment || assignment.title || 'Untitled Assignment'}</h3>
          <span class="assignment-status" style="margin-left:auto; color: #1025a1; font-weight: 600;">${assignment.status || 'Pending'}</span>
        </div>
        <div class="assignment-course">
          <i class="fas fa-book"></i> ${assignment.course}
        </div>
        <div class="assignment-details">
          <div class="assignment-detail"><strong>Due Date:</strong> <span>${assignment.date || assignment.dueDate || 'TBD'}</span></div>
        </div>
        <div class="assignment-actions">
          <button class="btn btn-primary" onclick='window._editAssignment(${idx})'>Edit</button>
          <button class="btn btn-danger" onclick="deleteAssignment(${assignment.id})">Delete</button>
          <button class="btn btn2" onclick="window.reviewAssignment(${assignment.id})">Review</button>
        </div>
      </div>
    `).join('');
}

function setupAssignmentSearch() {
  const assignmentSearch = document.getElementById('assignmentSearch');
  if (assignmentSearch) {
    // Add clear button if not present
    if (!document.getElementById('assignmentSearchClear')) {
      const clearBtn = document.createElement('button');
      clearBtn.id = 'assignmentSearchClear';
      clearBtn.type = 'button';
      clearBtn.innerHTML = '<i class="fas fa-times"></i>';
      clearBtn.className = 'btn btn2';
      clearBtn.style.marginLeft = '6px';
      assignmentSearch.parentNode.appendChild(clearBtn);
      clearBtn.onclick = () => {
        assignmentSearch.value = '';
        filterAssignmentCards('');
      };
    }
    assignmentSearch.addEventListener('input', function(e) {
      filterAssignmentCards(e.target.value);
    });
  }
}

// --- CRUD MODALS (REUSE EXISTING LOGIC) ---
// (Keep your existing showTeacherModal, handleQuizCrudSubmit, handleAssignmentCrudSubmit, handleResourceCrudSubmit, handleSessionCrudSubmit, deleteQuiz, deleteAssignment, deleteResource, deleteSession, updateCourseDetailsBackend, closeModal, etc. as in your current modern code)

function showTeacherModal(section, mode, item = {}, idx = null) {
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  modal.classList.remove("hidden");

  let formHtml = '';
  
  if (mode === 'upload' || mode === 'edit') {
    formHtml = `
      <form id="crudForm">
        <label>Title:<input type="text" name="title" value="${item.title || ''}" required></label><br>
        ${section === 'quiz' || section === 'assignments' ? '<label>Due Date:<input type="text" name="due" value="' + (item.due || '') + '"></label><br>' : ''}
        ${section === 'quiz' ? '<label>Quiz Link:<input type="text" name="quizLink" value="' + (item.quizLink || '') + '"></label><br>' : ''}
        ${section === 'assignments' ? '<label>Instructions:<input type="text" name="instructions" value="' + (item.instructions || '') + '"></label><br>' : ''}
        ${section === 'resources' ? '<label>PDF Link:<input type="text" name="pdf" value="' + (item.pdf || '') + '"></label><br>' : ''}
        ${section === 'sessions' ? '<label>Video Link:<input type="text" name="video" value="' + (item.video || '') + '"></label><br>' : ''}
        <small style="color: #666; font-style: italic;">Default image will be automatically set for ${section} section.</small><br>
        <button type="submit">${mode === 'edit' ? 'Update' : 'Create'}</button>
      </form>
    `;
  } else if (mode === 'manage') {
    formHtml = `<p>Use the Upload button to add new items, or Edit/Delete existing ones below.</p>`;
  }
  
  modalTitle.innerText = `${mode === 'manage' ? 'Manage' : mode === 'upload' ? 'Create New' : 'Edit'} ${section.charAt(0).toUpperCase() + section.slice(1)}`;
  modalBody.innerHTML = formHtml;
  
  if (formHtml) {
    document.getElementById('crudForm')?.addEventListener('submit', handleCrudSubmit);
  }
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

async function handleCrudSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  
  // Set default images based on section type
  const defaultImages = {
    'quiz': '../images/quiz.jpeg',
    'sessions': '../images/videoSessions.jpeg',
    'resources': '../images/materials.jpeg',
    'assignments': '../images/assignment.jpeg'
  };
  data.image = defaultImages[section] || '../images/materials.jpeg';
  
  try {
    let url = `/api/courseDetails`;
    let method = 'PUT';
    let field = section;
    
    // Fetch the full current courseDetails object
    const selectedCourse = localStorage.getItem('selectedCourse');
    const { course, detailsRes, courseDetailsKey } = await fetchCourseDetailsFull(selectedCourse);
    
    if (!courseDetailsKey) {
      alert('Course details not found for this course!');
      return;
    }
    
    // Update the relevant field for the selected course
    if (!detailsRes[courseDetailsKey][field]) detailsRes[courseDetailsKey][field] = [];
    
    if (mode === 'upload') {
      // Add ID for new items
      const newId = detailsRes[courseDetailsKey][field].length + 1;
      data.id = newId;
      detailsRes[courseDetailsKey][field].push(data);
    } else if (mode === 'edit' && idx !== null) {
      detailsRes[courseDetailsKey][field][idx] = { ...detailsRes[courseDetailsKey][field][idx], ...data };
    }
    
    await fetch(url, { 
      method, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(detailsRes) 
    });
    
    closeModal();
    renderCoursePage();
    alert(mode === 'upload' ? 'Item created successfully!' : 'Item updated successfully!');
  } catch (error) {
    console.error('Error saving data:', error);
    alert('Error saving data. Please try again.');
  }
}

async function deleteItem(sectionType, idx) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  
  try {
    let url = `/api/courseDetails`;
    let method = 'PUT';
    
    // Fetch the full current courseDetails object
    const selectedCourse = localStorage.getItem('selectedCourse');
    const { course, detailsRes, courseDetailsKey } = await fetchCourseDetailsFull(selectedCourse);
    
    if (!courseDetailsKey) {
      alert('Course details not found for this course!');
      return;
    }
    
    if (!Array.isArray(detailsRes[courseDetailsKey][sectionType])) {
      alert('Section not found!');
      return;
    }
    
    detailsRes[courseDetailsKey][sectionType].splice(idx, 1);
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detailsRes)
    });
    
    if (response.ok) {
      renderCoursePage();
      alert('Item deleted successfully!');
    } else {
      alert('Error deleting item. Please try again.');
    }
  } catch (error) {
    console.error('Error deleting item:', error);
    alert('Error deleting item. Please try again.');
  }
}

function renderSection(type, items, imagePath, title) {
  if (!items || items.length === 0) return null;
  currentItems = items;
  const div = document.createElement("div");
  div.className = "quiz-list";
  div.id = type;
  const header = `
    <div class="quiz-item">
      <h2>${title.toUpperCase()}</h2>
      <div class="buttons">
        <button class="btn" onclick="openModal('${type}', 'upload')">Upload</button>
      </div>
    </div>
  `;
  const content = items.map((item, idx) => {
    let goToLink = '';
    if (type === 'quiz') {
      if (item.quizLink) {
        goToLink = `<a href="${item.quizLink}" target="_blank"><button class='btn'>Go to Quiz</button></a>`;
      } else {
        goToLink = `<a href="/HTML/quiz.html?id=${item.id || idx}" target="_blank"><button class='btn'>Go to Quiz</button></a>`;
      }
    } else if (type === 'assignments') {
      // Store assignment data for teacher view
      const assignmentData = {
        id: item.id || idx,
        title: item.title || item.name || item,
        course: localStorage.getItem('selectedCourse'),
        dueDate: item.due,
        instructions: item.instructions,
        userType: 'teacher',
        assignmentLink: item.assignmentLink
      };
      
      if (item.assignmentLink) {
        goToLink = `<a href="${item.assignmentLink}" target="_blank"><button class='btn'>Go to Assignment</button></a>`;
      } else {
        goToLink = `<button class='btn' onclick="openAssignmentPage('${JSON.stringify(assignmentData).replace(/'/g, "\\'")}')">Review Assignments</button>`;
      }
    }
    return `
      <div class="quiz">
        <img src="${item.image || imagePath}" alt="${title} Image" class="quiz-image">
        <div class="session-name">
          <h4>${item.title || item.name || item}</h4>
          ${item.due ? `<p>Due Date: ${item.due}</p>` : ""}
          <button class="btn" onclick="openModal('${type}', 'edit', ${idx})">Edit</button>
          ${goToLink}
          <button class="btn" onclick="deleteItem('${type}', ${idx})">Delete</button>
        </div>
      </div>
    `;
  }).join("");
  div.innerHTML = header + content;
  return div;
}

// Refactor renderCoursePage to use new containers
async function renderCoursePage() {
  const selectedCourse = localStorage.getItem('selectedCourse');
  if (!selectedCourse) {
    document.getElementById('dynamic-course-title').textContent = "No course selected";
    return;
  }
  try {
    const { course, courseDetails, detailsRes } = await fetchCourseDetailsFull(selectedCourse);
    if (!course) {
      document.getElementById('dynamic-course-title').textContent = "Course not found";
      return;
    }
    updateHeader(course);
    // Update description and duration
    const descElem = document.getElementById('dynamic-course-desc');
    if (descElem) descElem.textContent = course.description || "No description available.";
    const durationElem = document.getElementById('dynamic-course-duration');
    if (durationElem) durationElem.textContent = course.duration ? `Duration: ${course.duration}` : '';
    // Clear all containers
    ['quizContainer','assignmentContainer','resourceContainer','sessionContainer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    // Render each section
    if (courseDetails) {
      renderSectionToContainer('quiz', courseDetails.quiz || [], '../images/quiz.jpeg', 'Quiz', 'quizContainer');
      renderSectionToContainer('assignments', courseDetails.assignments || [], '../images/assignment.jpeg', 'Assignment', 'assignmentContainer');
      renderSectionToContainer('resources', courseDetails.resources || [], '../images/materials.jpeg', 'Resource', 'resourceContainer');
      renderSectionToContainer('sessions', courseDetails.sessions || [], '../images/videoSessions.jpeg', 'Video Session', 'sessionContainer');
    }
    // Update course selector to show selected course
    const courseSelect = document.getElementById('courseSelect');
    if (courseSelect) courseSelect.value = selectedCourse;
  } catch (error) {
    console.error('Error rendering course page:', error);
    ['quizContainer','assignmentContainer','resourceContainer','sessionContainer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<div style="text-align:center;color:#888;padding:20px;">Error loading section</div>`;
    });
  }
}

// Helper to render a section into a specific container
function renderSectionToContainer(type, items, imagePath, title, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><h3>No ${title}s</h3><p>No ${title.toLowerCase()}s available yet.</p></div>`;
    return;
  }
  items.forEach((item, idx) => {
    let goToLink = '';
    if (type === 'quiz') {
      goToLink = item.quizLink ? `<a href="${item.quizLink}" target="_blank"><button class='btn'>Go to Quiz</button></a>` : '';
    } else if (type === 'assignments') {
      const assignmentData = {
        id: item.id || idx,
        title: item.title || item.name || item,
        course: localStorage.getItem('selectedCourse'),
        dueDate: item.due,
        instructions: item.instructions,
        userType: 'teacher',
        assignmentLink: item.assignmentLink
      };
      goToLink = item.assignmentLink ? `<a href="${item.assignmentLink}" target="_blank"><button class='btn'>Go to Assignment</button></a>` : `<button class='btn' onclick='openAssignmentPage(${JSON.stringify(assignmentData)})'>Review Assignments</button>`;
    } else if (type === 'resources') {
      goToLink = item.pdf ? `<a href="${item.pdf}" target="_blank"><button class='btn'>View PDF</button></a>` : '';
    } else if (type === 'sessions') {
      goToLink = item.video ? `<a href="${item.video}" target="_blank"><button class='btn'>Watch Video</button></a>` : '';
    }
    const itemDiv = document.createElement('div');
    itemDiv.className = 'quiz';
    itemDiv.innerHTML = `
      <img src="${item.image || imagePath}" alt="${title} Image" class="quiz-image">
      <div class="session-name">
        <h4>${item.title || item.name || item}</h4>
        ${item.due ? `<p>Due Date: ${item.due}</p>` : ""}
        <button class="btn" onclick="showTeacherModal('${type}', 'edit', ${JSON.stringify(item)}, ${idx})">Edit</button>
        ${goToLink}
        <button class="btn" onclick="deleteItem('${type}', ${idx})">Delete</button>
      </div>
    `;
    container.appendChild(itemDiv);
  });
}


// Function to open assignment page for teacher review
function openAssignmentPage(assignmentDataString) {
  try {
    const assignmentData = JSON.parse(assignmentDataString);
    localStorage.setItem('currentAssignment', JSON.stringify(assignmentData));
    window.location.href = '/HTML/assignment.html?role=teacher&assignmentId=' + assignmentData.id;
  } catch (error) {
    console.error('Error parsing assignment data:', error);
    alert('Error opening assignment page. Please try again.');
  }
}


// On page load, initialize

document.addEventListener('DOMContentLoaded', function() {
    initializeTeacherCoursePage();
});

async function initializeTeacherCoursePage() {
    try {
        if (!teacherLoggedInUser || teacherLoggedInUser.type !== 'teacher') {
            alert('Please log in as a teacher to access this page.');
            window.location.href = '/HTML/login.html';
            return;
        }
        // Get selected course from localStorage
        const selectedCourse = localStorage.getItem('selectedCourse');
        if (!selectedCourse) {
            alert('No course selected.');
            window.location.href = '/HTML/mycourses.html';
            return;
        }
        // Fetch course data by title
        const coursesRes = await fetch(`${API_BASE_URL}/courses`);
        const coursesArr = await coursesRes.json();
        teacherCurrentCourse = coursesArr.find(c => c.title === selectedCourse);
        if (!teacherCurrentCourse) {
            alert('Course not found.');
            window.location.href = '/HTML/mycourses.html';
            return;
        }
        await loadTeacherCourseData();
        updateTeacherCourseDisplay();
        renderTeacherAllSections();
        setupTeacherEventListeners();
        setupProfileDropdown();
    } catch (error) {
        console.error('Error initializing teacher course page:', error);
        alert('Failed to load course. Please refresh and try again.');
    }
}

async function loadTeacherCourseData() {
    // Fetch all quizzes
    const quizzesRes = await fetch(`${API_BASE_URL}/quizzes`);
    teacherAllQuizzes = quizzesRes.ok ? await quizzesRes.json() : [];
    // Fetch assignments
    const assignmentsRes = await fetch(`${API_BASE_URL}/assignments`);
    teacherAssignmentsResource = assignmentsRes.ok ? await assignmentsRes.json() : [];
    // Fetch quiz submissions
    const submissionsRes = await fetch(`${API_BASE_URL}/quizSubmissions`);
    allQuizSubmissions = submissionsRes.ok ? await submissionsRes.json() : [];
    // Fetch assignment submissions
    const assignmentSubmissionsRes = await fetch(`${API_BASE_URL}/assignmentSubmissions`);
    allAssignmentSubmissions = assignmentSubmissionsRes.ok ? await assignmentSubmissionsRes.json() : [];
    // Fetch videoSessions and materials
    const videoSessionsRes = await fetch(`${API_BASE_URL}/videoSessions`);
    const allVideoSessions = videoSessionsRes.ok ? await videoSessionsRes.json() : [];
    const materialsRes = await fetch(`${API_BASE_URL}/materials`);
    const allMaterials = materialsRes.ok ? await materialsRes.json() : [];
    // Fetch courseDetails from db.json
    const dbRes = await fetch(`${API_BASE_URL}/db.json`);
    const dbData = dbRes.ok ? await dbRes.json() : {};
    const courseDetailsData = dbData.courseDetails || {};
    if (courseDetailsData[teacherCurrentCourse.title]) {
        teacherCourseDetails = courseDetailsData[teacherCurrentCourse.title];
    } else {
        // Try partial match
        const courseKeys = Object.keys(courseDetailsData);
        const matchingKey = courseKeys.find(key =>
            key.toLowerCase().includes(teacherCurrentCourse.title.toLowerCase()) ||
            teacherCurrentCourse.title.toLowerCase().includes(key.toLowerCase())
        );
        if (matchingKey) {
            teacherCourseDetails = courseDetailsData[matchingKey];
        } else {
            teacherCourseDetails = {
                title: teacherCurrentCourse.title,
                description: teacherCurrentCourse.description,
                coordinator: teacherCurrentCourse.coordinator,
                image: teacherCurrentCourse.img || teacherCurrentCourse.image,
                quiz: [],
                sessions: [],
                resources: [],
                assignments: []
            };
        }
    }
    // Filter quizzes for this course
    teacherCourseDetails.quiz = teacherAllQuizzes.filter(quiz => quiz.course && quiz.course.trim() === teacherCurrentCourse.title.trim());
    // Use global videoSessions and materials if not present in courseDetails
    teacherCourseDetails.sessions = (teacherCourseDetails.sessions && teacherCourseDetails.sessions.length > 0)
        ? teacherCourseDetails.sessions
        : allVideoSessions.filter(v => !v.course || v.course === teacherCurrentCourse.title);
    teacherCourseDetails.resources = (teacherCourseDetails.resources && teacherCourseDetails.resources.length > 0)
        ? teacherCourseDetails.resources
        : allMaterials.filter(m => !m.course || m.course === teacherCurrentCourse.title);
    // Assignments will be handled from assignmentsResource
}

function updateTeacherCourseDisplay() {
    if (!teacherCurrentCourse || !teacherCourseDetails) return;
    document.title = `${teacherCourseDetails.title || teacherCurrentCourse.title} - LearnEdge LMS (Teacher)`;
    const titleElement = document.getElementById('dynamic-course-title');
    if (titleElement) titleElement.textContent = teacherCourseDetails.title || teacherCurrentCourse.title;
    const descElement = document.getElementById('dynamic-course-desc');
    if (descElement) descElement.textContent = teacherCourseDetails.description || teacherCurrentCourse.description || 'Course description will be available soon.';
    const durationElement = document.getElementById('dynamic-course-duration');
    if (durationElement) durationElement.textContent = `Duration: ${teacherCourseDetails.duration || teacherCurrentCourse.duration || 'TBD'}`;
    const imageElement = document.getElementById('dynamic-course-img');
    if (imageElement) {
        imageElement.src = teacherCourseDetails.image || teacherCurrentCourse.img || teacherCurrentCourse.image || '../images/Consultant.jpeg';
        imageElement.alt = teacherCourseDetails.title || teacherCurrentCourse.title;
        imageElement.onerror = function() { this.src = '../images/Consultant.jpeg'; };
    }
}

function renderTeacherAllSections() {
    renderTeacherQuizSection();
    renderTeacherSessionsSection();
    renderTeacherResourcesSection();
    renderTeacherAssignmentsSection();
}

// --- CRUD and Rendering for Each Section ---

// Helper: Show modal for Add/Edit
function showTeacherModal(section, mode, item = {}, idx = null) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    modal.classList.remove('hidden');
    let formHtml = '';
    if (section === 'quiz') {
        if (mode === 'add') {
            formHtml = `
                <form id="quizCrudForm">
                    <label>Title:<input type="text" name="title" required></label><br>
                    <label>Description:<input type="text" name="description"></label><br>
                    <label>Due Date:<input type="date" name="due"></label><br>
                    <label>Max Score:<input type="number" name="maxScore" value="100" min="1"></label><br>
                    <label>Duration (min):<input type="number" name="duration" value="30" min="1"></label><br>
                    <label>Instructions:<textarea name="instructions"></textarea></label><br>
                    <div id="questionsSection">
                        <h4>Questions</h4>
                        <div id="questionsContainer"></div>
                        <button type="button" class="btn btn2" id="addQuestionBtn"><i class="fas fa-plus"></i> Add Question</button>
                    </div>
                    <button type="submit">Create</button>
                </form>
            `;
        } else {
            // Edit mode: prefill questions if present
            console.log('Edit quiz modal opened. Item:', item);
            const questions = Array.isArray(item.questions) ? item.questions : [];
            formHtml = `
                <form id="quizCrudForm">
                    <label>Title:<input type="text" name="title" value="${item.title || ''}" required></label><br>
                    <label>Description:<input type="text" name="description" value="${item.description || ''}"></label><br>
                    <label>Due Date:<input type="date" name="due" value="${item.due || ''}"></label><br>
                    <label>Max Score:<input type="number" name="maxScore" value="${item.maxScore || 100}" min="1"></label><br>
                    <label>Duration (min):<input type="number" name="duration" value="${item.duration || 30}" min="1"></label><br>
                    <label>Instructions:<textarea name="instructions">${item.instructions || ''}</textarea></label><br>
                    <div id="questionsSection">
                        <h4>Questions</h4>
                        <div id="questionsContainer"></div>
                        <button type="button" class="btn btn2" id="addQuestionBtn"><i class="fas fa-plus"></i> Add Question</button>
                    </div>
                    <button type="submit">Update</button>
                </form>
            `;
        }
    } else if (section === 'assignments') {
        formHtml = `
            <form id="assignmentCrudForm">
                <label>Title:<input type="text" name="assignment" value="${item.assignment || ''}" required></label><br>
                <label>Description:<input type="text" name="description" value="${item.description || ''}"></label><br>
                <label>Due Date:<input type="date" name="date" value="${item.date || ''}"></label><br>
                <label>Instructions:<textarea name="instructions">${item.instructions || ''}</textarea></label><br>
                <label>PDF Link (for students to download):<input type="text" name="pdf" value="${item.pdf || ''}" placeholder="Paste PDF link or upload below"></label><br>
                <input type="file" id="assignmentPdfUpload" accept="application/pdf"><br>
                <button type="submit">${mode === 'edit' ? 'Update' : 'Create'}</button>
            </form>
        `;
    } else if (section === 'resources') {
        formHtml = `
            <form id="resourceCrudForm">
                <label>Title:<input type="text" name="title" value="${item.title || ''}" required></label><br>
                <label>Description:<input type="text" name="description" value="${item.description || ''}"></label><br>
                <label>PDF Link:<input type="text" name="pdf" value="${item.pdf || ''}"></label><br>
                <button type="submit">${mode === 'edit' ? 'Update' : 'Create'}</button>
            </form>
        `;
    } else if (section === 'sessions') {
        formHtml = `
            <form id="sessionCrudForm">
                <label>Title:<input type="text" name="title" value="${item.title || ''}" required></label><br>
                <label>Description:<input type="text" name="description" value="${item.description || ''}"></label><br>
                <label>Video Link:<input type="text" name="video" value="${item.video || ''}"></label><br>
                <button type="submit">${mode === 'edit' ? 'Update' : 'Create'}</button>
            </form>
        `;
    }
    modalTitle.innerText = `${mode === 'edit' ? 'Edit' : 'Add'} ${section.charAt(0).toUpperCase() + section.slice(1)}`;
    modalBody.innerHTML = formHtml;

    // Assignment PDF upload logic
    if (section === 'assignments') {
      const fileInput = document.getElementById('assignmentPdfUpload');
      const pdfInput = document.querySelector('input[name="pdf"]');
      if (fileInput && pdfInput) {
        fileInput.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (file) {
            // Simulate upload: just use a fake URL for demo
            const url = URL.createObjectURL(file);
            pdfInput.value = url;
          }
        });
      }
    }

    // Quiz dynamic questions UI (with fallback)
    if (section === 'quiz') {
      try {
        const questionsContainer = document.getElementById('questionsContainer');
        let questions = [];
        if (mode === 'edit' && Array.isArray(item.questions)) {
          questions = JSON.parse(JSON.stringify(item.questions));
        }
        function renderQuestions() {
          questionsContainer.innerHTML = questions.map((q, qIdx) => `
            <div class="question-block" style="border:1px solid #e0e0e0; border-radius:7px; padding:12px; margin-bottom:12px;">
              <label>Question:
                <input type="text" class="q-text" value="${q.question || ''}" data-qidx="${qIdx}" required>
              </label>
              <div class="options-list">
                ${q.options.map((opt, oIdx) => `
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                    <input type="text" class="q-option" value="${opt}" data-qidx="${qIdx}" data-oidx="${oIdx}" required>
                    <input type="radio" name="correct-${qIdx}" value="${oIdx}" ${q.correctAnswer === oIdx ? 'checked' : ''}> Correct
                    <button type="button" class="btn btn2 removeOptBtn" data-qidx="${qIdx}" data-oidx="${oIdx}"><i class="fas fa-times"></i></button>
                  </div>
                `).join('')}
              </div>
              <button type="button" class="btn btn2 addOptBtn" data-qidx="${qIdx}"><i class="fas fa-plus"></i> Add Option</button>
              <button type="button" class="btn btn-danger removeQBtn" data-qidx="${qIdx}" style="float:right;margin-top:4px;"><i class="fas fa-trash"></i> Remove Question</button>
            </div>
          `).join('');
          // Attach option add/remove
          questionsContainer.querySelectorAll('.addOptBtn').forEach(btn => {
            btn.onclick = function() {
              const qIdx = +btn.getAttribute('data-qidx');
              questions[qIdx].options.push('');
              renderQuestions();
            };
          });
          questionsContainer.querySelectorAll('.removeOptBtn').forEach(btn => {
            btn.onclick = function() {
              const qIdx = +btn.getAttribute('data-qidx');
              const oIdx = +btn.getAttribute('data-oidx');
              questions[qIdx].options.splice(oIdx, 1);
              if (questions[qIdx].correctAnswer === oIdx) questions[qIdx].correctAnswer = null;
              renderQuestions();
            };
          });
          questionsContainer.querySelectorAll('.removeQBtn').forEach(btn => {
            btn.onclick = function() {
              const qIdx = +btn.getAttribute('data-qidx');
              questions.splice(qIdx, 1);
              renderQuestions();
            };
          });
          // Attach question/option text and correct answer change
          questionsContainer.querySelectorAll('.q-text').forEach(input => {
            input.oninput = function() {
              const qIdx = +input.getAttribute('data-qidx');
              questions[qIdx].question = input.value;
            };
          });
          questionsContainer.querySelectorAll('.q-option').forEach(input => {
            input.oninput = function() {
              const qIdx = +input.getAttribute('data-qidx');
              const oIdx = +input.getAttribute('data-oidx');
              questions[qIdx].options[oIdx] = input.value;
            };
          });
          questionsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.onchange = function() {
              const qIdx = +radio.name.split('-')[1];
              questions[qIdx].correctAnswer = +radio.value;
            };
          });
        }
        // Add question button
        document.getElementById('addQuestionBtn').onclick = function() {
          questions.push({ question: '', options: ['', ''], correctAnswer: 0 });
          renderQuestions();
        };
        // Initial render
        if (mode === 'edit' && questions.length > 0) {
          renderQuestions();
        } else if (mode === 'add') {
          questions = [{ question: '', options: ['', ''], correctAnswer: 0 }];
          renderQuestions();
        }
        // On submit, collect questions
        document.getElementById('quizCrudForm').onsubmit = function(e) {
          e.preventDefault();
          const form = e.target;
          const data = Object.fromEntries(new FormData(form).entries());
          data.questions = questions.map(q => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer
          }));
          data.course = teacherCurrentCourse.title;
          if (mode === 'add') {
            fetch(`${API_BASE_URL}/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
              .then(() => { closeModal(); loadTeacherCourseData().then(renderTeacherQuizSection); });
          } else if (mode === 'edit') {
            const quiz = teacherCourseDetails.quiz[idx];
            fetch(`${API_BASE_URL}/quizzes/${quiz.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
              .then(() => { closeModal(); loadTeacherCourseData().then(renderTeacherQuizSection); });
          }
        };
      } catch (err) {
        console.error('Quiz modal error:', err);
        questionsContainer.innerHTML = '<div style="color:red;">Error loading questions UI. Please refresh.</div>';
      }
    }
    // Assignment Crud Form Submission
    if (section === 'assignments') {
      document.getElementById('assignmentCrudForm').onsubmit = async function(e) {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());
        data.course = teacherCurrentCourse.title;
        if (mode === 'add') {
          await fetch(`${API_BASE_URL}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        } else if (mode === 'edit') {
          const assignments = teacherAssignmentsResource.filter(a => a.course === teacherCurrentCourse.title);
          const assignment = assignments[idx];
          await fetch(`${API_BASE_URL}/assignments/${assignment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        }
        closeModal();
        await loadTeacherCourseData();
        renderTeacherAssignmentsSection();
      };
    }
    // Resource Crud Form Submission
    if (section === 'resources') {
      document.getElementById('resourceCrudForm').onsubmit = async function(e) {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());
        data.course = teacherCurrentCourse.title;
        if (mode === 'add') {
          data.course = teacherCurrentCourse.title;
          await fetch(`${API_BASE_URL}/materials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else if (mode === 'edit') {
          teacherCourseDetails.resources[idx] = { ...teacherCourseDetails.resources[idx], ...data };
          await updateCourseDetailsBackend();
        }
        closeModal();
        await loadTeacherCourseData();
        renderTeacherResourcesSection();
      };
    }
    // Session Crud Form Submission
    if (section === 'sessions') {
      document.getElementById('sessionCrudForm').onsubmit = async function(e) {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());
        data.course = teacherCurrentCourse.title;
        if (mode === 'add') {
          data.course = teacherCurrentCourse.title;
          await fetch(`${API_BASE_URL}/videoSessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else if (mode === 'edit') {
          teacherCourseDetails.sessions[idx] = { ...teacherCourseDetails.sessions[idx], ...data };
          await updateCourseDetailsBackend();
        }
        closeModal();
        await loadTeacherCourseData();
        renderTeacherSessionsSection();
      };
    }
}
window.closeModal = function() {
    document.getElementById('modal').classList.add('hidden');
};

// --- QUIZ CRUD ---
function renderTeacherQuizSection() {
    const quizStats = document.getElementById('quizStats');
    const quizContainer = document.getElementById('quizContainer');
    let quizzes = teacherCourseDetails.quiz || [];
    // Filter by search/filter
    if (quizFilterStatus) {
      quizzes = quizzes.filter(q => {
        if (quizFilterStatus === 'pending') return !q.completed && !q.overdue;
        if (quizFilterStatus === 'completed') return q.completed;
        if (quizFilterStatus === 'overdue') return q.overdue;
        return true;
      });
    }
    // Calculate average score from submissions
    const courseQuizIds = quizzes.map(q => q.id);
    const relevantSubmissions = (allQuizSubmissions || []).filter(sub => courseQuizIds.includes(sub.quizId));
    const totalScore = relevantSubmissions.reduce((acc, sub) => acc + (sub.score || 0), 0);
    const avgScore = relevantSubmissions.length > 0 ? Math.round(totalScore / relevantSubmissions.length) : 0;
    // Stats
    quizStats.innerHTML = `
        <div class="stat-card"><i class="fas fa-clipboard-list"></i><div class="stat-info"><span class="stat-number">${quizzes.length}</span><span class="stat-label">Total Quizzes</span></div></div>
        <div class="stat-card"><i class="fas fa-star"></i><div class="stat-info"><span class="stat-number">${avgScore}</span><span class="stat-label">Avg Score</span></div></div>
    `;
    quizContainer.innerHTML = quizzes.length === 0 ? '<div class="empty-state">No quizzes available.</div>' :
        quizzes.map((quiz, idx) => `
            <div class="quiz-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 24px; display: flex; flex-direction: column; gap: 12px; border: 1.5px solid #e0e0e0;">
                <div style="display: flex; flex-direction: row; align-items: center; gap: 18px;">
                    <img src="${quiz.image || '../images/quiz.jpeg'}" alt="Quiz Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/quiz.jpeg'">
                    <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 1.2rem; font-weight: 600; color: #1025a1;">${quiz.title}</div>
                        <div style="font-size: 0.95rem; color: #555;">${quiz.description || ''}</div>
                        <div style="font-size: 0.9rem; color: #888;">Due: ${quiz.due || quiz.dueDate || ''}</div>
                    </div>
                </div>
                <div class="quiz-actions" style="display: flex; gap: 10px; margin-top: 8px;">
                    <button class="btn btn-primary" onclick="openQuizEditModal(${idx})">Edit</button>
                    <button class="btn btn-danger" onclick="deleteQuiz(${idx})">Delete</button>
                </div>
            </div>
        `).join('');
}
async function handleQuizCrudSubmit(e, mode, idx) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    data.course = teacherCurrentCourse.title;
    if (mode === 'add') {
        // POST to /quizzes
        await fetch(`${API_BASE_URL}/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } else if (mode === 'edit') {
        // PATCH to /quizzes/:id
        const quiz = teacherCourseDetails.quiz[idx];
        await fetch(`${API_BASE_URL}/quizzes/${quiz.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    closeModal();
    await loadTeacherCourseData();
    renderTeacherQuizSection();
}
async function deleteQuiz(idx) {
  if (!confirm('Are you sure you want to delete this quiz?')) return;
  showLoading(true);
  const quiz = teacherCourseDetails.quiz[idx];
  if (!quiz) return;
  try {
    await fetch(`${API_BASE_URL}/quizzes/${quiz.id}`, { method: 'DELETE' });
    await loadTeacherCourseData();
    renderTeacherQuizSection();
    showLoading(false);
    showErrorOverlay('Quiz deleted successfully.', 'success');
  } catch (err) {
    showLoading(false);
    showErrorOverlay('Failed to delete quiz.');
  }
}

// --- ASSIGNMENTS CRUD ---
function renderTeacherAssignmentsSection() {
    const assignmentStats = document.getElementById('assignmentStats');
    const assignmentContainer = document.getElementById('assignmentContainer');
    const assignments = teacherAssignmentsResource.filter(a => a.course === teacherCurrentCourse.title);
    // Calculate total submissions
    const courseAssignmentIds = assignments.map(a => a.id);
    const relevantSubmissions = (allAssignmentSubmissions || []).filter(sub => courseAssignmentIds.includes(sub.assignmentId));
    const totalSubmissions = relevantSubmissions.length;
    // Calculate average score
    const scoredSubmissions = relevantSubmissions.filter(sub => typeof sub.score === 'number');
    const totalScore = scoredSubmissions.reduce((acc, sub) => acc + (sub.score || 0), 0);
    const avgScore = scoredSubmissions.length > 0 ? Math.round(totalScore / scoredSubmissions.length) : 0;
    // Stats
    assignmentStats.innerHTML = `
        <div class="stat-card"><i class="fas fa-clipboard-list"></i><div class="stat-info"><span class="stat-number">${assignments.length}</span><span class="stat-label">Total Assignments</span></div></div>
        <div class="stat-card"><i class="fas fa-star"></i><div class="stat-info"><span class="stat-number">${avgScore}</span><span class="stat-label">Avg Score</span></div></div>
    `;
    assignmentContainer.innerHTML = assignments.length === 0 ? '<div class="empty-state">No assignments available.</div>' :
        assignments.map((assignment, idx) => {
            return `
                <div class="assignment-card">
                    <div class="assignment-header-card" style="display:flex;align-items:center;gap:10px;">
                        <h3 class="assignment-title" style="margin:0;flex:1;text-align:left;">${assignment.assignment || assignment.title || 'Untitled Assignment'}</h3>
                        <span class="assignment-status" style="margin-left:auto; color: #1025a1; font-weight: 600;">${assignment.status || 'Pending'}</span>
                    </div>
                    <div class="assignment-course">
                        <i class="fas fa-book"></i> ${assignment.course}
                    </div>
                    <div class="assignment-details">
                        <div class="assignment-detail"><strong>Due Date:</strong> <span>${assignment.date || assignment.dueDate || 'TBD'}</span></div>
                    </div>
                    <div class="assignment-actions">
                        <button class="btn btn-primary" onclick='window._editAssignment(${idx})'>Edit</button>
                        <button class="btn btn-danger" onclick="deleteAssignment(${assignment.id})">Delete</button>
                        <button class="btn btn2" onclick="window.reviewAssignment(${assignment.id})">Review</button>
                    </div>
                </div>
            `;
        }).join('');

// --- Review Assignment Modal ---
window.reviewAssignment = function(assignmentId) {
    const submissions = (allAssignmentSubmissions || []).filter(sub => String(sub.assignmentId) === String(assignmentId));
    const assignment = teacherAssignmentsResource.find(a => String(a.id) === String(assignmentId));
    if (!assignment) return alert('Assignment not found.');
    let modal = document.getElementById('reviewAssignmentModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'reviewAssignmentModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.9)';
        modal.style.zIndex = '99999';
        modal.style.overflow = 'auto';
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
    }
    modal.innerHTML = `
        <div style="background:white; margin:40px auto; max-width:700px; border-radius:12px; padding:32px; position:relative; min-height:200px; max-height:90vh; overflow-y:auto;">
            <h2>Review Submissions: ${assignment.assignment || assignment.title}</h2>
            <button style="position:absolute; top:16px; right:16px; font-size:1.5em; background:none; border:none; color:#1025a1; cursor:pointer;" onclick="document.getElementById('reviewAssignmentModal').remove()">&times;</button>
            <div id="reviewSubmissionsList">
                ${submissions.length === 0 ? '<div style="color:#888;">No submissions yet.</div>' : submissions.map((sub, i) => `
                    <div style="border:1px solid #eee; border-radius:8px; padding:14px; margin-bottom:14px;">
                        <div><b>Student:</b> ${sub.studentName || sub.studentId}</div>
                        <div><b>Score:</b> <input type="number" min="0" max="100" value="${sub.score ?? ''}" id="scoreInput${i}" style="width:60px;"> / ${sub.maxScore || 100}</div>
                        <div><b>Feedback:</b> <input type="text" value="${sub.feedback || ''}" id="feedbackInput${i}" style="width:60%;"></div>
                        <div><b>File:</b> ${sub.fileName ? `<a href="#" style="color:#1025a1;">${sub.fileName}</a>` : 'No file uploaded'}</div>
                        <button class="btn btn-primary" onclick="window.saveReview(${assignmentId},${i})">Save</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    // Save review handler
    window.saveReview = async function(assignmentId, idx) {
        const sub = submissions[idx];
        if (!sub) return;
        const score = parseInt(document.getElementById(`scoreInput${idx}`).value);
        const feedback = document.getElementById(`feedbackInput${idx}`).value;
        const updated = { ...sub, score, feedback };
        await fetch(`${API_BASE_URL}/assignmentSubmissions/${sub.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        });
        alert('Review saved!');
        document.getElementById('reviewAssignmentModal').remove();
        await loadTeacherCourseData();
        renderTeacherAssignmentsSection();
    };
};
}
async function handleAssignmentCrudSubmit(e, mode, idx) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    data.course = teacherCurrentCourse.title;
    if (mode === 'add') {
        await fetch(`${API_BASE_URL}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } else if (mode === 'edit') {
        const assignments = teacherAssignmentsResource.filter(a => a.course === teacherCurrentCourse.title);
        const assignment = assignments[idx];
        await fetch(`${API_BASE_URL}/assignments/${assignment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    closeModal();
    await loadTeacherCourseData();
    renderTeacherAssignmentsSection();
}
async function deleteAssignment(id) {
  if (!confirm('Are you sure you want to delete this assignment?')) return;
  showLoading(true);
  try {
    await fetch(`${API_BASE_URL}/assignments/${id}`, { method: 'DELETE' });
    await loadTeacherCourseData();
    renderTeacherAssignmentsSection();
    showLoading(false);
    showErrorOverlay('Assignment deleted successfully.', 'success');
  } catch (err) {
    showLoading(false);
    showErrorOverlay('Failed to delete assignment.');
  }
}

// --- RESOURCES CRUD ---
function renderTeacherResourcesSection() {
    const resourceContainer = document.getElementById('resourceContainer');
    const resources = teacherCourseDetails.resources || [];
    resourceContainer.innerHTML = resources.length === 0 ? '<div class="empty-state">No resources available.</div>' :
        resources.map((resource, idx) => `
            <div class="resource-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                <img src="${resource.image || '../images/materials.jpeg'}" alt="Resource Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/materials.jpeg'">
                <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${resource.title || 'Untitled Resource'}</div>
                    <div style="font-size: 0.95rem; color: #555;">${resource.description || ''}</div>
                </div>
                <button class="btn btn-primary" onclick='window._editResource(${idx})'>Edit</button>
                <button class="btn btn-danger" onclick="deleteResource(${idx})">Delete</button>
            </div>
        `).join('');
}
async function handleResourceCrudSubmit(e, mode, idx) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    data.course = teacherCurrentCourse.title;
    if (mode === 'add') {
        teacherCourseDetails.resources.push(data);
    } else if (mode === 'edit') {
        teacherCourseDetails.resources[idx] = { ...teacherCourseDetails.resources[idx], ...data };
    }
    // Update courseDetails in backend
    await updateCourseDetailsBackend();
    closeModal();
    await loadTeacherCourseData();
    renderTeacherResourcesSection();
}
async function deleteResource(idx) {
  if (!confirm('Are you sure you want to delete this resource?')) return;
  showLoading(true);
  const resource = teacherCourseDetails.resources[idx];
  if (!resource || !resource.id) {
    showLoading(false);
    showErrorOverlay('Resource not found.');
    return;
  }
  try {
    await fetch(`${API_BASE_URL}/materials/${resource.id}`, { method: 'DELETE' });
    await loadTeacherCourseData();
    renderTeacherResourcesSection();
    showLoading(false);
    showErrorOverlay('Resource deleted successfully.', 'success');
  } catch (err) {
    showLoading(false);
    showErrorOverlay('Failed to delete resource.');
  }
}

// --- SESSIONS CRUD ---
function renderTeacherSessionsSection() {
    const sessionContainer = document.getElementById('sessionContainer');
    const sessions = teacherCourseDetails.sessions || [];
    sessionContainer.innerHTML = sessions.length === 0 ? '<div class="empty-state">No video sessions available.</div>' :
        sessions.map((session, idx) => `
            <div class="session-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                <img src="${session.image || '../images/videoSessions.jpeg'}" alt="Session Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/videoSessions.jpeg'">
                <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${session.title || 'Untitled Session'}</div>
                    <div style="font-size: 0.95rem; color: #555;">${session.description || ''}</div>
                </div>
                <button class="btn btn-primary" onclick='window._editSession(${idx})'>Edit</button>
                <button class="btn btn-danger" onclick="deleteSession(${idx})">Delete</button>
            </div>
        `).join('');
}
async function handleSessionCrudSubmit(e, mode, idx) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form).entries());
    data.course = teacherCurrentCourse.title;
    if (mode === 'add') {
        teacherCourseDetails.sessions.push(data);
    } else if (mode === 'edit') {
        teacherCourseDetails.sessions[idx] = { ...teacherCourseDetails.sessions[idx], ...data };
    }
    await updateCourseDetailsBackend();
    closeModal();
    await loadTeacherCourseData();
    renderTeacherSessionsSection();
}
async function deleteSession(idx) {
  if (!confirm('Are you sure you want to delete this session?')) return;
  showLoading(true);
  const session = teacherCourseDetails.sessions[idx];
  if (!session || !session.id) {
    showLoading(false);
    showErrorOverlay('Session not found.');
    return;
  }
  try {
    await fetch(`${API_BASE_URL}/videoSessions/${session.id}`, { method: 'DELETE' });
    await loadTeacherCourseData();
    renderTeacherSessionsSection();
    showLoading(false);
    showErrorOverlay('Session deleted successfully.', 'success');
  } catch (err) {
    showLoading(false);
    showErrorOverlay('Failed to delete session.');
  }
}

// --- Backend update for courseDetails (resources/sessions) ---
async function updateCourseDetailsBackend() {
    // Fetch all courseDetails
    const dbRes = await fetch(`${API_BASE_URL}/db.json`);
    const dbData = dbRes.ok ? await dbRes.json() : {};
    const courseDetailsData = dbData.courseDetails || {};
    courseDetailsData[teacherCurrentCourse.title] = teacherCourseDetails;
    await fetch(`${API_BASE_URL}/courseDetails`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseDetailsData)
    });
}

// --- Event Listeners ---
function setupTeacherEventListeners() {
    document.getElementById('addQuizBtn')?.addEventListener('click', () => showTeacherModal('quiz','add'));
    document.getElementById('addAssignmentBtn')?.addEventListener('click', () => showTeacherModal('assignments','add'));
    document.getElementById('addResourceBtn')?.addEventListener('click', () => showTeacherModal('resources','add'));
    document.getElementById('addSessionBtn')?.addEventListener('click', () => showTeacherModal('sessions','add'));
}

window._editQuiz = function(idx) {
  const quiz = teacherCourseDetails.quiz[idx];
  showTeacherModal('quiz', 'edit', quiz, idx);
};

window._editAssignment = function(idx) {
  const assignments = teacherAssignmentsResource.filter(a => a.course === teacherCurrentCourse.title);
  const assignment = assignments[idx];
  showTeacherModal('assignments', 'edit', assignment, idx);
};

window._editResource = function(idx) {
  const resource = teacherCourseDetails.resources[idx];
  showTeacherModal('resources', 'edit', resource, idx);
};

window._editSession = function(idx) {
  const session = teacherCourseDetails.sessions[idx];
  showTeacherModal('sessions', 'edit', session, idx);
};

// Minimal Quiz Edit Modal logic
window.openQuizEditModal = function(idx) {
  const quiz = teacherCourseDetails.quiz[idx];
  if (!quiz) return alert('Quiz not found!');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  modalTitle.innerText = 'Edit Quiz';
  let questions = Array.isArray(quiz.questions) ? JSON.parse(JSON.stringify(quiz.questions)) : [];
  function renderQuestionsUI() {
    modalBody.innerHTML = `
      <form id="quizEditForm">
        <label>Title: <input type="text" name="title" id="quizEditTitleInput" value="${quiz.title || ''}" required></label><br>
        <label>Description: <input type="text" name="description" id="quizEditDescInput" value="${quiz.description || ''}"></label><br>
        <label>Due Date: <input type="date" name="due" id="quizEditDueInput" value="${quiz.due || ''}"></label><br>
        <label>Max Score: <input type="number" name="maxScore" id="quizEditMaxScoreInput" value="${quiz.maxScore || 100}" min="1"></label><br>
        <label>Duration (min): <input type="number" name="duration" id="quizEditDurationInput" value="${quiz.duration || 30}" min="1"></label><br>
        <label>Instructions: <textarea name="instructions" id="quizEditInstructionsInput">${quiz.instructions || ''}</textarea></label><br>
        <div id="questionsSection">
          <h4>Questions</h4>
          <div id="questionsContainer"></div>
          <button type="button" class="btn btn2" id="addQuestionBtn"><i class="fas fa-plus"></i> Add Question</button>
        </div>
        <button type="submit">Update</button>
      </form>
    `;
    // Render questions
    const questionsContainer = document.getElementById('questionsContainer');
    questionsContainer.innerHTML = questions.map((q, qIdx) => `
      <div class="question-block" style="border:1px solid #e0e0e0; border-radius:7px; padding:12px; margin-bottom:12px;">
        <label>Question:
          <input type="text" class="q-text" value="${q.question || ''}" data-qidx="${qIdx}" required>
        </label>
        <div class="options-list">
          ${q.options.map((opt, oIdx) => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <input type="text" class="q-option" value="${opt}" data-qidx="${qIdx}" data-oidx="${oIdx}" required>
              <input type="radio" name="correct-${qIdx}" value="${oIdx}" ${q.correctAnswer === oIdx ? 'checked' : ''}> Correct
              <button type="button" class="btn btn2 removeOptBtn" data-qidx="${qIdx}" data-oidx="${oIdx}"><i class="fas fa-times"></i></button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn2 addOptBtn" data-qidx="${qIdx}"><i class="fas fa-plus"></i> Add Option</button>
        <button type="button" class="btn btn-danger removeQBtn" data-qidx="${qIdx}" style="float:right;margin-top:4px;"><i class="fas fa-trash"></i> Remove Question</button>
      </div>
    `).join('');
    // Attach option add/remove
    questionsContainer.querySelectorAll('.addOptBtn').forEach(btn => {
      btn.onclick = function() {
        const qIdx = +btn.getAttribute('data-qidx');
        questions[qIdx].options.push('');
        renderQuestionsUI();
      };
    });
    questionsContainer.querySelectorAll('.removeOptBtn').forEach(btn => {
      btn.onclick = function() {
        const qIdx = +btn.getAttribute('data-qidx');
        const oIdx = +btn.getAttribute('data-oidx');
        questions[qIdx].options.splice(oIdx, 1);
        if (questions[qIdx].correctAnswer === oIdx) questions[qIdx].correctAnswer = null;
        renderQuestionsUI();
      };
    });
    questionsContainer.querySelectorAll('.removeQBtn').forEach(btn => {
      btn.onclick = function() {
        const qIdx = +btn.getAttribute('data-qidx');
        questions.splice(qIdx, 1);
        renderQuestionsUI();
      };
    });
    // Attach question/option text and correct answer change
    questionsContainer.querySelectorAll('.q-text').forEach(input => {
      input.oninput = function() {
        const qIdx = +input.getAttribute('data-qidx');
        questions[qIdx].question = input.value;
      };
    });
    questionsContainer.querySelectorAll('.q-option').forEach(input => {
      input.oninput = function() {
        const qIdx = +input.getAttribute('data-qidx');
        const oIdx = +input.getAttribute('data-oidx');
        questions[qIdx].options[oIdx] = input.value;
      };
    });
    questionsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.onchange = function() {
        const qIdx = +radio.name.split('-')[1];
        questions[qIdx].correctAnswer = +radio.value;
      };
    });
    // Add question button
    document.getElementById('addQuestionBtn').onclick = function() {
      questions.push({ question: '', options: ['', ''], correctAnswer: 0 });
      renderQuestionsUI();
    };
    // On submit, collect questions
    document.getElementById('quizEditForm').onsubmit = function(e) {
      e.preventDefault();
      saveQuizEdit(idx, questions);
    };
  }
  renderQuestionsUI();
  modal.classList.remove('hidden');
};
window.closeQuizEditModal = function() {
  document.getElementById('modal').classList.add('hidden');
};
async function saveQuizEdit(idx, questions) {
  const quiz = teacherCourseDetails.quiz[idx];
  if (!quiz) return;
  const updatedQuiz = {
    ...quiz,
    title: document.getElementById('quizEditTitleInput').value,
    description: document.getElementById('quizEditDescInput').value,
    due: document.getElementById('quizEditDueInput').value,
    maxScore: parseInt(document.getElementById('quizEditMaxScoreInput').value),
    duration: parseInt(document.getElementById('quizEditDurationInput').value),
    instructions: document.getElementById('quizEditInstructionsInput').value,
    questions: questions.map(q => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer
    }))
  };
  await fetch(`${API_BASE_URL}/quizzes/${quiz.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedQuiz)
  });
  closeQuizEditModal();
  await loadTeacherCourseData();
  renderTeacherQuizSection();
}