// Assignment Management System
class AssignmentManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.currentRole = this.currentUser.role;
        this.assignments = [];
        this.submissions = [];
        this.courses = [];
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.checkURLParams();
        this.updateUI();
    }

    getCurrentUser() {
        // Get user from localStorage (from login system)
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
        if (loggedInUser) {
            return {
                id: loggedInUser.id || 'STD1000',
                name: loggedInUser.name || 'John Doe',
                role: loggedInUser.type || 'student',
                email: loggedInUser.email || 'john.doe@example.com'
            };
        }
        
        // Fallback for demo
        return {
            id: 'STD1000',
            name: 'John Doe',
            role: 'student',
            email: 'john.doe@example.com'
        };
    }

    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const assignmentId = urlParams.get('assignmentId');
        
        // Update role display based on current user
        this.updateRoleDisplay();
        
        if (assignmentId) {
            // Load specific assignment data from localStorage
            const assignmentData = JSON.parse(localStorage.getItem('currentAssignment'));
            if (assignmentData) {
                this.currentAssignment = assignmentData;
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
            // Load assignments from db.json
            const response = await fetch('/api/courseDetails');
            const data = await response.json();
            
            // Extract courses based on user role first
            if (this.currentRole === 'teacher') {
                this.courses = await this.getTeacherCourses();
            } else {
                // For students, get their enrolled courses
                this.courses = await this.getStudentEnrolledCourses();
            }
            
            // Extract assignments from course details (now with filtered courses)
            this.assignments = this.extractAssignmentsFromCourses(data);
            
            // Load existing submissions from db.json
            const submissionsResponse = await fetch('/api/assignments');
            if (submissionsResponse.ok) {
                this.submissions = await submissionsResponse.json();
            } else {
                // Generate mock submissions if none exist
                const activityResponse = await fetch('../JS/activity_data.json');
                const activityData = await activityResponse.json();
                this.submissions = this.generateMockSubmissions(activityData.students);
                
                // Save to db.json
                await this.saveSubmissionsToDB();
            }
            
            this.updateUI();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load assignment data');
        }
    }

    async getTeacherCourses() {
        try {
            // Get teacher data from db.json
            const teachersResponse = await fetch('/api/teachers');
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
            
            // Fallback: return all courses if teacher not found
            console.warn('Teacher not found, showing all courses');
            const response = await fetch('/api/courseDetails');
            const data = await response.json();
            return Object.keys(data);
        } catch (error) {
            console.error('Error getting teacher courses:', error);
            // Fallback: return all courses
            const response = await fetch('/api/courseDetails');
            const data = await response.json();
            return Object.keys(data);
        }
    }

    async getStudentEnrolledCourses() {
        try {
            // Get student data from db.json
            const studentsResponse = await fetch('/api/students');
            if (studentsResponse.ok) {
                const students = await studentsResponse.json();
                const currentStudent = students.find(student => 
                    student.email === this.currentUser.email || 
                    student.id === this.currentUser.id
                );
                
                if (currentStudent) {
                    console.log('Found student:', currentStudent);
                    
                    // Get enrollments data from db.json
                    const enrollmentsResponse = await fetch('/api/enrollments');
                    if (enrollmentsResponse.ok) {
                        const enrollments = await enrollmentsResponse.json();
                        
                        // Find enrollments for this student
                        const studentEnrollments = enrollments.filter(enrollment => 
                            enrollment.studentId === currentStudent.id
                        );
                        
                        console.log(`Student ID: ${currentStudent.id}`);
                        console.log(`Found enrollments:`, studentEnrollments);
                        
                        if (studentEnrollments.length > 0) {
                            // Return all enrolled courses
                            const enrolledCourses = studentEnrollments.map(e => e.courseTitle);
                            console.log(`Enrolled courses: ${enrolledCourses}`);
                            return enrolledCourses;
                        }
                    }
                }
            }
            
            // Fallback: check activity data
            const activityResponse = await fetch('../JS/activity_data.json');
            if (activityResponse.ok) {
                const activityData = await activityResponse.json();
                const studentInActivity = activityData.students.find(student => 
                    student.name === this.currentUser.name || 
                    student.id === this.currentUser.id
                );
                
                if (studentInActivity) {
                    console.log('Found student in activity data:', studentInActivity);
                    
                    // For students in activity data, use domain-based assignment as fallback
                    const studentDomain = studentInActivity.domain;
                    if (studentDomain === "General") {
                        return ["Data Analytics by Google"]; // Default for general domain
                    }
                    
                    // Get all available courses
                    const coursesResponse = await fetch('/api/courses');
                    if (coursesResponse.ok) {
                        const allCourses = await coursesResponse.json();
                        
                        // Find the first course matching student's domain
                        const matchingCourse = allCourses.find(course => course.domain === studentDomain);
                        
                        if (matchingCourse) {
                            console.log(`Student domain: ${studentDomain}`);
                            console.log(`Assigned course: ${matchingCourse.title}`);
                            return [matchingCourse.title]; // Return only ONE course
                        }
                    }
                }
            }
            
            // Final fallback: return one default course
            console.warn('Student not found, showing default course');
            return ["Data Analytics by Google"];
        } catch (error) {
            console.error('Error getting student enrolled courses:', error);
            // Fallback: return one default course
            return ["Data Analytics by Google"];
        }
    }

    async saveSubmissionsToDB() {
        try {
            // First, get the current db.json data
            const response = await fetch('/api/db');
            const dbData = await response.json();
            
            // Update the assignments section
            dbData.assignments = this.submissions;
            
            // Save back to db.json
            await fetch('/api/db', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dbData)
            });
        } catch (error) {
            console.error('Error saving submissions to DB:', error);
        }
    }

    extractAssignmentsFromCourses(courseDetails) {
        const assignments = [];
        let assignmentId = 1;

        Object.entries(courseDetails).forEach(([courseName, courseData]) => {
            // For teachers, only include assignments from their assigned courses
            // For students, only include assignments from their enrolled courses
            if (!this.courses.includes(courseName)) {
                return; // Skip this course if user is not assigned/enrolled to it
            }
            
            if (courseData.assignments && Array.isArray(courseData.assignments)) {
                courseData.assignments.forEach(assignment => {
                    assignments.push({
                        id: assignmentId++,
                        title: assignment.title,
                        course: courseName,
                        instructions: assignment.instructions,
                        dueDate: this.parseDueDate(assignment.due),
                        image: assignment.image,
                        maxScore: 100,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    });
                });
            }
        });

        return assignments;
    }

    parseDueDate(dueString) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const friday = new Date(today);
        const daysUntilFriday = (5 - today.getDay() + 7) % 7;
        friday.setDate(friday.getDate() + daysUntilFriday);

        switch (dueString.toLowerCase()) {
            case 'today':
                return today.toISOString();
            case 'tomorrow':
                return tomorrow.toISOString();
            case 'friday':
                return friday.toISOString();
            default:
                return new Date().toISOString();
        }
    }

    generateMockSubmissions(students) {
        const submissions = [];
        let submissionId = 1;

        students.forEach(student => {
            // Generate submissions for each student
            const studentAssignments = this.assignments.slice(0, Math.floor(Math.random() * 5) + 1);
            
            studentAssignments.forEach(assignment => {
                const isSubmitted = Math.random() > 0.3;
                const isGraded = isSubmitted && Math.random() > 0.2;
                
                if (isSubmitted) {
                    submissions.push({
                        id: submissionId++,
                        studentId: student.id,
                        studentName: student.name,
                        assignmentId: assignment.id,
                        assignmentTitle: assignment.title,
                        course: assignment.course,
                        submittedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                        files: [
                            {
                                name: `assignment_${assignment.id}_${student.id}.pdf`,
                                type: 'pdf',
                                size: Math.floor(Math.random() * 5000) + 1000
                            }
                        ],
                        notes: Math.random() > 0.5 ? 'Please review my work. Thank you!' : '',
                        score: isGraded ? Math.floor(Math.random() * 40) + 60 : null,
                        feedback: isGraded ? this.generateMockFeedback() : null,
                        status: isGraded ? 'graded' : 'submitted'
                    });
                }
            });
        });

        return submissions;
    }

    generateMockFeedback() {
        const feedbacks = [
            'Excellent work! Your analysis is thorough and well-structured.',
            'Good effort, but consider adding more examples to support your arguments.',
            'Well done! Your solution demonstrates good understanding of the concepts.',
            'Nice work overall, but pay attention to the formatting requirements.',
            'Great job! Your implementation shows creativity and technical skill.'
        ];
        return feedbacks[Math.floor(Math.random() * feedbacks.length)];
    }

    setupEventListeners() {
        // Setup profile dropdown
        this.setupProfileDropdown();

        // Search functionality
        document.getElementById('assignmentSearch').addEventListener('input', (e) => {
            this.filterAssignments(e.target.value);
        });

        // Filters
        document.getElementById('courseFilter').addEventListener('change', (e) => {
            this.filterAssignments();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filterAssignments();
        });

        document.getElementById('teacherCourseFilter').addEventListener('change', (e) => {
            this.filterSubmissions();
        });

        document.getElementById('teacherStatusFilter').addEventListener('change', (e) => {
            this.filterSubmissions();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });

        // Create assignment button
        document.getElementById('createAssignmentBtn').addEventListener('click', () => {
            this.showCreateAssignmentModal();
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Form submissions
        document.getElementById('submissionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitAssignment();
        });

        document.getElementById('createAssignmentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createAssignment();
        });

        document.getElementById('gradeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.gradeSubmission();
        });

        // Cancel buttons
        document.getElementById('cancelSubmission').addEventListener('click', () => {
            this.closeModal(document.getElementById('submissionModal'));
        });

        document.getElementById('cancelCreate').addEventListener('click', () => {
            this.closeModal(document.getElementById('createAssignmentModal'));
        });

        document.getElementById('cancelGrade').addEventListener('click', () => {
            this.closeModal(document.getElementById('gradeModal'));
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });
    }

    setupProfileDropdown() {
        const profileBtn = document.getElementById('profileBtn');
        if (!profileBtn) return;

        const names = this.currentUser.name.split(" ");
        const initials = names.length > 1 
            ? `${names[0][0]}${names[names.length - 1][0]}`
            : names[0][0];
            
        profileBtn.outerHTML = `
            <div class="profile-dropdown">
                <button class="profile-btn">${initials.toUpperCase()}</button>
                <div class="dropdown-content">
                    <a href="/HTML/profile.html">View Profile</a>
                    <a href="#" onclick="logoutUser()">Logout</a>
                </div>
            </div>
        `;
    }

    // Role switching is now automatic based on user type
    // No manual switching needed

    // Logout function
    logoutUser() {
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('currentAssignment');
        window.location.href = '/HTML/login.html';
    }

    async updateUI() {
        // Show/hide view sections based on user role
        document.getElementById('studentView').classList.toggle('hidden', this.currentRole !== 'student');
        document.getElementById('teacherView').classList.toggle('hidden', this.currentRole !== 'teacher');
        
        if (this.currentRole === 'student') {
            await this.updateStudentView();
        } else {
            this.updateTeacherView();
        }
    }

    async updateStudentView() {
        console.log('Updating student view with courses:', this.courses);
        await this.updateStudentStats();
        this.populateCourseFilter();
        this.renderStudentAssignments();
    }

    updateTeacherView() {
        this.updateTeacherStats();
        this.populateTeacherCourseFilter();
        this.renderTeacherSubmissions();
    }

    async updateStudentStats() {
        const userSubmissions = this.submissions.filter(s => s.studentId === this.currentUser.id);
        const completed = userSubmissions.filter(s => s.status === 'graded').length;
        const pending = this.assignments.length - completed;
        const overdue = this.assignments.filter(a => new Date(a.dueDate) < new Date()).length;

        document.getElementById('completedCount').textContent = completed;
        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('overdueCount').textContent = overdue;
        
        // Show enrollment information
        await this.displayEnrollmentInfo();
    }

    updateTeacherStats() {
        const totalAssignments = this.assignments.length;
        const totalStudents = new Set(this.submissions.map(s => s.studentId)).size;
        const avgScore = this.calculateAverageScore();

        document.getElementById('totalAssignments').textContent = totalAssignments;
        document.getElementById('totalStudents').textContent = totalStudents;
        document.getElementById('avgScore').textContent = avgScore.toFixed(1);
    }

    calculateAverageScore() {
        const gradedSubmissions = this.submissions.filter(s => s.score !== null);
        if (gradedSubmissions.length === 0) return 0;
        
        const totalScore = gradedSubmissions.reduce((sum, s) => sum + s.score, 0);
        return totalScore / gradedSubmissions.length;
    }

    async displayEnrollmentInfo() {
        // Find or create enrollment info element
        let enrollmentInfo = document.getElementById('enrollmentInfo');
        if (!enrollmentInfo) {
            enrollmentInfo = document.createElement('div');
            enrollmentInfo.id = 'enrollmentInfo';
            enrollmentInfo.className = 'enrollment-info';
            
            // Insert after the stats section
            const statsSection = document.querySelector('.stats-section');
            if (statsSection) {
                statsSection.parentNode.insertBefore(enrollmentInfo, statsSection.nextSibling);
            }
        }
        
        if (this.currentRole === 'student') {
            // Get detailed course information
            let courseDetails = null;
            try {
                const coursesResponse = await fetch('/api/courses');
                if (coursesResponse.ok) {
                    const allCourses = await coursesResponse.json();
                    courseDetails = allCourses.find(course => course.title === this.courses[0]);
                }
            } catch (error) {
                console.error('Error fetching course details:', error);
            }
            
            enrollmentInfo.innerHTML = `
                <div class="enrollment-status">
                    <h4><i class="fas fa-graduation-cap"></i> Your Enrolled Course</h4>
                    <div class="enrolled-course-details">
                        ${this.courses.length > 0 ? `
                            <div class="course-card">
                                <div class="course-header">
                                    <h3 class="course-title">
                                        <i class="fas fa-book"></i> ${this.courses[0]}
                                    </h3>
                                    <span class="course-status">Active</span>
                                </div>
                                ${courseDetails ? `
                                    <div class="course-info">
                                        <div class="course-info-row">
                                            <span class="info-label"><i class="fas fa-building"></i> Provider:</span>
                                            <span class="info-value">${courseDetails.coordinator}</span>
                                        </div>
                                        <div class="course-info-row">
                                            <span class="info-label"><i class="fas fa-clock"></i> Duration:</span>
                                            <span class="info-value">${courseDetails.duration}</span>
                                        </div>
                                        <div class="course-info-row">
                                            <span class="info-label"><i class="fas fa-calendar"></i> Start Date:</span>
                                            <span class="info-value">${courseDetails.startDate}</span>
                                        </div>
                                        <div class="course-info-row">
                                            <span class="info-label"><i class="fas fa-signal"></i> Level:</span>
                                            <span class="info-value">${courseDetails.level}</span>
                                        </div>
                                        <div class="course-info-row">
                                            <span class="info-label"><i class="fas fa-star"></i> Rating:</span>
                                            <span class="info-value">${courseDetails.rating}/5.0</span>
                                        </div>
                                    </div>
                                    <div class="course-description">
                                        <h5>Course Description:</h5>
                                        <p>${courseDetails.description}</p>
                                    </div>
                                ` : ''}
                            </div>
                        ` : 
                            '<p class="no-courses">No courses enrolled. Please contact your administrator.</p>'
                        }
                    </div>
                    <p class="enrollment-note">
                        <i class="fas fa-info-circle"></i> 
                        You can view and submit assignments for this course.
                    </p>
                </div>
            `;
        } else {
            enrollmentInfo.innerHTML = '';
        }
    }

    populateCourseFilter() {
        const filter = document.getElementById('courseFilter');
        filter.innerHTML = '<option value="">All Courses</option>';
        
        // Add course options based on user role
        if (this.currentRole === 'teacher') {
            // For teachers, show their assigned courses
            this.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                filter.appendChild(option);
            });
        } else {
            // For students, show their enrolled courses
            this.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course;
                option.textContent = course;
                filter.appendChild(option);
            });
        }
    }

    populateTeacherCourseFilter() {
        const filter = document.getElementById('teacherCourseFilter');
        filter.innerHTML = '<option value="">All Courses</option>';
        
        this.courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course;
            filter.appendChild(option);
        });
    }

    renderStudentAssignments() {
        const grid = document.getElementById('studentAssignmentsGrid');
        const filteredAssignments = this.getFilteredAssignments();
        
        if (filteredAssignments.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>No assignments found</h3>
                    <p>There are no assignments matching your current filters.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filteredAssignments.map(assignment => {
            const submission = this.submissions.find(s => 
                s.studentId === this.currentUser.id && s.assignmentId === assignment.id
            );
            
            const status = this.getAssignmentStatus(assignment, submission);
            const statusClass = this.getStatusClass(status);
            
            return `
                <div class="assignment-card ${statusClass}">
                    <div class="assignment-header-card">
                        <h3 class="assignment-title">${assignment.title}</h3>
                        <span class="assignment-status status-${statusClass}">${status}</span>
                    </div>
                    
                    <div class="assignment-course">
                        <i class="fas fa-book"></i>
                        ${assignment.course}
                    </div>
                    
                    <div class="assignment-details">
                        <div class="assignment-detail">
                            <strong>Due Date:</strong>
                            <span>${this.formatDate(assignment.dueDate)}</span>
                        </div>
                        <div class="assignment-detail">
                            <strong>Max Score:</strong>
                            <span>${assignment.maxScore} points</span>
                        </div>
                        ${submission && submission.score !== null ? `
                            <div class="assignment-detail">
                                <strong>Your Score:</strong>
                                <span>${submission.score}/${assignment.maxScore}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="assignment-actions">
                        <button class="btn" onclick="assignmentManager.viewAssignment(${assignment.id})">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                        ${!submission ? `
                            <button class="btn" onclick="assignmentManager.showSubmissionModal(${assignment.id})">
                                <i class="fas fa-upload"></i> Submit
                            </button>
                        ` : submission.status === 'submitted' ? `
                            <button class="btn" disabled>
                                <i class="fas fa-clock"></i> Submitted
                            </button>
                        ` : `
                            <button class="btn" onclick="assignmentManager.viewSubmission(${submission.id})">
                                <i class="fas fa-star"></i> View Grade
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTeacherSubmissions() {
        const container = document.getElementById('teacherSubmissionsContainer');
        const filteredSubmissions = this.getFilteredSubmissions();
        
        if (filteredSubmissions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No submissions found</h3>
                    <p>There are no submissions matching your current filters.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredSubmissions.map(submission => {
            const assignment = this.assignments.find(a => a.id === submission.assignmentId);
            
            return `
                <div class="submission-item">
                    <div class="student-info">
                        <div class="student-avatar">
                            ${submission.studentName.charAt(0)}
                        </div>
                        <div class="student-details">
                            <h4>${submission.studentName}</h4>
                            <p>ID: ${submission.studentId}</p>
                        </div>
                    </div>
                    
                    <div class="assignment-info">
                        <h4>${submission.assignmentTitle}</h4>
                        <p>${submission.course}</p>
                        <p>Submitted: ${this.formatDate(submission.submittedAt)}</p>
                    </div>
                    
                    <div class="submission-status">
                        <span class="assignment-status status-${submission.status}">
                            ${submission.status}
                        </span>
                    </div>
                    
                    <div class="submission-score">
                        ${submission.score !== null ? `${submission.score}/${assignment.maxScore}` : 'Not graded'}
                    </div>
                    
                    <div class="submission-actions">
                        <button class="btn" onclick="assignmentManager.viewSubmission(${submission.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        ${submission.status === 'submitted' ? `
                            <button class="btn" onclick="assignmentManager.showGradeModal(${submission.id})">
                                <i class="fas fa-star"></i> Grade
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    getFilteredAssignments() {
        let filtered = [...this.assignments];
        const searchTerm = document.getElementById('assignmentSearch').value.toLowerCase();
        const courseFilter = document.getElementById('courseFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;

        if (searchTerm) {
            filtered = filtered.filter(a => 
                a.title.toLowerCase().includes(searchTerm) ||
                a.course.toLowerCase().includes(searchTerm)
            );
        }

        if (courseFilter) {
            filtered = filtered.filter(a => a.course === courseFilter);
        }

        if (statusFilter) {
            filtered = filtered.filter(a => {
                const submission = this.submissions.find(s => 
                    s.studentId === this.currentUser.id && s.assignmentId === a.id
                );
                const status = this.getAssignmentStatus(a, submission);
                return status === statusFilter;
            });
        }

        return filtered;
    }

    getFilteredSubmissions() {
        let filtered = [...this.submissions];
        const courseFilter = document.getElementById('teacherCourseFilter').value;
        const statusFilter = document.getElementById('teacherStatusFilter').value;

        if (courseFilter) {
            filtered = filtered.filter(s => s.course === courseFilter);
        }

        if (statusFilter) {
            filtered = filtered.filter(s => s.status === statusFilter);
        }

        return filtered;
    }

    getAssignmentStatus(assignment, submission) {
        if (submission && submission.status === 'graded') {
            return 'completed';
        }
        
        if (submission && submission.status === 'submitted') {
            return 'pending';
        }
        
        if (new Date(assignment.dueDate) < new Date()) {
            return 'overdue';
        }
        
        return 'pending';
    }

    getStatusClass(status) {
        switch (status) {
            case 'completed': return 'completed';
            case 'overdue': return 'overdue';
            default: return 'pending';
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showSubmissionModal(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (!assignment) return;

        document.getElementById('modalAssignmentTitle').textContent = assignment.title;
        document.getElementById('modalAssignmentInstructions').textContent = assignment.instructions;
        document.getElementById('modalDueDate').textContent = this.formatDate(assignment.dueDate);
        
        document.getElementById('submissionForm').dataset.assignmentId = assignmentId;
        document.getElementById('submissionModal').style.display = 'block';
    }

    showCreateAssignmentModal() {
        const courseSelect = document.getElementById('assignmentCourse');
        courseSelect.innerHTML = '<option value="">Select Course</option>';
        
        this.courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course;
            courseSelect.appendChild(option);
        });

        document.getElementById('createAssignmentModal').style.display = 'block';
    }

    showGradeModal(submissionId) {
        const submission = this.submissions.find(s => s.id === submissionId);
        const assignment = this.assignments.find(a => a.id === submission.assignmentId);
        
        if (!submission || !assignment) return;

        document.getElementById('gradeStudentName').textContent = submission.studentName;
        document.getElementById('gradeAssignmentTitle').textContent = submission.assignmentTitle;
        document.getElementById('gradeSubmissionDate').textContent = this.formatDate(submission.submittedAt);
        document.getElementById('maxScore').textContent = assignment.maxScore;
        document.getElementById('gradeStudentNotes').textContent = submission.notes || 'No notes provided';
        
        // Render submission files with download and preview buttons
        const filesContainer = document.getElementById('gradeSubmissionFiles');
        filesContainer.innerHTML = submission.files.map(file => `
            <div class="file-item">
                <i class="fas fa-file"></i>
                <span>${file.name}</span>
                <small>(${this.formatFileSize(file.size)})</small>
                <div class="file-actions">
                    <button class="btn-preview" onclick="assignmentManager.previewFile('${file.name}', '${submission.studentName}', '${submission.assignmentTitle}')">
                        <i class="fas fa-eye"></i> Preview
                    </button>
                    <button class="btn-download" onclick="assignmentManager.downloadFile('${file.name}', '${submission.studentName}', '${submission.assignmentTitle}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `).join('');

        document.getElementById('gradeForm').dataset.submissionId = submissionId;
        document.getElementById('gradeModal').style.display = 'block';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    viewAssignment(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (!assignment) return;

        const submission = this.submissions.find(s => 
            s.studentId === this.currentUser.id && s.assignmentId === assignmentId
        );

        const content = document.getElementById('assignmentDetailsContent');
        content.innerHTML = `
            <div class="assignment-info">
                <h3>${assignment.title}</h3>
                <p><strong>Course:</strong> ${assignment.course}</p>
                <p><strong>Due Date:</strong> ${this.formatDate(assignment.dueDate)}</p>
                <p><strong>Max Score:</strong> ${assignment.maxScore} points</p>
                ${submission ? `
                    <p><strong>Status:</strong> <span class="assignment-status status-${submission.status}">${submission.status}</span></p>
                    ${submission.score !== null ? `<p><strong>Your Score:</strong> ${submission.score}/${assignment.maxScore}</p>` : ''}
                ` : ''}
            </div>
            
            <div class="assignment-info">
                <h4>Instructions:</h4>
                <p>${assignment.instructions}</p>
            </div>
            
            ${submission ? `
                <div class="submission-details">
                    <h4>Your Submission:</h4>
                    <p><strong>Submitted:</strong> ${this.formatDate(submission.submittedAt)}</p>
                    ${submission.files.length > 0 ? `
                        <div class="submission-files">
                            <h4>Files:</h4>
                            ${submission.files.map(file => `
                                <div class="file-item">
                                    <i class="fas fa-file"></i>
                                    <span>${file.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${submission.notes ? `
                        <div class="submission-notes">
                            <h4>Your Notes:</h4>
                            <p>${submission.notes}</p>
                        </div>
                    ` : ''}
                    ${submission.feedback ? `
                        <div class="submission-notes">
                            <h4>Feedback:</h4>
                            <p>${submission.feedback}</p>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        `;

        document.getElementById('assignmentDetailsModal').style.display = 'block';
    }

    viewSubmission(submissionId) {
        const submission = this.submissions.find(s => s.id === submissionId);
        const assignment = this.assignments.find(a => a.id === submission.assignmentId);
        
        if (!submission || !assignment) return;

        const content = document.getElementById('assignmentDetailsContent');
        content.innerHTML = `
            <div class="assignment-info">
                <h3>${submission.assignmentTitle}</h3>
                <p><strong>Student:</strong> ${submission.studentName} (${submission.studentId})</p>
                <p><strong>Course:</strong> ${submission.course}</p>
                <p><strong>Submitted:</strong> ${this.formatDate(submission.submittedAt)}</p>
                <p><strong>Status:</strong> <span class="assignment-status status-${submission.status}">${submission.status}</span></p>
                ${submission.score !== null ? `<p><strong>Score:</strong> ${submission.score}/${assignment.maxScore}</p>` : ''}
            </div>
            
            <div class="submission-details">
                <h4>Assignment Instructions:</h4>
                <p>${assignment.instructions}</p>
                
                <div class="submission-files">
                    <h4>Submitted Files:</h4>
                    ${submission.files.map(file => `
                        <div class="file-item">
                            <i class="fas fa-file"></i>
                            <span>${file.name}</span>
                            <small>(${this.formatFileSize(file.size)})</small>
                        </div>
                    `).join('')}
                </div>
                
                ${submission.notes ? `
                    <div class="submission-notes">
                        <h4>Student Notes:</h4>
                        <p>${submission.notes}</p>
                    </div>
                ` : ''}
                
                ${submission.feedback ? `
                    <div class="submission-notes">
                        <h4>Feedback:</h4>
                        <p>${submission.feedback}</p>
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('assignmentDetailsModal').style.display = 'block';
    }

    async submitAssignment() {
        const assignmentId = parseInt(document.getElementById('submissionForm').dataset.assignmentId);
        const fileInput = document.getElementById('submissionFile');
        const notes = document.getElementById('submissionNotes').value;

        if (!fileInput.files[0]) {
            this.showError('Please select a file to upload');
            return;
        }

        // Simulate file upload
        const file = fileInput.files[0];
        const submission = {
            id: this.submissions.length + 1,
            studentId: this.currentUser.id,
            studentName: this.currentUser.name,
            assignmentId: assignmentId,
            assignmentTitle: this.assignments.find(a => a.id === assignmentId).title,
            course: this.assignments.find(a => a.id === assignmentId).course,
            submittedAt: new Date().toISOString(),
            files: [{
                name: file.name,
                type: file.type,
                size: file.size
            }],
            notes: notes,
            score: null,
            feedback: null,
            status: 'submitted'
        };

        this.submissions.push(submission);
        
        // Save to db.json
        await this.saveSubmissionsToDB();
        
        this.closeModal(document.getElementById('submissionModal'));
        this.updateUI();
        this.showSuccess('Assignment submitted successfully!');
    }

    async createAssignment() {
        const title = document.getElementById('assignmentTitle').value;
        const course = document.getElementById('assignmentCourse').value;
        const instructions = document.getElementById('assignmentInstructions').value;
        const dueDate = document.getElementById('assignmentDueDate').value;
        const maxScore = parseInt(document.getElementById('assignmentMaxScore').value);

        // For teachers, verify they can create assignments for this course
        if (this.currentRole === 'teacher' && !this.courses.includes(course)) {
            this.showError('You are not authorized to create assignments for this course');
            return;
        }

        const assignment = {
            id: this.assignments.length + 1,
            title: title,
            course: course,
            instructions: instructions,
            dueDate: new Date(dueDate).toISOString(),
            maxScore: maxScore,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        this.assignments.push(assignment);
        
        // Save to db.json
        await this.saveAssignmentToCourseDetails(assignment);
        
        this.closeModal(document.getElementById('createAssignmentModal'));
        this.updateUI();
        this.showSuccess('Assignment created successfully!');
    }

    async saveAssignmentToCourseDetails(assignment) {
        try {
            // Get current course details
            const response = await fetch('/api/courseDetails');
            const courseDetails = await response.json();
            
            // Add assignment to the specific course
            if (courseDetails[assignment.course]) {
                if (!courseDetails[assignment.course].assignments) {
                    courseDetails[assignment.course].assignments = [];
                }
                
                courseDetails[assignment.course].assignments.push({
                    id: assignment.id,
                    title: assignment.title,
                    instructions: assignment.instructions,
                    due: new Date(assignment.dueDate).toLocaleDateString(),
                    image: '../images/assignment.jpeg'
                });
                
                // Save back to db.json
                await fetch('/api/courseDetails', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(courseDetails)
                });
            }
        } catch (error) {
            console.error('Error saving assignment to course details:', error);
        }
    }

    // File Management Functions
    downloadFile(fileName, studentName, assignmentTitle) {
        try {
            // Create a mock file content (in real app, this would be the actual file)
            const fileContent = this.generateMockFileContent(fileName, studentName, assignmentTitle);
            
            // Create blob and download
            const blob = new Blob([fileContent], { type: this.getFileType(fileName) });
            const url = window.URL.createObjectURL(blob);
            
            // Create download link
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            this.showSuccess(`Downloaded ${fileName}`);
            
            // Log download activity
            this.logDownloadActivity(fileName, studentName, assignmentTitle);
            
        } catch (error) {
            console.error('Error downloading file:', error);
            this.showError('Failed to download file');
        }
    }

    generateMockFileContent(fileName, studentName, assignmentTitle) {
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        switch (fileExtension) {
            case 'pdf':
                return `Assignment Submission Report
                
Student: ${studentName}
Assignment: ${assignmentTitle}
Submission Date: ${new Date().toLocaleDateString()}

This is a mock PDF content for demonstration purposes.
In a real application, this would contain the actual assignment submission.

Content Summary:
- Introduction and methodology
- Analysis and results
- Conclusions and recommendations
- References and appendices

Submitted by: ${studentName}
Course: ${this.currentAssignment?.course || 'N/A'}
Date: ${new Date().toLocaleDateString()}`;

            case 'doc':
            case 'docx':
                return `Assignment Submission Document

Student Information:
Name: ${studentName}
Assignment: ${assignmentTitle}
Course: ${this.currentAssignment?.course || 'N/A'}
Submission Date: ${new Date().toLocaleDateString()}

Assignment Content:
1. Introduction
   This section provides an overview of the assignment objectives and methodology.

2. Main Content
   Detailed analysis and implementation of the assignment requirements.

3. Results
   Presentation of findings and outcomes.

4. Conclusion
   Summary of work completed and lessons learned.

References:
- Course materials and resources
- Additional research sources
- Technical documentation

Submitted by: ${studentName}
Date: ${new Date().toLocaleDateString()}`;

            case 'txt':
                return `Assignment Submission - Text Format

Student: ${studentName}
Assignment: ${assignmentTitle}
Course: ${this.currentAssignment?.course || 'N/A'}
Date: ${new Date().toLocaleDateString()}

ASSIGNMENT CONTENT:

This is a text-based submission for the assignment.
The content includes:

1. Problem Analysis
2. Solution Implementation
3. Results and Discussion
4. Conclusion

Code snippets and technical details would be included here
in a real assignment submission.

END OF SUBMISSION

Submitted by: ${studentName}`;

            case 'zip':
                return `Mock ZIP file content for ${fileName}
This would contain the actual project files and folders.
Student: ${studentName}
Assignment: ${assignmentTitle}`;

            default:
                return `Assignment Submission File

Student: ${studentName}
Assignment: ${assignmentTitle}
File: ${fileName}
Date: ${new Date().toLocaleDateString()}

This is a mock file content for demonstration purposes.
In a real application, this would contain the actual assignment submission.`;
        }
    }

    getFileType(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed'
        };
        return mimeTypes[extension] || 'application/octet-stream';
    }

    logDownloadActivity(fileName, studentName, assignmentTitle) {
        const downloadLog = {
            timestamp: new Date().toISOString(),
            teacher: this.currentUser.name,
            teacherId: this.currentUser.id,
            student: studentName,
            assignment: assignmentTitle,
            file: fileName,
            action: 'download'
        };

        // Store download log in localStorage for tracking
        const existingLogs = JSON.parse(localStorage.getItem('downloadLogs') || '[]');
        existingLogs.push(downloadLog);
        localStorage.setItem('downloadLogs', JSON.stringify(existingLogs));

        console.log('Download logged:', downloadLog);
    }

    // Enhanced file preview functionality
    previewFile(fileName, studentName, assignmentTitle) {
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        if (fileExtension === 'pdf') {
            this.previewPDF(fileName, studentName, assignmentTitle);
        } else if (['doc', 'docx'].includes(fileExtension)) {
            this.previewDocument(fileName, studentName, assignmentTitle);
        } else if (fileExtension === 'txt') {
            this.previewText(fileName, studentName, assignmentTitle);
        } else {
            this.showError('Preview not available for this file type. Please download to view.');
        }
    }

    previewPDF(fileName, studentName, assignmentTitle) {
        const content = this.generateMockFileContent(fileName, studentName, assignmentTitle);
        this.showFilePreview('PDF Preview', content, 'pdf');
    }

    previewDocument(fileName, studentName, assignmentTitle) {
        const content = this.generateMockFileContent(fileName, studentName, assignmentTitle);
        this.showFilePreview('Document Preview', content, 'document');
    }

    previewText(fileName, studentName, assignmentTitle) {
        const content = this.generateMockFileContent(fileName, studentName, assignmentTitle);
        this.showFilePreview('Text Preview', content, 'text');
    }

    showFilePreview(title, content, fileType) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content file-preview-modal';
        modalContent.style.maxWidth = '800px';
        modalContent.style.maxHeight = '80vh';
        
        modalContent.innerHTML = `
            <div class="modal-header">
                <h2><i class="fas fa-file-${fileType === 'pdf' ? 'pdf' : fileType === 'document' ? 'word' : 'alt'}"></i> ${title}</h2>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div class="file-preview-content">
                    <pre style="white-space: pre-wrap; font-family: monospace; background: #f8f9fa; padding: 20px; border-radius: 8px; max-height: 500px; overflow-y: auto;">${content}</pre>
                </div>
                <div class="file-preview-actions">
                    <button class="btn" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async gradeSubmission() {
        const submissionId = parseInt(document.getElementById('gradeForm').dataset.submissionId);
        const score = parseInt(document.getElementById('gradeScore').value);
        const feedback = document.getElementById('gradeFeedback').value;

        const submission = this.submissions.find(s => s.id === submissionId);
        if (submission) {
            submission.score = score;
            submission.feedback = feedback;
            submission.status = 'graded';
        }

        // Save to db.json
        await this.saveSubmissionsToDB();

        this.closeModal(document.getElementById('gradeModal'));
        this.updateUI();
        this.showSuccess('Assignment graded successfully!');
    }

    closeModal(modal) {
        modal.style.display = 'none';
    }

    filterAssignments() {
        this.renderStudentAssignments();
    }

    filterSubmissions() {
        this.renderTeacherSubmissions();
    }

    showSuccess(message) {
        // Create a simple success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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
        // Create a simple error notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
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

// Initialize the assignment manager when the page loads
let assignmentManager;
document.addEventListener('DOMContentLoaded', () => {
    assignmentManager = new AssignmentManager();
});

// Make logoutUser globally accessible
window.logoutUser = function() {
    if (assignmentManager) {
        assignmentManager.logoutUser();
    }
};

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style); 