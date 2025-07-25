// ========================================
// COURSE PAGE - FULLY DYNAMIC & MODERN (IMPROVED)
// ========================================

const API_BASE_URL = '/api';
let currentCourse = null;
let courseDetails = null;
let allQuizzes = [];
let allQuizSubmissions = [];
let loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
let quizFilterStatus = '';
let assignmentsResource = [];

document.addEventListener('DOMContentLoaded', function() {
    initializeCoursePage();
});

async function initializeCoursePage() {
    try {
        if (!loggedInUser) {
            alert('Please log in to access this page.');
            window.location.href = '/HTML/login.html';
            return;
        }
        // Check enrollment for students
        const urlParams = new URLSearchParams(window.location.search);
        let courseId = urlParams.get('id');
        let courseTitle = urlParams.get('title');
        let courseRes, foundCourse = null;
        if (courseId) {
            courseRes = await fetch(`${API_BASE_URL}/courses/${courseId}`);
            if (courseRes.ok) {
                foundCourse = await courseRes.json();
            }
        }
        // If not found by id or no id, try by title
        if (!foundCourse && courseTitle) {
            const allCoursesRes = await fetch(`${API_BASE_URL}/courses`);
            const allCourses = allCoursesRes.ok ? await allCoursesRes.json() : [];
            foundCourse = allCourses.find(c => c.title && c.title.trim().toLowerCase() === courseTitle.trim().toLowerCase());
        }
        // Fallback: try to match by id as string (for string ids)
        if (!foundCourse && courseId) {
            const allCoursesRes = await fetch(`${API_BASE_URL}/courses`);
            const allCourses = allCoursesRes.ok ? await allCoursesRes.json() : [];
            foundCourse = allCourses.find(c => String(c.id) === String(courseId));
        }
        if (!foundCourse) throw new Error('Failed to fetch course data');
        currentCourse = foundCourse;
        if (loggedInUser.type === 'student') {
            // Fetch enrollments and check
            const enrollmentsRes = await fetch(`${API_BASE_URL}/enrollments`);
            const enrollments = enrollmentsRes.ok ? await enrollmentsRes.json() : [];
            const isEnrolled = enrollments.some(e => e.studentId === loggedInUser.id && (e.courseTitle || e.course) === currentCourse.title);
            if (!isEnrolled) {
                alert('You are not enrolled in this course.');
                window.location.href = '/HTML/index.html';
                return;
            }
        }
        await loadCourseData();
        updateCourseDisplay();
        renderAllSections();
        setupEventListeners();
        setupProfileDropdown();
    } catch (error) {
        console.error('Error initializing page:', error);
        showError('Failed to load course. Please refresh and try again.');
    }
}

async function loadCourseData() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');
    if (!courseId) throw new Error('No course ID provided');

    // Fetch course data by id (robust, like courseView.js)
    const courseRes = await fetch(`${API_BASE_URL}/courses/${courseId}`);
    if (!courseRes.ok) throw new Error('Failed to fetch course data');
    currentCourse = await courseRes.json();

    // Fetch all quizzes
    const quizzesRes = await fetch(`${API_BASE_URL}/quizzes`);
    allQuizzes = quizzesRes.ok ? await quizzesRes.json() : [];

    // Fetch all quiz submissions
    const submissionsRes = await fetch(`${API_BASE_URL}/quizSubmissions`);
    allQuizSubmissions = submissionsRes.ok ? await submissionsRes.json() : [];

    // Fetch assignments resource
    const assignmentsRes = await fetch(`${API_BASE_URL}/assignments`);
    assignmentsResource = assignmentsRes.ok ? await assignmentsRes.json() : [];

    // Fetch videoSessions and materials from global resources
    const videoSessionsRes = await fetch(`${API_BASE_URL}/videoSessions`);
    const allVideoSessions = videoSessionsRes.ok ? await videoSessionsRes.json() : [];
    const materialsRes = await fetch(`${API_BASE_URL}/materials`);
    const allMaterials = materialsRes.ok ? await materialsRes.json() : [];

    // Find courseDetails if available (from db.json courseDetails)
    const dbRes = await fetch(`${API_BASE_URL}/db.json`);
    const dbData = dbRes.ok ? await dbRes.json() : {};
    const courseDetailsData = dbData.courseDetails || {};
    if (courseDetailsData[currentCourse.title]) {
        courseDetails = courseDetailsData[currentCourse.title];
    } else {
        // Try partial match
        const courseKeys = Object.keys(courseDetailsData);
        const matchingKey = courseKeys.find(key =>
            key.toLowerCase().includes(currentCourse.title.toLowerCase()) ||
            currentCourse.title.toLowerCase().includes(key.toLowerCase())
        );
        if (matchingKey) {
            courseDetails = courseDetailsData[matchingKey];
        } else {
            courseDetails = {
                title: currentCourse.title,
                description: currentCourse.description,
                coordinator: currentCourse.coordinator,
                image: currentCourse.img || currentCourse.image,
                quiz: [],
                sessions: [],
                resources: [],
                assignments: []
            };
        }
    }
    // Filter quizzes for this course
    courseDetails.quiz = allQuizzes.filter(quiz => quiz.course && quiz.course.trim() === currentCourse.title.trim());
    // Use global videoSessions and materials if not present in courseDetails
    courseDetails.sessions = (courseDetails.sessions && courseDetails.sessions.length > 0)
        ? courseDetails.sessions
        : allVideoSessions.filter(v => !v.course || v.course === currentCourse.title);
    courseDetails.resources = (courseDetails.resources && courseDetails.resources.length > 0)
        ? courseDetails.resources
        : allMaterials.filter(m => !m.course || m.course === currentCourse.title);
    // Assignments will be handled from assignmentsResource
}

function updateCourseDisplay() {
    if (!currentCourse || !courseDetails) return;
    document.title = `${courseDetails.title || currentCourse.title} - LearnEdge LMS`;
    const titleElement = document.querySelector('.course-title');
    if (titleElement) titleElement.textContent = courseDetails.title || currentCourse.title;
    const descElement = document.querySelector('.course-desc');
    if (descElement) descElement.textContent = courseDetails.description || currentCourse.description || 'Course description will be available soon.';
    const durationElement = document.querySelector('.course-duration');
    if (durationElement) durationElement.textContent = `Duration: ${courseDetails.duration || currentCourse.duration || 'TBD'}`;
    const imageElement = document.querySelector('.course-image');
    if (imageElement) {
        imageElement.src = courseDetails.image || currentCourse.img || currentCourse.image || '../images/Consultant.jpeg';
        imageElement.alt = courseDetails.title || currentCourse.title;
        imageElement.onerror = function() { this.src = '../images/Consultant.jpeg'; };
    }
}

function renderAllSections() {
    renderSessionsSection();
    renderResourcesSection();
    renderAssignmentsSection();
    setupAssignmentEventListeners();
    renderQuizSection(); // will be awaited below
}

// Make renderQuizSection async and always fetch quizSubmissions from backend
async function renderQuizSection() {
    const quizContainer = document.getElementById('quizContainer');
    if (!quizContainer) return;
    const quizzes = (courseDetails.quiz || []).filter(q => {
        if (!quizFilterStatus) return true;
        if (quizFilterStatus === 'pending') return !q.completed && !q.overdue;
        if (quizFilterStatus === 'completed') return q.completed;
        if (quizFilterStatus === 'overdue') return q.overdue;
        return true;
    });
    // Fetch quizSubmissions for the current user
    const userSubmissions = (allQuizSubmissions || []).filter(sub => sub.studentId === loggedInUser.id);
    
    quizContainer.innerHTML = quizzes.length === 0 ? `<div class="empty-state">No quizzes available.</div>` :
        quizzes.map((quiz, idx) => {
            // Check if this quiz is already submitted by the current user
            const submission = userSubmissions.find(sub => sub.quizId === quiz.id);
            if (submission) {
                return `
                <div class="quiz-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 24px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                    <img src="${quiz.image || quiz.img || '../images/quiz.jpeg'}" alt="Quiz Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/quiz.jpeg'">
                    <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 1.2rem; font-weight: 600; color: #1025a1;">${quiz.title}</div>
                        <div style="font-size: 0.95rem; color: #555;">${quiz.description || ''}</div>
                        <div style="font-size: 0.9rem; color: #888;">Due: ${quiz.due || quiz.dueDate || ''}</div>
                        <div style="margin-top: 8px;">
                            <button class="btn btn-outline-primary btn-sm" onclick="viewQuizResult('${submission.id}')">View Result</button>
                        </div>
                    </div>
                </div>
                `;
            } else {
                return `
                <div class="quiz-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 24px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                    <img src="${quiz.image || quiz.img || '../images/quiz.jpeg'}" alt="Quiz Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/quiz.jpeg'">
                    <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 1.2rem; font-weight: 600; color: #1025a1;">${quiz.title}</div>
                        <div style="font-size: 0.95rem; color: #555;">${quiz.description || ''}</div>
                        <div style="font-size: 0.9rem; color: #888;">Due: ${quiz.due || quiz.dueDate || ''}</div>
                        <div style="margin-top: 8px;">
                            <button class="btn btn-primary" onclick="openQuizExamModal('${quiz.id}')">Take Quiz</button>
                        </div>
                    </div>
                </div>
                `;
            }
        }).join('');

    const courseQuizIds = quizzes.map(q => q.id);
    const relevantSubmissions = (allQuizSubmissions || []).filter(sub => courseQuizIds.includes(sub.quizId));
    const totalScore = relevantSubmissions.reduce((acc, sub) => acc + (sub.score || 0), 0);
    const avgScore = relevantSubmissions.length > 0 ? Math.round(totalScore / relevantSubmissions.length) : 0;

    document.getElementById('totalQuizzes').textContent = courseDetails.quiz.length;
    document.getElementById('completedQuizzes').textContent = courseDetails.quiz.filter(q => userSubmissions.some(s => s.quizId === q.id)).length;
    document.getElementById('pendingQuizzes').textContent = courseDetails.quiz.filter(q => !userSubmissions.some(s => s.quizId === q.id)).length;
    document.getElementById('avgScore').textContent = avgScore;


    let completedCount = 0;
    let pendingCount = 0;
    quizzes.forEach(quiz => {
        const submission = userSubmissions.find(sub => sub.title === quiz.title && sub.studentId === loggedInUser.id);
        if (submission) {
            completedCount++;
        } else {
            pendingCount++;
        }
    });
    document.getElementById('totalQuizzes').textContent = quizzes.length;
    document.getElementById('completedQuizzes').textContent = completedCount;
    document.getElementById('pendingQuizzes').textContent = pendingCount;
    document.getElementById('avgScore').textContent = avgScore;
}

function renderSessionsSection() {
    const sessionContainer = document.querySelector('#sessions .session-container');
    if (!sessionContainer) return;
    const sessions = courseDetails.sessions || [];
    sessionContainer.innerHTML = sessions.length === 0 ? `<div class="empty-state">No video sessions available.</div>` :
        sessions.map((session, idx) => `
            <div class="session-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                <img src="${session.image || '../images/videoSessions.jpeg'}" alt="Session Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/videoSessions.jpeg'">
                <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${session.title || 'Untitled Session'}</div>
                    <div style="font-size: 0.95rem; color: #555;">${session.description || ''}</div>
                </div>
                <button class="btn btn-primary" onclick="viewVideoSession('${session.video || session.videoPath || session.path}')">View</button>
            </div>
        `).join('');
}

window.viewVideoSession = function(videoUrl) {
    if (!videoUrl) return alert('No video available.');
    // Create fullscreen modal
    let modal = document.getElementById('videoSessionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'videoSessionModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.95)';
        modal.style.zIndex = '99999';
        modal.style.overflow = 'auto';
        modal.innerHTML = `
            <div style="background:white; margin:40px auto; max-width:900px; border-radius:12px; padding:32px; position:relative; min-height:400px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; align-items:center;">
                <button style="position:absolute; top:16px; right:16px; font-size:1.5em; background:none; border:none; color:#1025a1; cursor:pointer;" onclick="document.getElementById('videoSessionModal').remove()">&times;</button>
                <video controls autoplay style="width:100%; max-width:800px; height:auto; border-radius:10px; background:#000;">
                    <source src="${videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
    }
};

function renderResourcesSection() {
    const resourceContainer = document.querySelector('#resources .resource-container');
    if (!resourceContainer) return;
    const resources = courseDetails.resources || [];
    resourceContainer.innerHTML = resources.length === 0 ? `<div class="empty-state">No resources available.</div>` :
        resources.map((resource, idx) => `
            <div class="resource-card" style="background: #fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(16,37,161,0.08); padding: 20px; margin-bottom: 18px; display: flex; flex-direction: row; align-items: center; gap: 18px; border: 1.5px solid #e0e0e0;">
                <img src="${resource.image || '../images/materials.jpeg'}" alt="Resource Image" style="width: 64px; height: 64px; object-fit: cover; border-radius: 10px; background: #f8f9fa; flex-shrink: 0;" onerror="this.src='../images/materials.jpeg'">
                <div style="flex:1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: #1025a1;">${resource.title || 'Untitled Resource'}</div>
                    <div style="font-size: 0.95rem; color: #555;">${resource.description || ''}</div>
                </div>
                <button class="btn btn-primary" onclick="viewMaterialPDF('${resource.pdf || resource.pdfPath || resource.path}')">View</button>
            </div>
        `).join('');
}

window.viewMaterialPDF = function(pdfUrl) {
    if (!pdfUrl) return alert('No PDF available.');
    // Create fullscreen modal
    let modal = document.getElementById('materialPDFModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'materialPDFModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.95)';
        modal.style.zIndex = '99999';
        modal.style.overflow = 'auto';
        modal.innerHTML = `
            <div style="background:white; margin:40px auto; max-width:900px; border-radius:12px; padding:32px; position:relative; min-height:400px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; align-items:center;">
                <button style="position:absolute; top:16px; right:16px; font-size:1.5em; background:none; border:none; color:#1025a1; cursor:pointer;" onclick="document.getElementById('materialPDFModal').remove()">&times;</button>
                <embed src="${pdfUrl}" type="application/pdf" style="width:100%; max-width:800px; height:80vh; border-radius:10px; background:#f8f9fa;" />
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
    }
};

function renderAssignmentsSection() {
    const assignmentContainer = document.getElementById('assignmentContainer');
    if (!assignmentContainer) return;
    const courseTitle = currentCourse.title.trim().toLowerCase();
    let assignments = (assignmentsResource || []).filter(a => (a.course || '').trim().toLowerCase() === courseTitle);
    // Fetch assignmentSubmissions for the current user
    fetch(`${API_BASE_URL}/assignmentSubmissions?studentId=${loggedInUser.id}`)
        .then(res => res.json())
        .then(submissions => {
            // Stats
            const totalAssignments = assignments.length;
            const completedCount = assignments.filter(a => submissions.some(sub => String(sub.assignmentId) === String(a.id))).length;
            const pendingCount = totalAssignments - completedCount;
            const today = new Date();
            const overdueCount = assignments.filter(a => {
                if (submissions.some(sub => String(sub.assignmentId) === String(a.id))) return false;
                const due = new Date(a.date || a.dueDate);
                return a.date && due < today;
            }).length;
            document.getElementById('totalAssignments').textContent = totalAssignments;
            document.getElementById('completedAssignments').textContent = completedCount;
            document.getElementById('pendingAssignments').textContent = pendingCount;
            document.getElementById('overdueAssignments').textContent = overdueCount;
            assignmentContainer.innerHTML = totalAssignments === 0
                ? '<div class="empty-state">No assignments available.</div>'
                : assignments.map((assignment, idx) => {
                    const submission = submissions.find(sub => String(sub.assignmentId) === String(assignment.id));
                    if (submission) {
                        return `
                        <div class="assignment-card">
                            <div class="assignment-header-card" style="display:flex;align-items:center;gap:10px;">
                                <h3 class="assignment-title" style="margin:0;flex:1;text-align:left;">${assignment.assignment || assignment.title || 'Untitled Assignment'}</h3>
                                <span class="assignment-status" style="margin-left:auto; color: #28a745; font-weight: 600;">Completed</span>
                            </div>
                            <div class="assignment-course">
                                <i class="fas fa-book"></i> ${assignment.course}
                            </div>
                            <div class="assignment-details">
                                <div class="assignment-detail"><strong>Due Date:</strong> <span>${assignment.date || assignment.dueDate || 'TBD'}</span></div>
                            </div>
                            <div class="assignment-actions">
                                <button class="btn btn-outline-primary" onclick="viewAssignmentSubmission('${submission.id}')">View Submission</button>
                            </div>
                        </div>
                        `;
                    } else {
                        // Check if overdue
                        const due = new Date(assignment.date || assignment.dueDate);
                        const isOverdue = assignment.date && due < today;
                        return `
                        <div class="assignment-card">
                            <div class="assignment-header-card" style="display:flex;align-items:center;gap:10px;">
                                <h3 class="assignment-title" style="margin:0;flex:1;text-align:left;">${assignment.assignment || assignment.title || 'Untitled Assignment'}</h3>
                                <span class="assignment-status" style="margin-left:auto; color: ${isOverdue ? '#dc3545' : '#ffc107'}; font-weight: 600;">${isOverdue ? 'Overdue' : 'Pending'}</span>
                            </div>
                            <div class="assignment-course">
                                <i class="fas fa-book"></i> ${assignment.course}
                            </div>
                            <div class="assignment-details">
                                <div class="assignment-detail"><strong>Due Date:</strong> <span>${assignment.date || assignment.dueDate || 'TBD'}</span></div>
                            </div>
                            <div class="assignment-actions">
                                <button class="btn btn-primary" onclick="openAssignmentSubmissionModal('${assignment.id}')">Submit</button>
                            </div>
                        </div>
                        `;
                    }
                }).join('');
        });
}

// Modal functions for Quiz, Session, Resource, Assignment
window.showQuizModal = function(idx) {
    const quiz = courseDetails.quiz[idx];
    if (!quiz) return;
    const modal = document.getElementById('takeQuizModal');
    if (!modal) return;
    document.getElementById('modalQuizTitle').textContent = quiz.title || 'Untitled Quiz';
    document.getElementById('modalQuizInstructions').textContent = quiz.description || quiz.instructions || '';
    document.getElementById('modalQuizDuration').textContent = quiz.duration || 30;
    document.getElementById('modalQuizQuestions').textContent = quiz.questions?.length || 0;
    const questionsContainer = document.getElementById('quizQuestionsContainer');
    questionsContainer.innerHTML = quiz.questions && quiz.questions.length > 0 ?
        quiz.questions.map((q, i) => `
            <div class="question-block">
                <p><b>Q${i+1}:</b> ${q.question}</p>
                ${(q.options || []).map((opt, j) => `
                    <label><input type="radio" name="q${i}" value="${opt}"> ${opt}</label><br>
                `).join('')}
            </div>
        `).join('') : '<p>No questions available.</p>';
    modal.style.display = 'block';
    document.getElementById('closeTakeQuizModal').onclick = () => modal.style.display = 'none';
    document.getElementById('cancelQuiz').onclick = () => modal.style.display = 'none';
    document.getElementById('quizForm').onsubmit = function(e) {
        e.preventDefault();
        alert('Quiz submitted! (Demo only)');
        modal.style.display = 'none';
    };
};

window.showSessionModal = function(idx) {
    const session = courseDetails.sessions[idx];
    if (!session) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h2>Video Session</h2>
                <button onclick="this.closest('.modal-overlay').remove()" class="close">&times;</button>
            </div>
            <div class="modal-content">
                <video controls style="width: 100%; max-width: 800px; height: auto;">
                    <source src="${session.video || session.videoPath || session.path}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <div class="video-info">
                    <h3>${session.title || 'Untitled Session'}</h3>
                    <p>${session.description || ''}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
};

window.showResourceModal = function(idx) {
    const resource = courseDetails.resources[idx];
    if (!resource) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h2>PDF Resource</h2>
                <button onclick="this.closest('.modal-overlay').remove()" class="close">&times;</button>
            </div>
            <div class="modal-content">
                <embed src="${resource.pdf || resource.pdfPath || resource.path}" type="application/pdf" style="width: 100%; height: 500px;">
                <div class="pdf-info">
                    <h3>${resource.title || 'Untitled Resource'}</h3>
                    <p>${resource.description || ''}</p>
                    <a href="${resource.pdf || resource.pdfPath || resource.path}" target="_blank" class="btn btn-primary">
                        <i class="fas fa-download"></i> Download PDF
                    </a>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
};

window.showAssignmentModal = function(idx) {
    const assignment = courseDetails.assignments[idx];
    if (!assignment) return;
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h2>Assignment Submission</h2>
                <button onclick="this.closest('.modal-overlay').remove()" class="close">&times;</button>
            </div>
            <div class="modal-content">
                <div class="assignment-info">
                    <h3>${assignment.title || 'Untitled Assignment'}</h3>
                    <p>${assignment.description || assignment.instructions || ''}</p>
                </div>
                <form id="assignmentForm${idx}">
                    <div class="form-group">
                        <label>Upload File:</label>
                        <input type="file" name="file" accept=".pdf,.doc,.docx,.zip" required>
                        <small>Accepted formats: PDF, DOC, DOCX, ZIP (Max 10MB)</small>
                    </div>
                    <div class="form-group">
                        <label>Comments (Optional):</label>
                        <textarea name="comments" rows="3" placeholder="Add any comments about your submission..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Submit Assignment</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const form = document.getElementById(`assignmentForm${idx}`);
    form.onsubmit = function(e) {
        e.preventDefault();
        alert('Assignment submitted! (Demo only)');
        modal.remove();
    };
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
};

// Assignment submission modal logic for assignments resource
window.showAssignmentSubmissionModalResource = function(idx) {
    const studentName = loggedInUser?.name;
    const courseTitle = currentCourse.title;
    const assignments = (assignmentsResource || []).filter(a => a.course === courseTitle && a.name === studentName);
    const assignment = assignments[idx];
    if (!assignment) return;
    // Modal HTML
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-container" style="background:white; border-radius:12px; max-width:95vw; max-height:95vh; overflow:hidden; width:500px;">
            <div class="modal-header" style="padding:20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <h2><i class='fas fa-upload'></i> Submit Assignment</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#666;">&times;</button>
            </div>
            <div class="modal-content" style="padding:20px; max-height:60vh; overflow-y:auto;">
                <div class="assignment-info">
                    <h3>${assignment.assignment || 'Untitled Assignment'}</h3>
                    <p>${assignment.description || ''}</p>
                    <p><strong>Due Date:</strong> ${assignment.date ? formatDate(assignment.date) : 'TBD'}</p>
                </div>
                <form id="assignmentSubmissionFormResource${idx}">
                    <div class="form-group">
                        <label>Upload Assignment File:</label>
                        <input type="file" name="file" accept=".pdf,.doc,.docx,.txt,.zip,.rar" required>
                        <small>Accepted formats: PDF, DOC, DOCX, TXT, ZIP, RAR (Max 10MB)</small>
                    </div>
                    <div class="form-group">
                        <label>Additional Notes (Optional):</label>
                        <textarea name="notes" rows="3" placeholder="Add any additional comments or notes..."></textarea>
                    </div>
                    <div class="form-actions" style="display:flex; gap:10px; justify-content:flex-end; margin-top:20px;">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Submit Assignment</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    // Submission handler
    const form = document.getElementById(`assignmentSubmissionFormResource${idx}`);
    form.onsubmit = function(e) {
        e.preventDefault();
        // In a real app, save submission to backend/db
        alert('Assignment submitted! (Demo only)');
        modal.remove();
        // Optionally, mark as completed in UI (for demo)
        assignment.status = 'completed';
        renderAssignmentsSection();
    };
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
};

function setupEventListeners() {
    // Quiz search
    const quizSearch = document.getElementById('quizSearch');
    if (quizSearch) {
        quizSearch.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const quizCards = document.querySelectorAll('.quiz-card');
            quizCards.forEach(card => {
                const title = card.querySelector('.quiz-title').textContent.toLowerCase();
                const desc = card.querySelector('p').textContent.toLowerCase();
                card.style.display = (title.includes(searchTerm) || desc.includes(searchTerm)) ? 'block' : 'none';
            });
        });
    }
    // Quiz filter
    const quizStatusFilter = document.getElementById('quizStatusFilter');
    if (quizStatusFilter) {
        quizStatusFilter.addEventListener('change', function(e) {
            quizFilterStatus = e.target.value;
            renderQuizSection();
        });
    }
}

function setupAssignmentEventListeners() {
  const search = document.getElementById('assignmentSearch');
  const filter = document.getElementById('assignmentStatusFilter');
  const refresh = document.getElementById('refreshAssignmentBtn');
  if (search) search.addEventListener('input', renderAssignmentsSection);
  if (filter) filter.addEventListener('change', renderAssignmentsSection);
  if (refresh) refresh.addEventListener('click', () => {
    document.getElementById('assignmentSearch').value = '';
    document.getElementById('assignmentStatusFilter').value = '';
    renderAssignmentsSection();
  });
}

function setupProfileDropdown() {
    const nav = document.querySelector('nav');
    const profileBtn = nav?.querySelector('.btn1');
    if (loggedInUser && profileBtn) {
        const names = loggedInUser.name.split(' ');
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
        profileBtnNew.addEventListener('click', function() {
            dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
        });
        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target)) {
                dropdownContent.style.display = 'none';
            }
        });
    }
}

function showError(message) {
    alert('Error: ' + message);
}

window.logoutUser = function() {
    localStorage.clear();
    sessionStorage.clear();
    alert('You have been logged out.');
    window.location.href = '/HTML/login.html';
};

// Add some basic styles
const styles = `
    .content-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease;
    }
    
    .content-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }
    
    .content-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .content-type {
        background: #f8f9fa;
        padding: 5px 10px;
        border-radius: 20px;
        font-size: 12px;
        color: #666;
    }
    
    .content-body p {
        margin: 8px 0;
        color: #666;
    }
    
    .content-actions {
        margin-top: 15px;
    }
    
    .btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;
    }
    
    .btn-primary {
        background: #007bff;
        color: white;
    }
    
    .btn-primary:hover {
        background: #0056b3;
    }
    
    .btn-secondary {
        background: #6c757d;
        color: white;
    }
    
    .btn-secondary:hover {
        background: #545b62;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }
    
    .empty-state i {
        font-size: 48px;
        margin-bottom: 20px;
        color: #ddd;
    }
    
    .error-content {
        text-align: center;
        padding: 40px 20px;
        color: #666;
    }
    
    .error-content i {
        font-size: 48px;
        margin-bottom: 20px;
        color: #dc3545;
    }
    
    .form-group {
        margin-bottom: 15px;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
    }
    
    .form-group input,
    .form-group textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
    }
    
    .video-container,
    .pdf-container {
        text-align: center;
    }
    
    .video-info,
    .pdf-info {
        margin-top: 20px;
        text-align: left;
    }
    
    .quiz-info {
        text-align: center;
    }
    
    .quiz-details {
        margin-top: 20px;
        text-align: left;
    }
    
    .assignment-container {
        text-align: left;
    }
    
    .assignment-info {
        margin-bottom: 30px;
    }
    
    .assignment-submission h4 {
        margin-bottom: 15px;
    }
    
    @media (max-width: 768px) {
        .modal-container {
            width: 95vw !important;
            margin: 10px;
        }
        
        .content-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
        }
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Add the openQuizExamModal function to window
window.openQuizExamModal = async function(quizId) {
    const quiz = (courseDetails.quiz || []).find(q => String(q.id) === String(quizId));
    if (!quiz) return;
    // Create modal
    let modal = document.getElementById('quizExamModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quizExamModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.9)';
        modal.style.zIndex = '99999';
        modal.style.overflow = 'auto'; // Allow scrolling
        modal.innerHTML = `
            <div id="quizExamContent" style="background:white; margin:40px auto; max-width:700px; border-radius:12px; padding:32px; position:relative; min-height:400px; max-height:90vh; overflow-y:auto;">
                <h2 id="quizExamTitle"></h2>
                <div id="quizExamTimer" style="font-size:1.3em; font-weight:bold; margin-bottom:16px;"></div>
                <form id="quizExamForm"></form>
                <div style="margin-top:24px; text-align:right;">
                    <button type="button" class="btn btn-secondary" id="quizExamCancel">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="quizExamSubmit">Submit</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
    }
    // Fullscreen
    if (modal.requestFullscreen) {
        modal.requestFullscreen();
    } else if (modal.webkitRequestFullscreen) {
        modal.webkitRequestFullscreen();
    } else if (modal.msRequestFullscreen) {
        modal.msRequestFullscreen();
    }
    // Render quiz
    document.getElementById('quizExamTitle').textContent = quiz.title;
    let timeRemaining = (quiz.duration || 20) * 60;
    const timerEl = document.getElementById('quizExamTimer');
    function updateTimer() {
        const min = Math.floor(timeRemaining / 60);
        const sec = timeRemaining % 60;
        timerEl.textContent = `Time Remaining: ${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        if (timeRemaining <= 0) {
            submitQuizExam(true);
        }
    }
    updateTimer();
    let timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimer();
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
    // Render questions
    const form = document.getElementById('quizExamForm');
    form.innerHTML = quiz.questions.map((q, i) => `
        <div class="question-block" style="margin-bottom:18px;">
            <p><b>Q${i+1}:</b> ${q.question}</p>
            ${(q.options || []).map((opt, j) => `
                <label style="display:block; margin-bottom:4px;">
                    <input type="radio" name="q${q.id}" value="${j}"> ${opt}
                </label>
            `).join('')}
        </div>
    `).join('');
    // Cancel button
    document.getElementById('quizExamCancel').onclick = function() {
        submitQuizExam(true);
    };
    // Submit button
    form.onsubmit = function(e) {
        e.preventDefault();
        submitQuizExam(false);
    };
    // Escape key and fullscreen exit
    function escOrExitHandler(e) {
        if ((e.key && e.key === 'Escape') || document.fullscreenElement === null) {
            submitQuizExam(true);
        }
    }
    document.addEventListener('keydown', escOrExitHandler);
    document.addEventListener('fullscreenchange', escOrExitHandler);
    document.addEventListener('webkitfullscreenchange', escOrExitHandler);
    document.addEventListener('msfullscreenchange', escOrExitHandler);
    // Submission logic
    let submitted = false;
    async function submitQuizExam(isAuto) {
        if (submitted) return; // Prevent double submit
        submitted = true;
        clearInterval(timerInterval);
        // Collect answers
        const answers = quiz.questions.map(q => {
            const selected = form.querySelector(`input[name='q${q.id}']:checked`);
            return {
                questionId: q.id,
                selectedAnswer: selected ? parseInt(selected.value) : null
            };
        });
        // Calculate score
        let correct = 0;
        answers.forEach(ans => {
            const q = quiz.questions.find(qz => qz.id === ans.questionId);
            if (q && ans.selectedAnswer === q.correctAnswer) correct++;
        });
        const score = Math.round((correct / quiz.questions.length) * (quiz.maxScore || 100));
        // Build submission
        const submission = {
            id: `SUB${Date.now()}`,
            quizId: quiz.id,
            course: quiz.course,
            title: quiz.title,
            studentId: loggedInUser.id,
            studentName: loggedInUser.name,
            studentEmail: loggedInUser.email,
            answers: answers,
            score: score,
            maxScore: quiz.maxScore || 100,
            timeTaken: (quiz.duration || 20) - Math.floor(timeRemaining / 60),
            submittedAt: new Date().toISOString(),
            status: 'completed',
            feedback: ''
        };
        // Save to db.json (quizSubmissions)
        try {
            await fetch(`${API_BASE_URL}/quizSubmissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submission)
            });
        } catch (err) { console.error('Failed to save quiz submission:', err); }
        // Close modal and exit fullscreen
        if (modal) {
            modal.style.display = 'none';
            setTimeout(() => { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); }, 200);
        }
        if (document.fullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
        document.removeEventListener('keydown', escOrExitHandler);
        document.removeEventListener('fullscreenchange', escOrExitHandler);
        document.removeEventListener('webkitfullscreenchange', escOrExitHandler);
        document.removeEventListener('msfullscreenchange', escOrExitHandler);
        clearInterval(timerInterval);
        alert('Quiz submitted!');
    }
};

// Add a global function to view quiz result
window.viewQuizResult = function(submissionId) {
    // Fetch the submission and show a modal or alert with the result
    fetch(`${API_BASE_URL}/quizSubmissions`)
        .then(res => res.json())
        .then(data => {
            const submissions = Array.isArray(data) ? data.flat() : [];
            const submission = submissions.find(sub => sub.id === submissionId);
            if (submission) {
                alert(`Quiz: ${submission.title}\nScore: ${submission.score}/${submission.maxScore}\nStatus: ${submission.status}`);
            } else {
                alert('Result not found.');
            }
        });
}

window.openAssignmentSubmissionModal = async function(assignmentId) {
    // Find assignment from merged list
    let assignment = (assignmentsResource || []).find(a => String(a.id) === String(assignmentId));
    if (!assignment && courseDetails && courseDetails.assignments) {
        assignment = (courseDetails.assignments || []).find(a => String(a.id) === String(assignmentId));
    }
    if (!assignment) return;
    // Create modal
    let modal = document.getElementById('assignmentSubmissionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'assignmentSubmissionModal';
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
        modal.innerHTML = `
            <div id="assignmentSubmissionContent" style="background:white; margin:40px auto; max-width:700px; border-radius:12px; padding:32px; position:relative; min-height:200px; max-height:90vh; overflow-y:auto;">
                <h2 id="assignmentSubmissionTitle"></h2>
                <div id="assignmentSubmissionDesc" style="margin-bottom:16px;"></div>
                <div id="assignmentSubmissionPDF" style="margin-bottom:16px;"></div>
                <form id="assignmentSubmissionForm">
                    <div class="form-group">
                        <label for="assignmentFile">Upload Assignment File (PDF only):</label>
                        <input id="assignmentFile" name="assignmentFile" type="file" accept=".pdf" required />
                    </div>
                    <div style="margin-top:24px; text-align:right;">
                        <button type="button" class="btn btn-secondary" id="assignmentSubmissionCancel">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="assignmentSubmissionSubmit">Submit</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = 'block';
    }
    document.getElementById('assignmentSubmissionTitle').textContent = assignment.assignment || assignment.title;
    document.getElementById('assignmentSubmissionDesc').textContent = assignment.description || assignment.instructions || '';
    // PDF download link if available
    let pdfUrl = assignment.pdf || assignment.pdfPath || assignment.file || '';
    document.getElementById('assignmentSubmissionPDF').innerHTML = pdfUrl ? `<a href="${pdfUrl}" target="_blank" class="btn btn-outline-primary">Download Assignment PDF</a>` : '';
    // Cancel button
    document.getElementById('assignmentSubmissionCancel').onclick = function() {
        modal.style.display = 'none';
        setTimeout(() => { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); }, 200);
    };
    // Submit button
    document.getElementById('assignmentSubmissionForm').onsubmit = async function(e) {
        e.preventDefault();
        const fileInput = document.getElementById('assignmentFile');
        if (!fileInput.files[0]) return alert('Please select a PDF file to upload.');
        const file = fileInput.files[0];
        // Simulate file upload by storing file name (real app would upload to server or cloud)
        const submission = {
            id: `ASUB${Date.now()}`,
            assignmentId: assignment.id,
            course: assignment.course,
            title: assignment.assignment || assignment.title,
            studentId: loggedInUser.id,
            studentName: loggedInUser.name,
            studentEmail: loggedInUser.email,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            submittedAt: new Date().toISOString(),
            status: 'completed',
            feedback: ''
        };
        // Save to backend
        try {
            await fetch(`${API_BASE_URL}/assignmentSubmissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submission)
            });
            // Update assignment status in assignments resource
            // Fetch all assignments, update the status, and PUT back
            const assignmentsRes = await fetch(`${API_BASE_URL}/assignments`);
            let assignmentsArr = assignmentsRes.ok ? await assignmentsRes.json() : [];
            assignmentsArr = assignmentsArr.map(a =>
                String(a.id) === String(assignment.id) ? { ...a, status: 'completed' } : a
            );
            await fetch(`${API_BASE_URL}/assignments`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assignmentsArr)
            });
        } catch (err) { console.error('Failed to save assignment submission or update status:', err); }
        modal.style.display = 'none';
        setTimeout(() => { if (modal && modal.parentNode) modal.parentNode.removeChild(modal); }, 200);
        alert('Assignment submitted!');
        renderAssignmentsSection();
    };
};

window.viewAssignmentSubmission = function(submissionId) {
    fetch(`${API_BASE_URL}/assignmentSubmissions`)
        .then(res => res.json())
        .then(data => {
            const submission = data.find(sub => sub.id === submissionId);
            if (submission) {
                let fileLink = submission.fileName ? `<a href="#" download="${submission.fileName}" style="color:#1025a1;">${submission.fileName}</a>` : 'No file uploaded';
                // Show in a modal or alert (for now, alert)
                alert(`Assignment: ${submission.title}\nStatus: ${submission.status}\nSubmitted File: ${submission.fileName ? submission.fileName : 'No file uploaded'}`);
                // For a real modal, you could render fileLink as HTML
            } else {
                alert('Submission not found.');
            }
        });
}