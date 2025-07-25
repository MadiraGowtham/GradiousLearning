// Quiz Management System - Robust Version
class QuizManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.currentRole = this.currentUser.role;
        this.quizzes = [];
        this.submissions = [];
        this.courses = [];
        this.currentQuiz = null;
        this.quizTimer = null;
        this.timeRemaining = 0;
        this.currentSubmission = null;
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.checkURLParams();
        this.updateUI();
    }

    getCurrentUser() {
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
        if (loggedInUser) {
            return {
                id: loggedInUser.id || 'STD1000',
                name: loggedInUser.name || 'John Doe',
                role: loggedInUser.type || 'student',
                email: loggedInUser.email || 'john.doe@example.com'
            };
        }
        return {
            id: 'STD1000',
            name: 'John Doe',
            role: 'student',
            email: 'john.doe@example.com'
        };
    }

    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const quizId = urlParams.get('quizId');
        this.updateRoleDisplay();
        if (quizId) {
            const quizData = JSON.parse(localStorage.getItem('currentQuiz'));
            if (quizData) {
                this.currentQuiz = quizData;
            }
        }
    }

    updateRoleDisplay() {
        const roleBadge = document.getElementById('roleBadge');
        if (roleBadge) {
            if (this.currentRole === 'teacher') {
                roleBadge.innerHTML = '<i class="fas fa-chalkboard-teacher"></i> Teacher View';
                roleBadge.className = 'role-badge teacher';
            } else {
                roleBadge.innerHTML = '<i class="fas fa-user-graduate"></i> Student View';
                roleBadge.className = 'role-badge student';
            }
        }
    }

    async loadData() {
        try {
            // 1. Load teacher or student courses
            if (this.currentRole === 'teacher') {
                this.courses = await this.getTeacherCourses();
            } else {
                this.courses = await this.getStudentEnrolledCourses();
            }

            // 2. Load quizzes and submissions from db.json
            const dbResponse = await fetch('http://localhost:2000/db.json');
            let quizzes = [];
            let submissions = [];
            if (dbResponse.ok) {
                const dbData = await dbResponse.json();
                quizzes = dbData.quizzes || [];
                submissions = dbData.quizSubmissions || [];
            }

            // 3. Map quizzes robustly: for each course, collect all quizzes with matching course property
            this.quizzes = [];
            this.courses.forEach(courseName => {
                const courseQuizzes = quizzes.filter(q => q.course && q.course.trim() === courseName.trim());
                this.quizzes.push(...courseQuizzes);
            });

            // 4. Load and map submissions as before
            this.submissions = submissions;

            // 5. Update UI
            this.updateUI();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load quiz data');
        }
    }

    async getTeacherCourses() {
        try {
            const teachersResponse = await fetch('http://localhost:2000/teachers');
            if (teachersResponse.ok) {
                const teachers = await teachersResponse.json();
                const currentTeacher = teachers.find(teacher => 
                    teacher.email === this.currentUser.email || 
                    teacher.id === this.currentUser.id
                );
                if (currentTeacher && currentTeacher.courses) {
                    return currentTeacher.courses;
                }
            }
            // Fallback: return all courses
            const dbResponse = await fetch('http://localhost:2000/db.json');
            if (dbResponse.ok) {
                const dbData = await dbResponse.json();
                return (dbData.quizzes || []).map(q => q.course).filter((v, i, a) => a.indexOf(v) === i);
            }
            return [];
        } catch (error) {
            console.error('Error getting teacher courses:', error);
            return [];
        }
    }

    async getStudentEnrolledCourses() {
        try {
            const studentsResponse = await fetch('http://localhost:2000/students');
            if (studentsResponse.ok) {
                const students = await studentsResponse.json();
                const currentStudent = students.find(student => 
                    student.email === this.currentUser.email || 
                    student.id === this.currentUser.id
                );
                if (currentStudent) {
                    const enrollmentsResponse = await fetch('http://localhost:2000/enrollments');
                    if (enrollmentsResponse.ok) {
                        const enrollments = await enrollmentsResponse.json();
                        const studentEnrollments = enrollments.filter(enrollment => 
                            enrollment.studentId === currentStudent.id
                        );
                        if (studentEnrollments.length > 0) {
                            return studentEnrollments.map(e => e.courseTitle);
                        }
                    }
                }
            }
            return [];
        } catch (error) {
            console.error('Error getting student courses:', error);
            return [];
        }
    }

    setupEventListeners() {
        this.setupProfileDropdown();
        document.getElementById('courseFilter')?.addEventListener('change', () => this.filterQuizzes());
        document.getElementById('statusFilter')?.addEventListener('change', () => this.filterQuizzes());
        document.getElementById('teacherCourseFilter')?.addEventListener('change', () => this.updateTeacherView());
        document.getElementById('teacherStatusFilter')?.addEventListener('change', () => this.filterSubmissions());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadData());
        document.getElementById('createQuizBtn')?.addEventListener('click', () => this.showCreateQuizModal());
        document.getElementById('closeTakeQuizModal')?.addEventListener('click', () => this.closeModal('takeQuizModal'));
        document.getElementById('closeCreateModal')?.addEventListener('click', () => this.closeModal('createQuizModal'));
        document.getElementById('closeGradeModal')?.addEventListener('click', () => this.closeModal('gradeModal'));
        document.getElementById('closeResultsModal')?.addEventListener('click', () => this.closeModal('quizResultsModal'));
        document.getElementById('closeDetailsModal')?.addEventListener('click', () => this.closeModal('quizDetailsModal'));
        document.getElementById('quizForm')?.addEventListener('submit', (e) => this.submitQuiz(e));
        document.getElementById('createQuizForm')?.addEventListener('submit', (e) => this.createQuiz(e));
        document.getElementById('gradeForm')?.addEventListener('submit', (e) => this.gradeSubmission(e));
        document.getElementById('cancelQuiz')?.addEventListener('click', () => this.closeModal('takeQuizModal'));
        document.getElementById('cancelCreate')?.addEventListener('click', () => this.closeModal('createQuizModal'));
        document.getElementById('cancelGrade')?.addEventListener('click', () => this.closeModal('gradeModal'));
        document.getElementById('addQuestionBtn')?.addEventListener('click', () => this.addQuestion());
        document.getElementById('quizSearch')?.addEventListener('input', (e) => this.searchQuizzes(e.target.value));
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    setupProfileDropdown() {
        const profileBtn = document.getElementById('profileBtn');
        const dropdownContent = document.querySelector('.dropdown-content');
        
        if (profileBtn && dropdownContent) {
            profileBtn.addEventListener('click', () => {
                dropdownContent.style.display = dropdownContent.style.display === 'block' ? 'none' : 'block';
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.profile-dropdown')) {
                    dropdownContent.style.display = 'none';
                }
            });
        }
    }

    logoutUser() {
        localStorage.clear();
        sessionStorage.clear();
        alert('You have been logged out.');
        window.location.href = '/HTML/login.html';
    }

    async updateUI() {
        if (this.currentRole === 'teacher') {
            await this.updateTeacherView();
        } else {
            await this.updateStudentView();
        }
        
        this.populateCourseFilter();
        this.populateTeacherCourseFilter();
    }

    async updateStudentView() {
        // Only show quizzes for the student's enrolled courses
        const filteredQuizzes = this.quizzes.filter(quiz => this.courses.includes(quiz.course));
        const studentView = document.getElementById('studentView');
        const teacherView = document.getElementById('teacherView');
        
        if (studentView && teacherView) {
            studentView.classList.remove('hidden');
            teacherView.classList.add('hidden');
        }
        
        this.updateStudentStats();
        this.renderStudentQuizzes(filteredQuizzes);
    }

    renderTeacherQuizzes(quizzes) {
        const grid = document.getElementById('teacherQuizzesGrid');
        if (!grid) return;
        if (quizzes.length === 0) {
            grid.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>No quizzes found for your courses.</h3><p>Check your course mapping or add quizzes for your courses.</p></div>`;
            return;
        }
        grid.innerHTML = quizzes.map(quiz => `
            <div class="quiz-card">
                <div class="quiz-header-card">
                    <h3 class="quiz-title">${quiz.title}</h3>
                    <span class="quiz-status">${quiz.status || 'active'}</span>
                </div>
                <div class="quiz-course"><i class="fas fa-book"></i> ${quiz.course}</div>
                <div class="quiz-details">
                    <div class="quiz-detail"><strong>Description:</strong> ${quiz.description || ''}</div>
                    <div class="quiz-detail"><strong>Due Date:</strong> ${this.formatDate(quiz.dueDate)}</div>
                    <div class="quiz-detail"><strong>Questions:</strong> ${quiz.questions.length}</div>
                    <div class="quiz-detail"><strong>Duration:</strong> ${quiz.duration} minutes</div>
                    <div class="quiz-detail"><strong>Max Score:</strong> ${quiz.maxScore} points</div>
                </div>
                <div class="quiz-actions">
                    <button class="btn" onclick="quizManager.viewQuizDetails('${quiz.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateTeacherView() {
        const teacherCourseFilter = document.getElementById('teacherCourseFilter');
        let selectedCourse = '';
        if (teacherCourseFilter) {
            selectedCourse = teacherCourseFilter.value;
            if (!selectedCourse && this.courses.length > 0) {
                teacherCourseFilter.selectedIndex = 1;
                selectedCourse = this.courses[0];
            }
        }
        let filteredQuizzes = this.quizzes;
        if (selectedCourse) {
            filteredQuizzes = filteredQuizzes.filter(quiz => quiz.course && quiz.course.trim() === selectedCourse.trim());
        }
        // Debug logs for troubleshooting
        console.log('Teacher courses:', this.courses);
        console.log('All quizzes:', this.quizzes.map(q => ({course: q.course, title: q.title, id: q.id})));
        console.log('Filtered quizzes for teacher:', filteredQuizzes.map(q => ({course: q.course, title: q.title, id: q.id})));
        const studentView = document.getElementById('studentView');
        const teacherView = document.getElementById('teacherView');
        if (studentView && teacherView) {
            studentView.classList.add('hidden');
            teacherView.classList.remove('hidden');
        }
        const coursesList = document.getElementById('teacherCoursesList');
        if (coursesList) {
            coursesList.innerHTML = this.courses.map(
                c => `<span class="course-badge">${c}</span>`
            ).join('');
        }
        this.updateTeacherStats();
        this.renderTeacherQuizzes(filteredQuizzes);
        this.renderTeacherSubmissions();
        // Show a user-facing message if no quizzes are found
        if (filteredQuizzes.length === 0) {
            const grid = document.getElementById('teacherQuizzesGrid');
            if (grid) {
                grid.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>No quizzes found for your courses.</h3><p>Check your course mapping or add quizzes for your courses.</p></div>`;
            }
        }
    }

    async updateStudentStats() {
        const userSubmissions = this.submissions.filter(sub => sub.studentId === this.currentUser.id);
        const completedCount = userSubmissions.length;
        const pendingCount = this.quizzes.filter(quiz => 
            !userSubmissions.some(sub => sub.quizId === quiz.id)
        ).length;
        
        const avgScore = userSubmissions.length > 0 
            ? Math.round(userSubmissions.reduce((sum, sub) => sum + sub.score, 0) / userSubmissions.length)
            : 0;
        
        document.getElementById('completedCount').textContent = completedCount;
        document.getElementById('pendingCount').textContent = pendingCount;
        document.getElementById('avgScore').textContent = avgScore;
    }

    updateTeacherStats() {
        const totalQuizzes = this.quizzes.length;
        const totalStudents = new Set(this.submissions.map(sub => sub.studentId)).size;
        const avgScore = this.submissions.length > 0 
            ? Math.round(this.submissions.reduce((sum, sub) => sum + sub.score, 0) / this.submissions.length)
            : 0;
        
        document.getElementById('totalQuizzes').textContent = totalQuizzes;
        document.getElementById('totalStudents').textContent = totalStudents;
        document.getElementById('avgScore').textContent = avgScore;
    }

    populateCourseFilter() {
        const courseFilter = document.getElementById('courseFilter');
        if (courseFilter) {
            courseFilter.innerHTML = '<option value="">All Courses</option>';
            this.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                courseFilter.appendChild(option);
            });
        }
    }

    populateTeacherCourseFilter() {
        const teacherCourseFilter = document.getElementById('teacherCourseFilter');
        if (teacherCourseFilter) {
            teacherCourseFilter.innerHTML = '<option value="">All Courses</option>';
            this.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                teacherCourseFilter.appendChild(option);
            });
            if (this.courses.length > 0) {
                teacherCourseFilter.selectedIndex = 1;
            }
        }
    }

    renderStudentQuizzes(quizzes) {
        const grid = document.getElementById('studentQuizzesGrid');
        if (!grid) return;
        
        if (quizzes.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-question-circle"></i>
                    <h3>No quizzes available</h3>
                    <p>There are no quizzes available for your enrolled courses.</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = quizzes.map(quiz => {
            const submission = this.submissions.find(sub => 
                sub.quizId === quiz.id && sub.studentId === this.currentUser.id
            );
            const status = this.getQuizStatus(quiz, submission);
            const statusClass = this.getStatusClass(status);
            return `
                <div class="quiz-card ${statusClass}">
                    <div class="quiz-header-card">
                        <h3 class="quiz-title">${quiz.title}</h3>
                        <span class="quiz-status status-${statusClass}">${status}</span>
                    </div>
                    <div class="quiz-course">
                        <i class="fas fa-book"></i> ${quiz.course}
                    </div>
                    <div class="quiz-details">
                        <div class="quiz-detail">
                            <strong>Description:</strong> <span>${quiz.description || ''}</span>
                        </div>
                        <div class="quiz-detail">
                            <strong>Due Date:</strong> <span>${this.formatDate(quiz.dueDate)}</span>
                        </div>
                        <div class="quiz-detail">
                            <strong>Questions:</strong> <span>${quiz.questions.length}</span>
                        </div>
                        <div class="quiz-detail">
                            <strong>Duration:</strong> <span>${quiz.duration} minutes</span>
                        </div>
                        <div class="quiz-detail">
                            <strong>Max Score:</strong> <span>${quiz.maxScore} points</span>
                        </div>
                        ${submission && submission.score !== null ? `
                            <div class="quiz-detail">
                                <strong>Your Score:</strong> <span>${submission.score}/${quiz.maxScore}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="quiz-actions">
                        <button class="btn" onclick="quizManager.viewQuizDetails('${quiz.id}')">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                        ${!submission ? `
                            <button class="btn" onclick="quizManager.takeQuiz('${quiz.id}')">
                                <i class="fas fa-edit"></i> Take Quiz
                            </button>
                        ` : submission ? `
                            <button class="btn" onclick="quizManager.viewResults('${submission.id}')">
                                <i class="fas fa-star"></i> View Results
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTeacherSubmissions() {
        const container = document.getElementById('teacherSubmissionsContainer');
        if (!container) return;
        
        const filteredSubmissions = this.getFilteredSubmissions();
        
        if (filteredSubmissions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No submissions yet</h3>
                    <p>Students haven't submitted any quiz attempts yet.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        filteredSubmissions.forEach(submission => {
            const quiz = this.quizzes.find(q => q.id === submission.quizId);
            if (!quiz) return;
            
            const submissionItem = document.createElement('div');
            submissionItem.className = 'submission-item';
            
            const initials = submission.studentName.split(' ').map(n => n[0]).join('').toUpperCase();
            
            submissionItem.innerHTML = `
                <div class="student-info">
                    <div class="student-avatar">${initials}</div>
                    <div class="student-details">
                        <h4>${submission.studentName}</h4>
                        <p>${submission.studentEmail}</p>
                    </div>
                </div>
                <div class="quiz-info">
                    <h4>${quiz.title}</h4>
                    <p>${quiz.course}</p>
                </div>
                <div class="submission-status status-${submission.status}">
                    ${submission.status}
                </div>
                <div class="submission-score">
                    ${submission.score}/${submission.maxScore}
                </div>
                <div class="submission-actions">
                    <button class="btn" onclick="quizManager.viewSubmission('${submission.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    ${submission.status === 'submitted' ? `
                        <button class="btn" onclick="quizManager.showGradeModal('${submission.id}')">
                            <i class="fas fa-star"></i> Grade
                        </button>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(submissionItem);
        });
    }

    getFilteredQuizzes() {
        const courseFilter = document.getElementById('courseFilter')?.value;
        const statusFilter = document.getElementById('statusFilter')?.value;
        
        return this.quizzes.filter(quiz => {
            const courseMatch = !courseFilter || quiz.course === courseFilter;
            const submission = this.submissions.find(sub => 
                sub.quizId === quiz.id && sub.studentId === this.currentUser.id
            );
            const status = this.getQuizStatus(quiz, submission);
            const statusMatch = !statusFilter || status === statusFilter;
            
            return courseMatch && statusMatch;
        });
    }

    getFilteredSubmissions() {
        const courseFilter = document.getElementById('teacherCourseFilter')?.value;
        const statusFilter = document.getElementById('teacherStatusFilter')?.value;
        
        return this.submissions.filter(submission => {
            const quiz = this.quizzes.find(q => q.id === submission.quizId);
            if (!quiz) return false;
            
            const courseMatch = !courseFilter || quiz.course === courseFilter;
            const statusMatch = !statusFilter || submission.status === statusFilter;
            
            return courseMatch && statusMatch;
        });
    }

    filterQuizzes() {
        const filteredQuizzes = this.getFilteredQuizzes();
        this.renderStudentQuizzes(filteredQuizzes);
    }

    filterSubmissions() {
        this.renderTeacherSubmissions();
    }

    getQuizStatus(quiz, submission) {
        if (submission) {
            return 'completed';
        }
        
        const now = new Date();
        const dueDate = new Date(quiz.dueDate);
        
        if (now > dueDate) {
            return 'overdue';
        }
        
        return 'pending';
    }

    getStatusClass(status) {
        switch (status) {
            case 'completed': return 'completed';
            case 'overdue': return 'overdue';
            case 'pending': return 'pending';
            default: return 'pending';
        }
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    takeQuiz(quizId) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        if (!quiz) return;
        this.currentQuiz = quiz;
        // Always use 20 minutes if not specified
        this.timeRemaining = (quiz.duration ? quiz.duration : 20) * 60;
        
        // Populate modal
        document.getElementById('modalQuizTitle').textContent = quiz.title;
        document.getElementById('modalQuizInstructions').textContent = quiz.instructions;
        document.getElementById('modalQuizDuration').textContent = `${quiz.duration} minutes`;
        document.getElementById('modalQuizQuestions').textContent = quiz.questions.length;
        
        // Render questions
        this.renderQuizQuestions(quiz);
        
        // Start timer
        this.startTimer();
        
        // Show modal
        document.getElementById('takeQuizModal').style.display = 'block';
    }

    renderQuizQuestions(quiz) {
        const container = document.getElementById('quizQuestionsContainer');
        container.innerHTML = '';
        
        quiz.questions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'question';
            
            questionDiv.innerHTML = `
                <h4>Question ${index + 1}: ${question.question}</h4>
                <div class="options">
                    ${question.options.map((option, optionIndex) => `
                        <label class="option">
                            <input type="radio" name="q${question.id}" value="${optionIndex}" required>
                            ${option}
                        </label>
                    `).join('')}
                </div>
            `;
            
            container.appendChild(questionDiv);
        });
    }

    startTimer() {
        this.updateTimerDisplay();
        
        this.quizTimer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                this.submitQuiz();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('timeRemaining').textContent = display;
        
        // Change color when time is running low
        const timerElement = document.getElementById('quizTimer');
        if (this.timeRemaining <= 300) { // 5 minutes
            timerElement.style.background = 'rgba(220, 53, 69, 0.8)';
        } else if (this.timeRemaining <= 600) { // 10 minutes
            timerElement.style.background = 'rgba(255, 193, 7, 0.8)';
        }
    }

    async submitQuiz(event) {
        if (event) event.preventDefault();
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
        if (!this.currentQuiz) return;
        // Prevent duplicate submissions for the same quiz and user
        if (this.submissions.some(sub => sub.quizId === this.currentQuiz.id && sub.studentId === this.currentUser.id)) {
            this.closeModal('takeQuizModal');
            return;
        }
        // Collect answers
        const answers = [];
        this.currentQuiz.questions.forEach(question => {
            const selected = document.querySelector(`input[name="q${question.id}"]:checked`);
            answers.push({
                questionId: question.id,
                selectedAnswer: selected ? parseInt(selected.value) : null
            });
        });
        
        // Calculate score
        const score = this.calculateScore(answers);
        const timeTaken = this.currentQuiz.duration - Math.floor(this.timeRemaining / 60);
        
        // Create submission
        const submission = {
            id: `SUB${Date.now()}`,
            quizId: this.currentQuiz.id,
            course: this.currentQuiz.course,
            title: this.currentQuiz.title,
            studentId: this.currentUser.id,
            studentName: this.currentUser.name,
            studentEmail: this.currentUser.email,
            answers: answers,
            score: score,
            maxScore: this.currentQuiz.maxScore,
            timeTaken: this.currentQuiz.duration - Math.floor(this.timeRemaining / 60),
            submittedAt: new Date().toISOString(),
            status: 'submitted',
            feedback: ''
        };
        this.submissions.push(submission);
        await this.saveSubmissionsToDB();
        // --- FINAL ASSESSMENT & CERTIFICATION LOGIC ---
        if (this.currentQuiz.final === true && Math.round((score / this.currentQuiz.maxScore) * 100) >= 75) {
            // Remove enrollment for this course
            try {
                // Get all enrollments for this student and course
                const enrollmentsRes = await fetch(`http://localhost:2000/enrollments?studentId=${this.currentUser.id}&courseTitle=${encodeURIComponent(this.currentQuiz.course)}`);
                const enrollments = await enrollmentsRes.json();
                for (const enrollment of enrollments) {
                    await fetch(`http://localhost:2000/enrollments/${enrollment.id}`, { method: 'DELETE' });
                }
            } catch (err) { console.error('Error removing enrollment:', err); }
            // Add certificate
            try {
                const cert = {
                    id: `CERT${Date.now()}`,
                    studentId: this.currentUser.id,
                    studentName: this.currentUser.name,
                    courseTitle: this.currentQuiz.course,
                    date: new Date().toISOString(),
                    url: '', // To be filled with downloadable link later
                };
                await fetch('http://localhost:2000/certificates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cert)
                });
            } catch (err) { console.error('Error adding certificate:', err); }
        }
        // --- END FINAL ASSESSMENT LOGIC ---
        this.closeModal('takeQuizModal');
        this.showQuizResults(submission);
        this.updateUI();
        this.showSuccess('Quiz submitted successfully!');
    }

    calculateScore(answers) {
        let correctAnswers = 0;
        
        answers.forEach(answer => {
            const question = this.currentQuiz.questions.find(q => q.id === answer.questionId);
            if (question && answer.selectedAnswer === question.correctAnswer) {
                correctAnswers++;
            }
        });
        
        return Math.round((correctAnswers / this.currentQuiz.questions.length) * this.currentQuiz.maxScore);
    }

    showQuizResults(submission) {
        const quiz = this.quizzes.find(q => q.id === submission.quizId);
        if (!quiz) return;
        
        // Populate results modal
        document.getElementById('resultsQuizTitle').textContent = quiz.title;
        document.getElementById('resultsScore').textContent = `${submission.score}/${submission.maxScore}`;
        document.getElementById('resultsPercentage').textContent = `${Math.round((submission.score / submission.maxScore) * 100)}%`;
        document.getElementById('resultsTimeTaken').textContent = `${submission.timeTaken} minutes`;
        
        // Render question review
        this.renderQuestionReview(submission, quiz);
        
        // Show modal
        document.getElementById('quizResultsModal').style.display = 'block';
    }

    renderQuestionReview(submission, quiz) {
        const container = document.getElementById('questionReviewContainer');
        container.innerHTML = '';
        
        submission.answers.forEach(answer => {
            const question = quiz.questions.find(q => q.id === answer.questionId);
            if (!question) return;
            
            const isCorrect = answer.selectedAnswer === question.correctAnswer;
            const questionDiv = document.createElement('div');
            questionDiv.className = `review-question ${isCorrect ? 'correct' : 'incorrect'}`;
            
            questionDiv.innerHTML = `
                <h5>${question.question}</h5>
                ${question.options.map((option, index) => {
                    let className = 'review-answer';
                    if (index === question.correctAnswer) {
                        className += ' correct';
                    } else if (index === answer.selectedAnswer) {
                        className += ' selected';
                    }
                    if (index === answer.selectedAnswer && !isCorrect) {
                        className += ' incorrect';
                    }
                    
                    return `<div class="${className}">${option}</div>`;
                }).join('')}
            `;
            
            container.appendChild(questionDiv);
        });
    }

    showCreateQuizModal() {
        // Populate course dropdown
        const courseSelect = document.getElementById('quizCourse');
        courseSelect.innerHTML = '<option value="">Select Course</option>';
        this.courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course;
            courseSelect.appendChild(option);
        });
        
        // Clear form
        document.getElementById('createQuizForm').reset();
        document.getElementById('questionsContainer').innerHTML = '';
        
        // Show modal
        document.getElementById('createQuizModal').style.display = 'block';
    }

    addQuestion() {
        const container = document.getElementById('questionsContainer');
        const questionCount = container.children.length + 1;
        
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.innerHTML = `
            <button type="button" class="remove-question" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
            <h4>Question ${questionCount}</h4>
            <div class="form-group">
                <label>Question Text:</label>
                <textarea name="questionText" required></textarea>
            </div>
            <div class="form-group">
                <label>Options:</label>
                <input type="text" name="option1" placeholder="Option 1" required>
                <input type="text" name="option2" placeholder="Option 2" required>
                <input type="text" name="option3" placeholder="Option 3" required>
                <input type="text" name="option4" placeholder="Option 4" required>
            </div>
            <div class="form-group">
                <label>Correct Answer:</label>
                <select name="correctAnswer" required>
                    <option value="">Select correct answer</option>
                    <option value="0">Option 1</option>
                    <option value="1">Option 2</option>
                    <option value="2">Option 3</option>
                    <option value="3">Option 4</option>
                </select>
            </div>
        `;
        
        container.appendChild(questionDiv);
    }

    async createQuiz(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const questions = [];
        
        // Collect questions from form
        const questionItems = document.querySelectorAll('.question-item');
        questionItems.forEach((item, index) => {
            const questionText = item.querySelector('[name="questionText"]').value;
            const options = [
                item.querySelector('[name="option1"]').value,
                item.querySelector('[name="option2"]').value,
                item.querySelector('[name="option3"]').value,
                item.querySelector('[name="option4"]').value
            ];
            const correctAnswer = parseInt(item.querySelector('[name="correctAnswer"]').value);
            
            questions.push({
                id: index + 1,
                question: questionText,
                options: options,
                correctAnswer: correctAnswer
            });
        });
        
        const quiz = {
            id: `QZ${Date.now()}`,
            title: formData.get('quizTitle'),
            course: formData.get('quizCourse'),
            instructions: formData.get('quizInstructions'),
            duration: parseInt(formData.get('quizDuration')),
            maxScore: parseInt(formData.get('quizMaxScore')),
            dueDate: formData.get('quizDueDate'),
            questions: questions,
            createdBy: this.currentUser.email,
            createdAt: new Date().toISOString()
        };
        
        // Add to quizzes
        this.quizzes.push(quiz);
        await this.saveQuizzesToDB();
        
        // Close modal
        this.closeModal('createQuizModal');
        
        // Update UI
        this.updateUI();
        
        this.showSuccess('Quiz created successfully!');
    }

    showGradeModal(submissionId) {
        const submission = this.submissions.find(sub => sub.id === submissionId);
        const quiz = this.quizzes.find(q => q.id === submission.quizId);
        
        if (!submission || !quiz) return;
        
        // Populate modal
        document.getElementById('gradeStudentName').textContent = submission.studentName;
        document.getElementById('gradeQuizTitle').textContent = quiz.title;
        document.getElementById('gradeSubmissionDate').textContent = this.formatDate(submission.submittedAt);
        document.getElementById('gradeTimeTaken').textContent = `${submission.timeTaken} minutes`;
        document.getElementById('maxScore').textContent = submission.maxScore;
        
        // Render answers
        this.renderQuizAnswers(submission, quiz);
        
        // Set current submission for grading
        this.currentSubmission = submission;
        
        // Show modal
        document.getElementById('gradeModal').style.display = 'block';
    }

    renderQuizAnswers(submission, quiz) {
        const container = document.getElementById('gradeQuizAnswers');
        container.innerHTML = '';
        
        submission.answers.forEach(answer => {
            const question = quiz.questions.find(q => q.id === answer.questionId);
            if (!question) return;
            
            const answerDiv = document.createElement('div');
            answerDiv.className = 'answer-item';
            
            answerDiv.innerHTML = `
                <h5>${question.question}</h5>
                <div class="answer-text">
                    <strong>Student Answer:</strong> ${question.options[answer.selectedAnswer] || 'No answer'}
                </div>
                <div class="answer-text">
                    <strong>Correct Answer:</strong> ${question.options[question.correctAnswer]}
                </div>
            `;
            
            container.appendChild(answerDiv);
        });
    }

    async gradeSubmission(event) {
        event.preventDefault();
        
        if (!this.currentSubmission) return;
        
        const formData = new FormData(event.target);
        const score = parseInt(formData.get('gradeScore'));
        const feedback = formData.get('gradeFeedback');
        
        // Update submission
        this.currentSubmission.score = score;
        this.currentSubmission.status = 'graded';
        this.currentSubmission.feedback = feedback;
        
        // Save to database
        await this.saveSubmissionsToDB();
        
        // Close modal
        this.closeModal('gradeModal');
        
        // Update UI
        this.updateUI();
        
        this.showSuccess('Quiz graded successfully!');
    }

    viewQuizDetails(quizId) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        if (!quiz) return;
        
        const content = document.getElementById('quizDetailsContent');
        content.innerHTML = `
            <h3>${quiz.title}</h3>
            <p><strong>Course:</strong> ${quiz.course}</p>
            <p><strong>Instructions:</strong> ${quiz.instructions}</p>
            <p><strong>Duration:</strong> ${quiz.duration} minutes</p>
            <p><strong>Questions:</strong> ${quiz.questions.length}</p>
            <p><strong>Maximum Score:</strong> ${quiz.maxScore}</p>
            <p><strong>Due Date:</strong> ${this.formatDate(quiz.dueDate)}</p>
            <p><strong>Created:</strong> ${this.formatDate(quiz.createdAt)}</p>
            
            <h4>Questions Preview:</h4>
            ${quiz.questions.map((q, index) => `
                <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #e9ecef; border-radius: 5px;">
                    <strong>Question ${index + 1}:</strong> ${q.question}
                    <ul style="margin: 5px 0 0 20px;">
                        ${q.options.map((opt, optIndex) => `
                            <li style="color: ${optIndex === q.correctAnswer ? '#28a745' : '#666'};">
                                ${opt} ${optIndex === q.correctAnswer ? '(Correct)' : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `).join('')}
        `;
        
        document.getElementById('quizDetailsModal').style.display = 'block';
    }

    viewSubmission(submissionId) {
        const submission = this.submissions.find(sub => sub.id === submissionId);
        const quiz = this.quizzes.find(q => q.id === submission.quizId);
        
        if (!submission || !quiz) return;
        
        this.showQuizResults(submission);
    }

    viewResults(submissionId) {
        const submission = this.submissions.find(sub => sub.id === submissionId);
        const quiz = this.quizzes.find(q => q.id === submission.quizId);
        
        if (!submission || !quiz) return;
        
        this.showQuizResults(submission);
    }

    searchQuizzes(query) {
        const searchTerm = query.toLowerCase();
        const quizCards = document.querySelectorAll('.quiz-card');
        
        quizCards.forEach(card => {
            const title = card.querySelector('.quiz-title').textContent.toLowerCase();
            const course = card.querySelector('.quiz-course').textContent.toLowerCase();
            
            if (title.includes(searchTerm) || course.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    closeModal(modalId) {
        // If closing quiz modal and quiz is in progress, auto-submit
        if (modalId === 'takeQuizModal' && this.currentQuiz && this.timeRemaining > 0) {
            this.submitQuiz();
        }
        document.getElementById(modalId).style.display = 'none';
        if (modalId === 'takeQuizModal' && this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
    }

    async saveQuizzesToDB() {
        try {
            // In a real application, you would save to your database
            // For now, we'll update localStorage and simulate API call
            localStorage.setItem('quizzes', JSON.stringify(this.quizzes));
            
            // Simulate API call to save quizzes
            const response = await fetch('http://localhost:2000/quizzes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.quizzes)
            });
            
            if (!response.ok) {
                console.warn('Failed to save quizzes to database');
            }
        } catch (error) {
            console.error('Error saving quizzes:', error);
        }
    }

    async saveSubmissionsToDB() {
        try {
            localStorage.setItem('quizSubmissions', JSON.stringify(this.submissions));
            // Save to /quizSubmissions
            const response = await fetch('http://localhost:2000/quizSubmissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.submissions)
            });
            if (!response.ok) {
                console.warn('Failed to save submissions to database');
            }
        } catch (error) {
            console.error('Error saving submissions:', error);
        }
    }

    showSuccess(message) {
        // Create success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        // Create error notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize quiz manager when page loads
let quizManager;
document.addEventListener('DOMContentLoaded', () => {
    quizManager = new QuizManager();
    window.quizManager = quizManager;
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style); 