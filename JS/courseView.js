document.addEventListener("DOMContentLoaded", async () => {
  // Global variables
  const API_BASE_URL = '/api';
  let currentCourse = null;
  let loggedInUser = JSON.parse(localStorage.getItem("loggedInUser"));

  // Initialize the page
  await initializePage();

  async function initializePage() {
    try {
      // Show loading state
      showLoadingState();
      
      // Setup navigation
      setupNavigation();
      
      // Get course ID from URL
      const courseId = new URLSearchParams(window.location.search).get("id");
      if (!courseId) {
        throw new Error("No course ID provided in URL. Please select a course from the course catalog.");
      }

      // Load course data
      await loadCourseData(courseId);
      
      // Setup form handlers
      setupFormHandlers();
      
      // Hide loading state
      hideLoadingState();
      
    } catch (error) {
      console.error("Initialization error:", error);
      showErrorState(error.message);
    }
  }

  function setupNavigation() {
    const nav = document.querySelector("nav");
    if (!nav) return;

    // Add navigation buttons based on user type
    if (loggedInUser) {
      if (loggedInUser.type === "student") {
        insertNavigationButton(nav, "/HTML/report.html", "Report");
        insertNavigationButton(nav, "/HTML/messages.html", "Messages");
      }
      if (loggedInUser.type === "teacher") {
        insertNavigationButton(nav, "/HTML/teacherIndex.html", "Dashboard");
      }
      if (loggedInUser.type === "admin") {
        insertNavigationButton(nav, "/HTML/adminIndex.html", "Admin");
      }
      
      // Replace login with profile dropdown
      replaceLoginWithProfile(loggedInUser.name || "Profile");
    }
  }

  function insertNavigationButton(nav, href, text) {
    const existingButton = nav.querySelector(`a[href="${href}"]`);
    if (existingButton) return;

    const button = document.createElement("a");
    button.href = href;
    button.innerHTML = `<button class="btn">${text}</button>`;
    
    // Insert after "All Courses" button
    const allCoursesBtn = nav.querySelector("a[href='/HTML/AllCourses.html']");
    if (allCoursesBtn) {
      allCoursesBtn.parentNode.insertBefore(button, allCoursesBtn.nextSibling);
    }
  }

  function replaceLoginWithProfile(name) {
    const loginBtn = document.querySelector(".btn1");
    if (!loginBtn) return;

    // Generate initials from the name
    const names = name.split(" ");
    const initials = names.length > 1 
      ? `${names[0][0]}${names[names.length - 1][0]}`
      : names[0][0];

    const dropdown = document.createElement("div");
    dropdown.className = "profile-dropdown";
    dropdown.innerHTML = `
      <button class="btn1 profile-btn">${initials.toUpperCase()}</button>
      <div class="dropdown-content">
        <a href="/HTML/profile.html">View Profile</a>
        <a href="#" onclick="logoutUser()">Logout</a>
      </div>
    `;
    
    loginBtn.replaceWith(dropdown);
  }

  // Make logoutUser function globally accessible
  window.logoutUser = function() {
    localStorage.removeItem("loggedInUser");
    alert("Logged out successfully!");
    window.location.href = "/HTML/login.html";
  };

  async function loadCourseData(courseId) {
    try {
      console.log(`🔍 Loading course data for ID: ${courseId}`);
      let response = await fetch(`${API_BASE_URL}/courses/${courseId}`);
      let foundCourse = null;
      if (response.ok) {
        foundCourse = await response.json();
      }
      // If not found by id, try by title param
      if (!foundCourse) {
        const urlParams = new URLSearchParams(window.location.search);
        const courseTitle = urlParams.get('title');
        if (courseTitle) {
          const allCoursesRes = await fetch(`${API_BASE_URL}/courses`);
          const allCourses = allCoursesRes.ok ? await allCoursesRes.json() : [];
          foundCourse = allCourses.find(c => c.title && c.title.trim().toLowerCase() === courseTitle.trim().toLowerCase());
        }
      }
      // Fallback: try to match by id as string (for string ids)
      if (!foundCourse && courseId) {
        const allCoursesRes = await fetch(`${API_BASE_URL}/courses`);
        const allCourses = allCoursesRes.ok ? await allCoursesRes.json() : [];
        foundCourse = allCourses.find(c => String(c.id) === String(courseId));
      }
      if (!foundCourse) {
        throw new Error(`Course not found (ID: ${courseId}). Please check the course ID and try again.`);
      }
      currentCourse = foundCourse;
      // --- Restrict access if student is certified ---
      // (Removed: allow certified students to view course details)
      // --- End restrict access ---
      console.log(`✅ Course loaded: ${currentCourse.title}`);
      // Update the page with course data
      updateCourseDisplay();
      // Check enrollment status if user is logged in
      if (loggedInUser && loggedInUser.type === "student") {
        await checkEnrollmentStatus(courseId, loggedInUser.id);
      }
    } catch (error) {
      console.error("Error loading course data:", error);
      throw new Error(`Failed to load course: ${error.message}`);
    }
  }

  function updateCourseDisplay() {
    if (!currentCourse) return;

    // Update page title
    document.title = `${currentCourse.title} - LearnEdge LMS`;

    // Update course title
    const titleElement = document.getElementById("courseTitle");
    if (titleElement) {
      titleElement.textContent = currentCourse.title;
    }

    // Update course description
    const descElement = document.getElementById("courseDescription");
    if (descElement) {
      descElement.textContent = currentCourse.description;
    }

    // Update course image
    const imageElement = document.getElementById("courseImage");
    if (imageElement) {
      imageElement.src = currentCourse.img || currentCourse.image || "../images/Consultant.jpeg";
      imageElement.alt = currentCourse.title;
      // Handle image load errors
      imageElement.onerror = function() {
        this.src = "../images/Consultant.jpeg";
      };
    }

    // Update course meta information
    updateCourseMeta();
    
    // Update syllabus
    updateSyllabus();
    
    // Update overview
    updateOverview();
    
    // Update opportunities
    updateOpportunities();
    
    // Update enrollment button
    updateEnrollmentButton();
  }

  function updateCourseMeta() {
    const metaElements = {
      "courseDuration": currentCourse.duration ? `Duration: ${currentCourse.duration}` : "Duration: Not specified",
      "coursePrice": currentCourse.price ? `Price: ${currentCourse.price}` : "Price: Contact for details",
      "courseLevel": currentCourse.level ? `Level: ${currentCourse.level}` : "Level: Not specified",
      "courseEnrolled": currentCourse.enrolled ? `${currentCourse.enrolled} students enrolled` : "Enrollment data not available"
    };

    Object.entries(metaElements).forEach(([id, text]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = text;
      }
    });
  }

  function updateSyllabus() {
    const syllabusList = document.getElementById("syllabusList");
    if (!syllabusList) return;

    if (currentCourse.syllabus && Array.isArray(currentCourse.syllabus) && currentCourse.syllabus.length > 0) {
      syllabusList.innerHTML = currentCourse.syllabus.map((item, index) => `
        <li>
          <b>${item.title || `Week ${item.week || index + 1}`}</b>
          <p>${Array.isArray(item.topics) ? item.topics.join(", ") : "Topics to be announced"}</p>
        </li>
      `).join("");
    } else {
      syllabusList.innerHTML = `
        <li>
          <b>Course Syllabus</b>
          <p>Syllabus will be available soon. This course covers comprehensive topics in ${currentCourse.domain || 'the subject area'}.</p>
        </li>
      `;
    }
  }

  function updateOverview() {
    const overviewContent = document.getElementById("overviewContent");
    if (!overviewContent) return;

    if (currentCourse.overview && typeof currentCourse.overview === 'object') {
      overviewContent.innerHTML = Object.entries(currentCourse.overview).map(([section, points]) => `
        <div class="overview-section">
          <h3>${section}</h3>
          <ul>
            ${Array.isArray(points) ? points.map(point => `<li>${point}</li>`).join("") : ""}
          </ul>
        </div>
      `).join("");
    } else {
      // Generate default overview based on course data
      overviewContent.innerHTML = `
        <div class="overview-section">
          <h3>What you'll learn</h3>
          <ul>
            <li>Comprehensive understanding of ${currentCourse.domain || 'the subject'}</li>
            <li>Hands-on practical experience with real-world projects</li>
            <li>Industry-standard tools and technologies</li>
            <li>Career-ready skills and certification</li>
          </ul>
        </div>
        <div class="overview-section">
          <h3>Course Details</h3>
          <ul>
            <li>Duration: ${currentCourse.duration || 'Flexible'}</li>
            <li>Level: ${currentCourse.level || 'All levels'}</li>
            <li>Coordinator: ${currentCourse.coordinator || 'LearnEdge'}</li>
            <li>Start Date: ${currentCourse.startDate || 'Rolling enrollment'}</li>
          </ul>
        </div>
      `;
    }
  }

  function updateOpportunities() {
    const opportunitiesContainer = document.getElementById("opportunitiesContainer");
    if (!opportunitiesContainer) return;

    if (currentCourse.opportunities && Array.isArray(currentCourse.opportunities) && currentCourse.opportunities.length > 0) {
      opportunitiesContainer.innerHTML = currentCourse.opportunities.map(opp => `
        <div class="opportunity">
          <img src="${opp.image}" alt="${opp.title}" onerror="this.src='../images/Consultant.jpeg'">
          <div class="opportunity-content">
            <h4>${opp.title}</h4>
            <p>${opp.description}</p>
            ${opp.salary ? `<p class="salary">${opp.salary}</p>` : ''}
          </div>
        </div>
      `).join("");
    } else {
      // Generate default opportunities based on domain
      const defaultOpportunities = getDefaultOpportunities(currentCourse.domain);
      opportunitiesContainer.innerHTML = defaultOpportunities.map(opp => `
        <div class="opportunity">
          <img src="${opp.image}" alt="${opp.title}" onerror="this.src='../images/Consultant.jpeg'">
          <div class="opportunity-content">
            <h4>${opp.title}</h4>
            <p>${opp.description}</p>
            <p class="salary">${opp.salary}</p>
          </div>
        </div>
      `).join("");
    }
  }

  function getDefaultOpportunities(domain) {
    const opportunities = {
      "Machine Learning": [
        {
          title: "Machine Learning Engineer",
          description: "Build and deploy ML models in production environments",
          image: "../images/machine-learning-engineer.jpeg",
          salary: "₹10-20 LPA"
        },
        {
          title: "Data Scientist",
          description: "Analyze complex data sets to help organizations make better decisions",
          image: "../images/datascientist.jpeg",
          salary: "₹8-15 LPA"
        }
      ],
      "Data Analytics": [
        {
          title: "Data Analyst",
          description: "Analyze business data to provide insights and recommendations",
          image: "../images/DataAnalytics.jpeg",
          salary: "₹5-12 LPA"
        },
        {
          title: "Business Intelligence Analyst",
          description: "Create reports and dashboards for business decision making",
          image: "../images/bussinessanalyst.jpeg",
          salary: "₹6-15 LPA"
        }
      ],
      "Software Engineering": [
        {
          title: "Software Engineer",
          description: "Design, develop, and maintain software applications",
          image: "../images/SE.jpeg",
          salary: "₹8-18 LPA"
        },
        {
          title: "Full Stack Developer",
          description: "Build complete web applications from frontend to backend",
          image: "../images/FSD.jpeg",
          salary: "₹10-22 LPA"
        }
      ],
      "Full Stack Development": [
        {
          title: "Full Stack Developer",
          description: "Build complete web applications from frontend to backend",
          image: "../images/FSD.jpeg",
          salary: "₹10-22 LPA"
        },
        {
          title: "Frontend Developer",
          description: "Create responsive and interactive user interfaces",
          image: "../images/FSD.jpeg",
          salary: "₹8-18 LPA"
        }
      ],
      "DevOps": [
        {
          title: "DevOps Engineer",
          description: "Implement and manage DevOps practices and tools",
          image: "../images/DevOps.jpeg",
          salary: "₹12-25 LPA"
        },
        {
          title: "Cloud Engineer",
          description: "Manage cloud infrastructure and deployments",
          image: "../images/DevOps.jpeg",
          salary: "₹10-22 LPA"
        }
      ],
      "UI/UX Designing": [
        {
          title: "UI/UX Designer",
          description: "Design intuitive user experiences and stunning interfaces",
          image: "../images/UI:UX.jpeg",
          salary: "₹6-15 LPA"
        },
        {
          title: "Product Designer",
          description: "Create user-centered design solutions",
          image: "../images/UI:UX.jpeg",
          salary: "₹8-18 LPA"
        }
      ]
    };

    return opportunities[domain] || [
      {
        title: "Industry Professional",
        description: "Apply your skills in various industry roles",
        image: "../images/Consultant.jpeg",
        salary: "₹6-15 LPA"
      },
      {
        title: "Consultant",
        description: "Provide expert advice and solutions to organizations",
        image: "../images/Consultant.jpeg",
        salary: "₹8-20 LPA"
      }
    ];
  }

  function updateEnrollmentButton() {
    const enrollButton = document.getElementById("enrollButton");
    if (!enrollButton) return;

    if (!loggedInUser) {
      enrollButton.href = "/HTML/login.html";
      enrollButton.querySelector("button").textContent = "Login to Enroll";
      console.log("🔐 Enrollment button: Login to Enroll");
      return;
    }

    if (loggedInUser.type === "teacher") {
      enrollButton.href = `/HTML/teacherCourse.html?id=${currentCourse.id}`;
      enrollButton.querySelector("button").textContent = "Manage Course";
      console.log("👨‍🏫 Enrollment button: Manage Course");
      return;
    }

    if (loggedInUser.type === "admin") {
      enrollButton.href = `/HTML/adminIndex.html`;
      enrollButton.querySelector("button").textContent = "Admin Panel";
      console.log("👨‍💼 Enrollment button: Admin Panel");
      return;
    }

    // For students, set default state and let checkEnrollmentStatus update it
    enrollButton.href = `/HTML/courseApplication.html?id=${currentCourse.id}`;
    enrollButton.querySelector("button").textContent = "Enroll Now";
    console.log("📝 Enrollment button: Default Enroll Now (will be updated by enrollment check)");
  }

  async function checkEnrollmentStatus(courseId, studentId) {
    try {
      console.log(`🔍 Checking enrollment status for student ${studentId} in course ${courseId}`);
      
      // Check if student is already enrolled
      const enrollmentsResponse = await fetch(`${API_BASE_URL}/enrollments?studentId=${studentId}&courseTitle=${encodeURIComponent(currentCourse.title)}`);
      const enrollments = await enrollmentsResponse.json();
      
      console.log(`📊 Found ${enrollments.length} enrollments for this course`);
      
      if (enrollments.length > 0) {
        console.log("✅ Student is enrolled");
        updateEnrollmentButton("enrolled");
      } else {
        console.log("📝 Student is not enrolled, showing enroll button");
        updateEnrollmentButton("not_enrolled");
      }
      
    } catch (error) {
      console.error("❌ Error checking enrollment status:", error);
      // Default to not enrolled if there's an error
      updateEnrollmentButton("not_enrolled");
    }
  }

  function updateEnrollmentButton(status) {
    const enrollButton = document.getElementById("enrollButton");
    const statusElement = document.getElementById("courseStatus");
    
    if (!enrollButton) return;

    // Reset button styles
    const button = enrollButton.querySelector("button");
    button.style.backgroundColor = "";
    button.style.color = "";
    button.onclick = null;

    switch (status) {
      case "enrolled":
        enrollButton.href = `/HTML/course.html?id=${currentCourse.id}`;
        button.textContent = "Continue Learning";
        button.style.backgroundColor = "#28a745";
        button.style.color = "white";
        if (statusElement) {
          statusElement.textContent = "✓ You are enrolled in this course";
          statusElement.className = "course-status approved";
        }
        console.log("✅ Enrollment button updated: Continue Learning");
        break;
        
      case "not_enrolled":
        enrollButton.href = `/HTML/courseApplication.html?id=${currentCourse.id}`;
        button.textContent = "Enroll Now";
        button.style.backgroundColor = "#007bff";
        button.style.color = "white";
        if (statusElement) {
          statusElement.textContent = "📝 You are not enrolled in this course";
          statusElement.className = "course-status not-enrolled";
        }
        console.log("📝 Enrollment button updated: Enroll Now");
        break;
        
      default:
        enrollButton.href = `/HTML/courseApplication.html?id=${currentCourse.id}`;
        button.textContent = "Enroll Now";
        if (statusElement) {
          statusElement.textContent = "";
          statusElement.className = "course-status";
        }
        console.log("📝 Enrollment button updated: Default Enroll Now");
    }
  }

  function setupFormHandlers() {
    const enquiryForm = document.getElementById("enquiryForm");
    if (enquiryForm) {
      enquiryForm.addEventListener("submit", handleEnquirySubmission);
    }
  }

  async function handleEnquirySubmission(event) {
    event.preventDefault();
    
    const formData = {
      name: document.getElementById("enquiryName").value,
      email: document.getElementById("enquiryEmail").value,
      phone: document.getElementById("enquiryPhone").value,
      message: document.getElementById("enquiryMessage").value,
      courseId: currentCourse.id,
      courseTitle: currentCourse.title,
      timestamp: new Date().toISOString(),
      userId: loggedInUser ? loggedInUser.id : null
    };

    try {
      // In a real application, you would send this to your backend
      // For now, we'll simulate a successful submission
      console.log("Enquiry submitted:", formData);
      
      // Show success message
      showMessage("Thank you for your enquiry! We'll get back to you soon.", "success");
      
      // Reset form
      event.target.reset();
      
    } catch (error) {
      console.error("Error submitting enquiry:", error);
      showMessage("Failed to submit enquiry. Please try again.", "error");
    }
  }

  function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll(".success-message, .error-message");
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageElement = document.createElement("div");
    messageElement.className = type === "success" ? "success-message" : "error-message";
    messageElement.textContent = message;

    // Insert message before the enquiry section
    const enquirySection = document.querySelector(".enquiry");
    if (enquirySection) {
      enquirySection.parentNode.insertBefore(messageElement, enquirySection);
    }

    // Auto-remove message after 5 seconds
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
    }, 5000);
  }

  function showLoadingState() {
    const loadingState = document.getElementById("loadingState");
    const mainContent = document.querySelector("main");
    
    if (loadingState && mainContent) {
      mainContent.style.display = "none";
      loadingState.style.display = "block";
    }
  }

  function hideLoadingState() {
    const loadingState = document.getElementById("loadingState");
    const mainContent = document.querySelector("main");
    
    if (loadingState && mainContent) {
      loadingState.style.display = "none";
      mainContent.style.display = "block";
    }
  }

  function showErrorState(message) {
    const errorState = document.getElementById("errorState");
    const errorMessage = document.getElementById("errorMessage");
    const mainContent = document.querySelector("main");
    
    if (errorState && errorMessage && mainContent) {
      errorMessage.textContent = message;
      mainContent.style.display = "none";
      errorState.style.display = "block";
    }
  }

  // Add search functionality
  const searchBar = document.querySelector(".searchbar");
  if (searchBar) {
    searchBar.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      // You can implement search functionality here
      console.log("Searching for:", searchTerm);
    });
  }
});