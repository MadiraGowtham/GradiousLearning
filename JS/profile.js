// Global variables
let currentUser = null;
let userProfile = null;
let isEditingBasic = false;
let isEditingAcademic = false;
let isAddingCertificate = false;
let isAddingAcademic = false;

// API endpoints
const API_BASE = 'http://localhost:2000';

// Initialize the profile page
document.addEventListener('DOMContentLoaded', function() {
    initializeProfile();
});

async function initializeProfile() {
    try {
        showLoading(true);
        
        // Check if user is logged in
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
        if (!loggedInUser) {
            showNotification('Please log in to access your profile.', 'error');
            setTimeout(() => {
                window.location.href = '/HTML/login.html';
            }, 2000);
            return;
        }

        currentUser = loggedInUser;
        console.log('Initialized profile for user:', currentUser);
        
        // Set up navigation based on user type
        setupNavigation();
        
        // Load user profile data
        await loadUserProfile();
        
        // Set up event listeners
        setupEventListeners();
        
        // Render the profile
        renderProfile();
        // Show certificates section by default for students
        if (currentUser.type === 'student') {
            showSection('certificates');
            const certNav = document.getElementById('certificatesNav');
            if (certNav) updateActiveNav(certNav);
        } else {
            showDefaultSection();
        }
        
    } catch (error) {
        console.error('Error initializing profile:', error);
        showNotification('Failed to load profile. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function setupNavigation() {
    const homeButton = document.getElementById('homeButton');
    const certificatesNav = document.getElementById('certificatesNav');
    const coursesNav = document.getElementById('coursesNav');
    
    // Set home button based on user type
    const homePages = {
        'student': '/HTML/index.html',
        'teacher': '/HTML/teacherIndex.html',
        'admin': '/HTML/adminIndex.html'
    };
    homeButton.href = homePages[currentUser.type] || '/HTML/index.html';
    
    // Show/hide navigation based on user type
    if (currentUser.type === 'admin') {
        coursesNav.style.display = 'none';
        certificatesNav.innerHTML = '<i class="fas fa-certificate"></i><span>Certificates (Editable)</span>';
    } else if (currentUser.type === 'teacher') {
        certificatesNav.innerHTML = '<i class="fas fa-certificate"></i><span>Certificates (Editable)</span>';
        coursesNav.innerHTML = '<i class="fas fa-book"></i><span>My Teaching Courses</span>';
    } else {
        certificatesNav.innerHTML = '<i class="fas fa-certificate"></i><span>Certificates (Read-only)</span>';
        coursesNav.innerHTML = '<i class="fas fa-book"></i><span>My Enrolled Courses</span>';
    }
}

async function loadUserProfile() {
    try {
        const debugDiv = document.getElementById('cert-debug');
        console.log('[DEBUG] currentUser:', currentUser);
        if (debugDiv) debugDiv.textContent = '[DEBUG] currentUser.id: ' + currentUser.id;
        // Load profile from server's db.json endpoint
        try {
            const response = await fetch(`${API_BASE}/db.json`);
            console.log('[DEBUG] Fetching profile from', `${API_BASE}/db.json`);
            if (response.ok) {
                const data = await response.json();
                const profiles = data.profiles || [];
                const userProfiles = profiles.filter(p => p.userId === currentUser.id);
                console.log('[DEBUG] Profiles found:', userProfiles);
                if (userProfiles.length > 0) {
                    userProfile = userProfiles[userProfiles.length - 1];
                    console.log('[DEBUG] Loaded profile from db.json:', userProfile);
                    const profileKey = `${currentUser.type}Profile`;
                    localStorage.setItem(profileKey, JSON.stringify(userProfile));
                }
            }
        } catch (error) {
            console.error('[DEBUG] Error loading profile from db.json:', error);
        }
        const profileKey = `${currentUser.type}Profile`;
        let profile = JSON.parse(localStorage.getItem(profileKey));
        if (!profile) {
            profile = createDefaultProfile();
            console.log('[DEBUG] Created default profile:', profile);
            try {
                await saveProfileToDatabase(profile);
            } catch (error) {
                console.error('[DEBUG] Error saving default profile to database:', error);
            }
            localStorage.setItem(profileKey, JSON.stringify(profile));
        }
        // Merge profile first
        if (profile) {
            Object.assign(userProfile, profile);
        }
        // Now fetch and assign certificates
        if (currentUser.type === 'student') {
            try {
                let certs = [];
                let certResUrl = '/api/certificates?studentId=' + currentUser.id;
                if (debugDiv) debugDiv.textContent += '\n[DEBUG] Fetching certificates from: ' + certResUrl;
                let certRes = await fetch(certResUrl);
                if (certRes.ok) {
                    certs = await certRes.json();
                    if (debugDiv) debugDiv.textContent += '\n[DEBUG] Certificates from endpoint: ' + JSON.stringify(certs);
                    console.log('[DEBUG] Certificates from endpoint:', certs);
                } else {
                    if (debugDiv) debugDiv.textContent += '\n[DEBUG] Certificates fetch failed: ' + certRes.status + ' ' + certRes.statusText;
                    console.error('[DEBUG] Certificates fetch failed:', certRes.status, certRes.statusText);
                }
                if (!certs || certs.length === 0) {
                    const dbRes = await fetch('/api/db.json');
                    if (dbRes.ok) {
                        const dbData = await dbRes.json();
                        certs = (dbData.certificates || []).filter(cert => cert.studentId === currentUser.id);
                        if (debugDiv) debugDiv.textContent += '\n[DEBUG] Fallback certificates from db.json: ' + JSON.stringify(certs);
                        console.log('[DEBUG] Fallback certificates from db.json:', certs);
                    } else {
                        if (debugDiv) debugDiv.textContent += '\n[DEBUG] db.json fetch failed: ' + dbRes.status + ' ' + dbRes.statusText;
                        console.error('[DEBUG] db.json fetch failed:', dbRes.status, dbRes.statusText);
                    }
                }
                // Assign certificates after merging profile
                userProfile.certificates = certs.map(cert => ({
                    courseTitle: cert.courseTitle,
                    issuer: 'LearnEdge LMS',
                    date: cert.date,
                    url: cert.url || '',
                    id: cert.id
                }));
                if (debugDiv) debugDiv.textContent += '\n[DEBUG] userProfile.certificates after mapping: ' + JSON.stringify(userProfile.certificates);
                console.log('[DEBUG] userProfile.certificates:', userProfile.certificates);
            } catch (err) { 
                if (debugDiv) debugDiv.textContent += '\n[DEBUG] Error loading certificates: ' + err;
                console.error('[DEBUG] Error loading certificates:', err); 
            }
        }
        renderCertificates();
    } catch (error) {
        console.error('[DEBUG] Error loading user profile:', error);
        userProfile = createFallbackProfile();
        if (document.getElementById('cert-debug')) document.getElementById('cert-debug').textContent += '\n[DEBUG] Using fallback profile due to error: ' + JSON.stringify(userProfile);
        console.log('[DEBUG] Using fallback profile due to error:', userProfile);
    }
}

// Simple fallback profile function
function createFallbackProfile() {
    return {
        userId: currentUser.id,
        userType: currentUser.type,
        basic: {
            name: currentUser.name || 'User',
            email: currentUser.email || '',
            dob: '',
            gender: '',
            phone: '',
            address: '',
            social: {
                instagram: '',
                linkedin: '',
                github: ''
            }
        },
        academic: {},
        certificates: [],
        courses: [],
        lastUpdated: new Date().toISOString()
    };
}

function createDefaultProfile() {
    const baseProfile = {
        userId: currentUser.id,
        userType: currentUser.type,
        basic: {
            name: currentUser.name || '',
            dob: '',
            gender: '',
            email: currentUser.email || '',
            phone: currentUser.phone || '',
            address: '',
            social: {
                instagram: '',
                linkedin: '',
                github: ''
            }
        },
        academic: {},
        certificates: [],
        courses: [],
        lastUpdated: new Date().toISOString()
    };
    
    // Add user-specific data
    if (currentUser.type === 'student') {
        // Try to get enrolled courses from database
        baseProfile.courses = currentUser.enrolledCourses || [];
        baseProfile.certificates = currentUser.completedCourses || [];
        
        // Add basic academic info if available
        if (currentUser.domain) {
            baseProfile.academic = {
                "Current": {
                    "percentage": "In Progress",
                    "board": "LearnEdge LMS",
                    "school": "LearnEdge Online Platform",
                    "year": new Date().getFullYear() + "-Present",
                    "branch": currentUser.domain
                }
            };
        }
    } else if (currentUser.type === 'teacher') {
        baseProfile.courses = currentUser.courses || [];
    }
    
    return baseProfile;
}

function setupEventListeners() {
    // Basic details form
    document.getElementById('editBasicBtn').addEventListener('click', toggleBasicForm);
    document.getElementById('cancelBasicBtn').addEventListener('click', cancelBasicForm);
    document.getElementById('basicDetailsForm').addEventListener('submit', saveBasicDetails);
    
    // Academic details form
    document.getElementById('editAcademicBtn').addEventListener('click', toggleAcademicForm);
    document.getElementById('addAcademicBtn').addEventListener('click', showAddAcademicForm);
    document.getElementById('cancelAcademicBtn').addEventListener('click', cancelAcademicForm);
    document.getElementById('academicDetailsForm').addEventListener('submit', saveAcademicDetails);
    
    // Certificate form
    document.getElementById('addCertBtn').addEventListener('click', toggleCertificateForm);
    document.getElementById('cancelCertBtn').addEventListener('click', cancelCertificateForm);
    document.getElementById('addCertificateForm').addEventListener('submit', saveCertificate);
    
    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-section');
            showSection(targetId);
            updateActiveNav(this);
        });
    });
    

    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllForms();
        }
    });
}

function renderProfile() {
    // Update header
    document.getElementById('welcomeMessage').textContent = `Welcome, ${currentUser.name}`;
    document.getElementById('userIdDisplay').textContent = `${currentUser.type.charAt(0).toUpperCase() + currentUser.type.slice(1)} ID: ${currentUser.id}`;
    document.getElementById('userTypeDisplay').textContent = `${currentUser.type.charAt(0).toUpperCase() + currentUser.type.slice(1)}`;
    
    // Render basic details
    renderBasicDetails();
    
    // Render academic details
    renderAcademicDetails();
    
    // Render certificates
    renderCertificates();
    
    // Render courses
    renderCourses();
    
    // Show/hide edit buttons based on user type
    setupEditPermissions();
}

function renderBasicDetails() {
    const container = document.getElementById('basicDetailsDisplay');
    const basic = userProfile.basic;
    
    container.innerHTML = `
        <div class="details-display">
            <div class="detail-item">
                <h4><i class="fas fa-user"></i> Full Name</h4>
                <p>${basic.name || 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-calendar"></i> Date of Birth</h4>
                <p>${basic.dob ? new Date(basic.dob).toLocaleDateString() : 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-venus-mars"></i> Gender</h4>
                <p>${basic.gender ? basic.gender.charAt(0).toUpperCase() + basic.gender.slice(1) : 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-map-marker-alt"></i> Address</h4>
                <p>${basic.address || 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-phone"></i> Phone Number</h4>
                <p>${basic.phone || 'Not specified'}</p>
            </div>
            <div class="detail-item">
                <h4><i class="fas fa-envelope"></i> Email</h4>
                <p>${basic.email || 'Not specified'}</p>
            </div>
            ${renderSocialLinks(basic.social)}
        </div>
    `;
}

function renderSocialLinks(social) {
    const links = [];
    if (social.instagram) links.push(`<a href="${social.instagram}" target="_blank"><i class="fab fa-instagram"></i> Instagram</a>`);
    if (social.linkedin) links.push(`<a href="${social.linkedin}" target="_blank"><i class="fab fa-linkedin"></i> LinkedIn</a>`);
    if (social.github) links.push(`<a href="${social.github}" target="_blank"><i class="fab fa-github"></i> GitHub</a>`);
    
    if (links.length === 0) {
        return '<div class="detail-item"><h4><i class="fas fa-share-alt"></i> Social Media</h4><p>No social media links added</p></div>';
    }
    
    return `
        <div class="detail-item">
            <h4><i class="fas fa-share-alt"></i> Social Media</h4>
            <div class="social-media">
                ${links.join('')}
            </div>
        </div>
    `;
}

function renderAcademicDetails() {
    const container = document.getElementById('academicDetailsDisplay');
    const academic = userProfile.academic;
    
    if (Object.keys(academic).length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-graduation-cap"></i>
                <h3>No Academic Details</h3>
                <p>Add your academic qualifications to showcase your educational background.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    Object.keys(academic).forEach(level => {
        const details = academic[level];
        html += `
            <div class="academic-level">
                <h3><i class="fas fa-graduation-cap"></i> ${getAcademicLevelName(level)}</h3>
                <div class="academic-details">
                    <div class="detail-item">
                        <h4>Percentage/CGPA</h4>
                        <p>${details.percentage || 'Not specified'}</p>
                    </div>
                    <div class="detail-item">
                        <h4>Board/University</h4>
                        <p>${details.board || 'Not specified'}</p>
                    </div>
                    <div class="detail-item">
                        <h4>School/College</h4>
                        <p>${details.school || 'Not specified'}</p>
                    </div>
                    <div class="detail-item">
                        <h4>Year</h4>
                        <p>${details.year || 'Not specified'}</p>
                    </div>
                    ${details.branch ? `
                        <div class="detail-item">
                            <h4>Branch/Stream</h4>
                            <p>${details.branch}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderCertificates() {
    const container = document.getElementById('certificatesContainer');
    // Remove debugDiv and related debug code
    const addBtn = document.getElementById('addCertBtn');
    let certificates = userProfile.certificates;
    if (!certificates || certificates.length === 0) {
        container.innerHTML = '<div class="text-muted text-center">No certificates found.</div>';
        return;
    }
    let html = '';
    certificates.forEach((cert, index) => {
        html += `
            <div class="certificate-item">
                <div class="certificate-info">
                    <h3>${cert.courseTitle || ''}</h3>
                    <p><strong>Issuer:</strong> ${cert.issuer || 'LearnEdge LMS'}</p>
                    <p><strong>Issue Date:</strong> ${cert.date ? new Date(cert.date).toLocaleDateString() : ''}</p>
                    ${cert.url ? `<p><strong>Verification:</strong> <a href="${cert.url}" target="_blank">View Certificate</a></p>` : ''}
                </div>
                <div class="certificate-actions">
                    <button class="view-btn" onclick="viewCertificateDownload('${currentUser.name}', '${cert.courseTitle || ''}', '${cert.date || ''}')"><i class="fas fa-external-link-alt"></i> View Certificate</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    if (addBtn) addBtn.style.display = (currentUser.type === 'admin' || currentUser.type === 'teacher') ? 'flex' : 'none';
}

async function renderCourses() {
    const container = document.getElementById('coursesContainer');
    const titleElement = document.getElementById('coursesTitle');
    const statsElement = document.getElementById('coursesStats');
    
    if (currentUser.type === 'admin') {
        titleElement.innerHTML = '<i class="fas fa-book"></i> My Courses';
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-shield"></i>
                <h3>Admin Access</h3>
                <p>Admins do not have personal courses. Use the admin panel to manage all courses.</p>
            </div>
        `;
        return;
    }
    
    let courses = [];
    let stats = { total: 0, active: 0, completed: 0 };
    
    try {
        if (currentUser.type === 'student') {
            titleElement.innerHTML = '<i class="fas fa-book"></i> My Enrolled Courses';
            
            // Get enrolled courses from server's db.json
            const response = await fetch(`${API_BASE}/db.json`);
            if (response.ok) {
                const data = await response.json();
                const enrollments = data.enrollments || [];
                const allCourses = data.courses || [];
                
                // Filter enrollments for current user
                const userEnrollments = enrollments.filter(enrollment => 
                    enrollment.studentId === currentUser.id
                );
                
                console.log('Found enrollments for user:', userEnrollments);
                
                courses = userEnrollments.map(enrollment => {
                    // Find the course details by matching the title
                    const courseDetails = allCourses.find(c => c.title === enrollment.courseTitle);
                    return {
                        id: courseDetails ? courseDetails.id : enrollment.id || enrollment.courseTitle,
                        title: enrollment.courseTitle,
                        domain: courseDetails?.domain || 'General',
                        coordinator: courseDetails?.coordinator || 'LearnEdge',
                        level: courseDetails?.level || 'Beginner',
                        duration: courseDetails?.duration || '12 weeks',
                        status: enrollment.status || 'active',
                        enrolledAt: enrollment.enrolledAt || new Date().toISOString(),
                        progress: enrollment.progress || Math.floor(Math.random() * 100) // Mock progress
                    };
                });
                
                stats.total = courses.length;
                stats.active = courses.filter(c => c.status === 'active').length;
                stats.completed = courses.filter(c => c.status === 'completed').length;
            }
        } else if (currentUser.type === 'teacher') {
            titleElement.innerHTML = '<i class="fas fa-chalkboard-teacher"></i> My Teaching Courses';
            
            // Fetch teacher's assigned courses from server's db.json
            const response = await fetch(`${API_BASE}/db.json`);
            if (response.ok) {
                const data = await response.json();
                const teachers = data.teachers || [];
                const allCourses = data.courses || [];
                
                // Find current teacher
                const teacher = teachers.find(t => t.id === currentUser.id);
                
                if (teacher && teacher.courses) {
                    console.log('Teacher courses from db.json:', teacher.courses);
                    
                    courses = teacher.courses.map(courseTitle => {
                        // Find the course details by matching the title
                        const courseDetails = allCourses.find(c => c.title === courseTitle);
                        return {
                            id: courseDetails ? courseDetails.id : courseTitle,
                            title: courseTitle,
                            status: 'teaching',
                            domain: teacher.domain || 'General',
                            coordinator: courseDetails?.coordinator || 'LearnEdge',
                            level: courseDetails?.level || 'Beginner',
                            duration: courseDetails?.duration || '12 weeks',
                            students: teacher.students || 0
                        };
                    });
                    
                    stats.total = courses.length;
                    stats.active = courses.length;
                }
            }
        }
    } catch (error) {
        console.error('Error fetching courses:', error);
        showNotification('Failed to load courses. Please try again.', 'error');
    }
    
    // Render stats
    if (stats.total > 0) {
        statsElement.innerHTML = `
            <div class="stat-item">
                <span class="stat-number">${stats.total}</span>
                <span class="stat-label">Total</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${stats.active}</span>
                <span class="stat-label">Active</span>
            </div>
            ${currentUser.type === 'student' ? `
                <div class="stat-item">
                    <span class="stat-number">${stats.completed}</span>
                    <span class="stat-label">Completed</span>
                </div>
            ` : ''}
        `;
    } else {
        statsElement.innerHTML = '';
    }
    
    if (courses.length === 0) {
        if (currentUser.type === 'teacher') {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chalkboard-teacher"></i>
                    <h3>No Teaching Courses</h3>
                    <p>No teaching courses have been assigned yet. Please contact the administrator.</p>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book"></i>
                    <h3>No Enrolled Courses</h3>
                    <p>You haven't enrolled in any courses yet. Browse our course catalog to get started.</p>
                </div>
            `;
        }
        return;
    }
    
    let html = '';
    courses.forEach(course => {
        const statusClass = course.status === 'active' ? 'active' : course.status === 'teaching' ? 'teaching' : 'completed';
        const statusText = course.status === 'teaching' ? 'Teaching' : course.status === 'active' ? 'Active' : 'Completed';
        
        html += `
            <div class="course-item">
                <div class="course-info">
                    <h3>${course.title}</h3>
                    <p><span class="course-status ${statusClass}">${statusText}</span></p>
                    ${course.domain ? `<p><strong>Domain:</strong> ${course.domain}</p>` : ''}
                    ${course.coordinator ? `<p><strong>Coordinator:</strong> ${course.coordinator}</p>` : ''}
                    ${course.level ? `<p><strong>Level:</strong> ${course.level}</p>` : ''}
                    ${course.duration ? `<p><strong>Duration:</strong> ${course.duration}</p>` : ''}
                    ${course.enrolledAt ? `<p><strong>Enrolled:</strong> ${new Date(course.enrolledAt).toLocaleDateString()}</p>` : ''}
                    ${course.progress ? `<p><strong>Progress:</strong> ${course.progress}%</p>` : ''}
                    ${course.students ? `<p><strong>Students:</strong> ${course.students}</p>` : ''}
                </div>
                <div class="course-actions">
                    <button class="view-btn" onclick="viewCourse('${course.id}', '${course.title}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function setupEditPermissions() {
    const editBasicBtn = document.getElementById('editBasicBtn');
    const editAcademicBtn = document.getElementById('editAcademicBtn');
    const addAcademicBtn = document.getElementById('addAcademicBtn');
    const addCertBtn = document.getElementById('addCertBtn');
    
    // All user types can edit basic and academic details
    editBasicBtn.style.display = 'flex';
    editAcademicBtn.style.display = 'flex';
    addAcademicBtn.style.display = 'flex';
    
    // Only admin and teacher can add certificates
    if (currentUser.type === 'admin' || currentUser.type === 'teacher') {
        addCertBtn.style.display = 'flex';
    } else {
        addCertBtn.style.display = 'none';
    }
}

function showDefaultSection() {
    // Show courses section by default for teachers
    if (currentUser.type === 'teacher') {
        showSection('mycourses');
        updateActiveNav(document.querySelector('[data-section="mycourses"]'));
    } else {
        showSection('basic-details');
        updateActiveNav(document.querySelector('[data-section="basic-details"]'));
    }
}

// Form management functions
function toggleBasicForm() {
    const form = document.getElementById('basicForm');
    const display = document.getElementById('basicDetailsDisplay');
    
    if (isEditingBasic) {
        closeForm(form, display);
        isEditingBasic = false;
    } else {
        // Populate form with current data
        const basic = userProfile.basic;
        document.getElementById('name').value = basic.name || '';
        document.getElementById('dob').value = basic.dob || '';
        document.getElementById('gender').value = basic.gender || '';
        document.getElementById('email').value = basic.email || '';
        document.getElementById('phone').value = basic.phone || '';
        document.getElementById('address').value = basic.address || '';
        document.getElementById('instagram').value = basic.social.instagram || '';
        document.getElementById('linkedin').value = basic.social.linkedin || '';
        document.getElementById('github').value = basic.social.github || '';
        
        openForm(form, display);
        isEditingBasic = true;
    }
}

function cancelBasicForm() {
    document.getElementById('basicForm').style.display = 'none';
    document.getElementById('basicDetailsDisplay').style.display = 'block';
    isEditingBasic = false;
}

async function saveBasicDetails(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(e.target);
        userProfile.basic = {
            name: formData.get('name'),
            dob: formData.get('dob'),
            gender: formData.get('gender'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: formData.get('address'),
            social: {
                instagram: formData.get('instagram'),
                linkedin: formData.get('linkedin'),
                github: formData.get('github')
            }
        };
        
        // Save to localStorage first
        const profileKey = `${currentUser.type}Profile`;
        localStorage.setItem(profileKey, JSON.stringify(userProfile));
        
        // Only save to database if profile has meaningful data
        let dbSuccess = false;
        if (hasProfileData(userProfile)) {
            dbSuccess = await saveProfileToDatabase(userProfile);
        } else {
            console.log('Profile has no meaningful data, skipping database save');
            dbSuccess = true; // Consider it successful since we don't need to save empty profiles
        }
        
        // Update display
        renderBasicDetails();
        cancelBasicForm();
        
        if (dbSuccess) {
            showNotification('Basic details updated successfully!', 'success');
        } else {
            showNotification('Basic details saved locally. Database save failed.', 'error');
        }
    } catch (error) {
        console.error('Error saving basic details:', error);
        showNotification('Failed to save basic details. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function toggleAcademicForm() {
    const form = document.getElementById('academicForm');
    const display = document.getElementById('academicDetailsDisplay');
    
    if (isEditingAcademic) {
        closeForm(form, display);
        isEditingAcademic = false;
    } else {
        openForm(form, display);
        isEditingAcademic = true;
        isAddingAcademic = false;
    }
}

function showAddAcademicForm() {
    const form = document.getElementById('academicForm');
    const display = document.getElementById('academicDetailsDisplay');
    
    // Clear form
    document.getElementById('academicDetailsForm').reset();
    
    openForm(form, display);
    isEditingAcademic = true;
    isAddingAcademic = true;
}

function cancelAcademicForm() {
    document.getElementById('academicForm').style.display = 'none';
    document.getElementById('academicDetailsDisplay').style.display = 'block';
    isEditingAcademic = false;
    isAddingAcademic = false;
}

async function saveAcademicDetails(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(e.target);
        const level = formData.get('academicLevel');
        
        userProfile.academic[level] = {
            percentage: formData.get('percentage'),
            board: formData.get('board'),
            school: formData.get('school'),
            year: formData.get('academicYear'),
            branch: formData.get('branch')
        };
        
        // Save to localStorage first
        const profileKey = `${currentUser.type}Profile`;
        localStorage.setItem(profileKey, JSON.stringify(userProfile));
        
        // Only save to database if profile has meaningful data
        let dbSuccess = false;
        if (hasProfileData(userProfile)) {
            dbSuccess = await saveProfileToDatabase(userProfile);
        } else {
            console.log('Profile has no meaningful data, skipping database save');
            dbSuccess = true; // Consider it successful since we don't need to save empty profiles
        }
        
        // Update display
        renderAcademicDetails();
        cancelAcademicForm();
        
        if (dbSuccess) {
            showNotification('Academic details updated successfully!', 'success');
        } else {
            showNotification('Academic details saved locally. Database save failed.', 'error');
        }
    } catch (error) {
        console.error('Error saving academic details:', error);
        showNotification('Failed to save academic details. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function toggleCertificateForm() {
    const form = document.getElementById('certificateForm');
    const container = document.getElementById('certificatesContainer');
    
    if (isAddingCertificate) {
        closeForm(form, container);
        isAddingCertificate = false;
    } else {
        // Clear form
        document.getElementById('addCertificateForm').reset();
        
        openForm(form, container);
        isAddingCertificate = true;
    }
}

function cancelCertificateForm() {
    document.getElementById('certificateForm').style.display = 'none';
    document.getElementById('certificatesContainer').style.display = 'block';
    isAddingCertificate = false;
}

async function saveCertificate(e) {
    e.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = new FormData(e.target);
        const certificate = {
            title: formData.get('certTitle'),
            issuer: formData.get('certIssuer'),
            date: formData.get('certDate'),
            url: formData.get('certUrl')
        };
        
        userProfile.certificates.push(certificate);
        
        // Save to localStorage first
        const profileKey = `${currentUser.type}Profile`;
        localStorage.setItem(profileKey, JSON.stringify(userProfile));
        
        // Only save to database if profile has meaningful data
        let dbSuccess = false;
        if (hasProfileData(userProfile)) {
            dbSuccess = await saveProfileToDatabase(userProfile);
        } else {
            console.log('Profile has no meaningful data, skipping database save');
            dbSuccess = true; // Consider it successful since we don't need to save empty profiles
        }
        
        // Update display
        renderCertificates();
        cancelCertificateForm();
        
        if (dbSuccess) {
            showNotification('Certificate added successfully!', 'success');
        } else {
            showNotification('Certificate saved locally. Database save failed.', 'error');
        }
    } catch (error) {
        console.error('Error saving certificate:', error);
        showNotification('Failed to add certificate. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

// Utility functions
function openForm(form, display) {
    form.style.display = 'block';
    display.style.display = 'none';
}

function closeForm(form, display) {
    form.style.display = 'none';
    display.style.display = 'block';
}

function closeAllForms() {
    if (isEditingBasic) {
        cancelBasicForm();
    } else if (isEditingAcademic) {
        cancelAcademicForm();
    } else if (isAddingCertificate) {
        cancelCertificateForm();
    }
}

async function saveProfileToDatabase(profileData) {
    try {
        const timestamp = new Date().toISOString();
        const profilePayload = {
            userId: currentUser.id,
            userType: currentUser.type,
            ...profileData,
            lastUpdated: timestamp
        };
        
        // Load current db.json
        const response = await fetch(`${API_BASE}/db.json`);
        if (response.ok) {
            const data = await response.json();
            const profiles = data.profiles || [];
            
            // Check if profile already exists
            const existingProfileIndex = profiles.findIndex(p => p.userId === currentUser.id);
            
            if (existingProfileIndex !== -1) {
                // Update existing profile
                profiles[existingProfileIndex] = profilePayload;
                console.log('Profile updated in database successfully');
            } else {
                // Add new profile
                profilePayload.id = Date.now(); // Simple ID generation
                profiles.push(profilePayload);
                console.log('Profile created in database successfully');
            }
            
            // Save updated data back to db.json
            const saveResponse = await fetch(`${API_BASE}/db.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...data,
                    profiles: profiles
                })
            });
            
            if (saveResponse.ok) {
                console.log('Profile saved to database successfully');
                return true;
            } else {
                console.error('Failed to save profile:', saveResponse.status, saveResponse.statusText);
                throw new Error('Failed to save profile in database');
            }
        } else {
            throw new Error('Failed to load current database');
        }
        
    } catch (error) {
        console.error('Error saving profile to database:', error);
        return false;
    }
}

// Function to check if profile has meaningful data (not just default empty values)
function hasProfileData(profile) {
    // Check if basic info has been filled
    const basic = profile.basic || {};
    if (basic.name && basic.name !== currentUser.name) return true;
    if (basic.dob) return true;
    if (basic.gender) return true;
    if (basic.phone) return true;
    if (basic.address) return true;
    if (basic.social.instagram || basic.social.linkedin || basic.social.github) return true;
    
    // Check if academic info has been added
    const academic = profile.academic || {};
    if (Object.keys(academic).length > 0) return true;
    
    // Check if certificates have been added
    const certificates = profile.certificates || [];
    if (certificates.length > 0) return true;
    
    return false;
}

function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
}

function getAcademicLevelName(level) {
    const names = {
        'X': 'Class X',
        'XII': 'Class XII',
        'UG': 'Undergraduate',
        'PG': 'Postgraduate',
        'PhD': 'PhD'
    };
    return names[level] || level;
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.profile-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        console.log(`Showing section: ${sectionId}`);
        targetSection.classList.add('active');
    }
}

function updateActiveNav(activeLink) {
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to clicked link
    activeLink.classList.add('active');
}

// Action functions
function viewCertificate(url) {
    window.open(url, '_blank');
}

async function deleteCertificate(index) {
    if (confirm('Are you sure you want to delete this certificate?')) {
        try {
            showLoading(true);
            
            userProfile.certificates.splice(index, 1);
            
            // Save to localStorage first
            const profileKey = `${currentUser.type}Profile`;
            localStorage.setItem(profileKey, JSON.stringify(userProfile));
            
            // Only save to database if profile has meaningful data
            let dbSuccess = false;
            if (hasProfileData(userProfile)) {
                dbSuccess = await saveProfileToDatabase(userProfile);
            } else {
                console.log('Profile has no meaningful data, skipping database save');
                dbSuccess = true; // Consider it successful since we don't need to save empty profiles
            }
            
            // Update display
            renderCertificates();
            
            if (dbSuccess) {
                showNotification('Certificate deleted successfully!', 'success');
            } else {
                showNotification('Certificate deleted locally. Database save failed.', 'error');
            }
        } catch (error) {
            console.error('Error deleting certificate:', error);
            showNotification('Failed to delete certificate. Please try again.', 'error');
        } finally {
            showLoading(false);
        }
    }
}

// Update viewCourse to accept both id and title
async function viewCourse(courseId, courseTitle) {
    try {
        console.log('viewCourse called with courseId:', courseId, 'courseTitle:', courseTitle);
        const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
        const userType = loggedInUser ? loggedInUser.type : localStorage.getItem('userType');
        if (userType === 'teacher') {
            localStorage.setItem('selectedCourse', courseTitle);
            window.location.href = '/HTML/teacherCourse.html';
        } else if (userType === 'student') {
            window.location.href = '/HTML/course.html?id=' + encodeURIComponent(courseId);
        } else if (userType === 'admin') {
            localStorage.setItem('selectedCourse', courseId);
            window.location.href = '/HTML/adminCourseManagement.html';
        } else {
            window.location.href = '/HTML/course.html?id=' + encodeURIComponent(courseId);
        }
    } catch (error) {
        console.error('Error navigating to course:', error);
        showNotification('Failed to open course. Please try again.', 'error');
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Logout function
function logoutUser() {
    try {
        localStorage.clear();
        sessionStorage.clear();
        showNotification('You have been logged out successfully.', 'success');
        setTimeout(() => {
            window.location.href = '/HTML/login.html';
        }, 1500);
    } catch (error) {
        console.error('Error during logout:', error);
        window.location.href = '/HTML/login.html';
    }
}

// Export functions for global access
window.viewCertificate = viewCertificate;
window.deleteCertificate = deleteCertificate;
window.viewCourse = viewCourse;
window.logoutUser = logoutUser;

function viewCertificateDownload(studentName, courseTitle, date) {
    // Open certificate.html with params and trigger auto-download
    const url = `/HTML/certificate.html?studentName=${encodeURIComponent(studentName)}&courseTitle=${encodeURIComponent(courseTitle)}&date=${encodeURIComponent(date)}&autoDownload=1`;
    window.open(url, '_blank');
}
