// Access control - only teachers can access this page
function checkTeacherAccess() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  
  if (!user) {
    alert("Please log in to access this page.");
    window.location.href = "/HTML/login.html";
    return false;
  }
  
  if (user.type !== "teacher") {
    alert("This page is only accessible to teachers.");
    if (user.type === "student") {
      window.location.href = "/HTML/index.html";
    } else if (user.type === "admin") {
      window.location.href = "/HTML/adminIndex.html";
    } else {
      window.location.href = "/HTML/login.html";
    }
    return false;
  }
  
  return true;
}

// Setup navigation with profile dropdown
function setupNavigation() {
  const loginButton = document.getElementById("loginButton");
  if (!loginButton) return;
  
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  
  if (user) {
    // Create profile dropdown
    const names = user.name.split(" ");
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
    
    // Add logout functionality
    document.getElementById("logout-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
    });
  }
}

// Global logout function
function logoutUser() {
  localStorage.clear();
  sessionStorage.clear();
  alert("You have been logged out.");
  window.location.href = "/HTML/login.html";
}

// Setup navigation when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Check access first
  if (!checkTeacherAccess()) {
    return;
  }
  
  // Setup navigation
  setupNavigation();
  
  // Continue with page initialization
  loadTeacherCourses();
});

async function loadTeacherCourses() {
            const coursesContainer = document.getElementById('coursesContainer');
            
            // Get logged-in teacher's email
            const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
            const teacherEmail = loggedInUser && loggedInUser.type === 'teacher' ? loggedInUser.email : null;
            
            if (!teacherEmail) {
                coursesContainer.innerHTML = '<p class="no-courses">Please log in as a teacher to view courses.</p>';
                return;
            }
            
            try {
                // Fetch teacher data from server
                const response = await fetch(`/api/teachers?email=${teacherEmail}`);
                const teacherArr = await response.json();
                
                if (teacherArr.length === 0) {
                    coursesContainer.innerHTML = '<p class="no-courses">Teacher not found. Please log in again.</p>';
                    return;
                }
                
                const teacher = teacherArr[0];
                const teacherCourses = teacher.courses || [];
                const teacherDomain = teacher.domain || '';
                
                if (teacherCourses.length === 0) {
                    coursesContainer.innerHTML = '<p class="no-courses">No courses found for this teacher.</p>';
                    return;
                }
                
                // Update page title with domain
                if (teacherDomain) {
                    document.title = `${teacherDomain} - My Courses`;
                }
                
                coursesContainer.innerHTML = '';
                
                teacherCourses.forEach(course => {
                    const courseDiv = document.createElement('div');
                    courseDiv.className = 'course';
                    
                    // Determine image based on domain
                    let courseImage = '../images/MachineLearning.jpeg'; // default
                    if (teacherDomain.toLowerCase().includes('data analytics')) {
                        courseImage = '../images/DataAnalytics.jpeg';
                    } else if (teacherDomain.toLowerCase().includes('software engineering')) {
                        courseImage = '../images/SE.jpeg';
                    } else if (teacherDomain.toLowerCase().includes('full stack')) {
                        courseImage = '../images/FSD.jpeg';
                    } else if (teacherDomain.toLowerCase().includes('devops')) {
                        courseImage = '../images/DevOps.jpeg';
                    } else if (teacherDomain.toLowerCase().includes('ui/ux')) {
                        courseImage = '../images/UI:UX.jpeg';
                    }
                    
                    courseDiv.innerHTML = `
                        <div class="info">
                            <img src="${courseImage}" alt="${course}" class="course-img">
                            <h3>${course}</h3>
                        </div>
                        <div class="buttons">
                            <button class="btn" onclick="viewCourse('${course}', '${teacherDomain}')">View Course</button>
                            <button class="btn" onclick="uploadMaterial('${course}')">Upload Material</button>
                            <button class="btn" onclick="viewSubmissions('${course}')">View Submissions</button>
                        </div>
                    `;
                    
                    coursesContainer.appendChild(courseDiv);
                });
                
            } catch (error) {
                console.error('Error loading teacher courses:', error);
                coursesContainer.innerHTML = '<p class="no-courses">Error loading courses. Please try again later.</p>';
            }
        }
        
        function viewCourse(course, domain) {
            // Map course to description and company (with correct image extension)
            const courseDetailsMap = {
                "Introduction to Machine Learning": {
                    description: "This course provides foundational understanding of key ML concepts, algorithms, and applications.",
                    company: "Microsoft" // Microsoft.png
                },
                "Full Stack Development": {
                    description: "Learn to build robust web applications using modern technologies.",
                    company: "Google" // Google.png
                },
                "Data Analytics": {
                    description: "Master data analysis, visualization, and business intelligence.",
                    company: "IBM" // IBM.jpeg
                }
                // Add more courses as needed, and use the correct extension in teacherCourse.html
            };
            localStorage.setItem('selectedCourse', course);
            localStorage.setItem('selectedDomain', domain);
            localStorage.setItem('selectedDescription', courseDetailsMap[course]?.description || "");
            localStorage.setItem('selectedCompany', courseDetailsMap[course]?.company || "");
            window.location.href = '/HTML/teacherCourse.html';
        }
        function uploadMaterial(course) {
            viewCourse(course, localStorage.getItem('teacherDomain'));
            // Optionally, you can set a flag for upload mode
        }
        function viewSubmissions(course) {
            viewCourse(course, localStorage.getItem('teacherDomain'));
            // Optionally, you can set a flag for submissions mode
        }