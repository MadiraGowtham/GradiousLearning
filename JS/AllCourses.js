// Global variables
const API_BASE_URL = "/api";
let courseData = [];
let visibleCount = 6;
let currentFilters = {
  domain: '',
  coordinator: '',
  level: '',
  duration: '',
  search: ''
};

// DOM elements
const courseSection = document.querySelector(".course-cards");
const searchbar = document.querySelector(".searchbar");
const selectors = document.querySelectorAll(".select");
const loadMoreBtn = document.querySelector(".load-more-btn");
const loginButton = document.querySelector(".btn1");

// Initialize the application
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Check access control first
    if (!checkAccessControl()) {
      return; // Stop execution if access is denied
    }
    
    await initializeApp();
  } catch (error) {
    console.error("Application initialization failed:", error);
    showErrorMessage("Failed to load application. Please refresh the page.");
  }
});

// Access control function
function checkAccessControl() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  
  if (user) {
    // If user is logged in, check their type
    if (user.type === "teacher") {
      alert("Teachers should access their dashboard instead.");
      window.location.href = "/HTML/teacherIndex.html";
      return false;
    } else if (user.type === "admin") {
      alert("Admins should access the admin panel instead.");
      window.location.href = "/HTML/adminIndex.html";
      return false;
    }
    // Students can access this page
  }
  // Non-logged in users can also access this page
  return true;
}

async function initializeApp() {
  // Show loading state
  showLoadingState();
  
  // Load course data
  await loadCourseData();
  
  // Setup UI components
  setupNavigation();
  setupFilters();
  setupSearch();
  
  // Hide loading state
  hideLoadingState();
}

async function loadCourseData() {
  try {
    const response = await fetch(`${API_BASE_URL}/courses`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    courseData = await response.json();
    console.log(`✅ Loaded ${courseData.length} courses from server`);
    
    // Setup the UI
    populateSelectOptions();
    applyFilters();
    
  } catch (error) {
    console.error("❌ Error loading courses:", error);
    
    // Try fallback to local JSON
    try {
      const fallbackResponse = await fetch("../JS/courses.json");
      if (fallbackResponse.ok) {
        courseData = await fallbackResponse.json();
        console.log("📦 Using local JSON fallback");
        populateSelectOptions();
        applyFilters();
      } else {
        throw new Error("Fallback also failed");
      }
    } catch (fallbackError) {
      console.error("❌ Fallback failed:", fallbackError);
      showErrorMessage("Unable to load courses. Please check your connection and try again.");
    }
  }
}

function populateSelectOptions() {
  if (!selectors || selectors.length === 0) return;
  
  const domains = [...new Set(courseData.map(c => c.domain))].filter(Boolean);
  const coordinators = [...new Set(courseData.map(c => c.coordinator))].filter(Boolean);
  const levels = [...new Set(courseData.map(c => c.level))].filter(Boolean);
  const durations = [...new Set(courseData.map(c => c.duration))].filter(Boolean);

  // Domain filter
  selectors[0].innerHTML = `<option value="">All Domains</option>` + 
    domains.map(d => `<option value="${d}">${d}</option>`).join("");

  // Coordinator filter
  selectors[1].innerHTML = `<option value="">All Coordinators</option>` + 
    coordinators.map(c => `<option value="${c}">${c}</option>`).join("");

  // Level filter
  selectors[2].innerHTML = `<option value="">All Levels</option>` + 
    levels.map(l => `<option value="${l}">${l}</option>`).join("");

  // Duration filter
  selectors[3].innerHTML = `<option value="">All Durations</option>` + 
    durations.map(d => `<option value="${d}">${d}</option>`).join("");
}

function setupFilters() {
  if (!selectors) return;
  
  selectors.forEach((select, index) => {
    select.addEventListener("change", (e) => {
      const filterType = ['domain', 'coordinator', 'level', 'duration'][index];
      currentFilters[filterType] = e.target.value;
      visibleCount = 6; // Reset visible count
      applyFilters();
    });
  });
}

function setupSearch() {
  if (!searchbar) return;
  
  let searchTimeout;
  
  searchbar.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
      currentFilters.search = e.target.value.toLowerCase().trim();
      visibleCount = 6; // Reset visible count
      applyFilters();
    }, 300); // Debounce search
  });
  
  // Clear search with Escape key
  searchbar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchbar.value = '';
      currentFilters.search = '';
      applyFilters();
    }
  });
}

function applyFilters() {
  const filtered = courseData.filter(course => {
    // Search filter
    const searchMatch = !currentFilters.search || 
      (course.title && course.title.toLowerCase().includes(currentFilters.search)) ||
      (course.description && course.description.toLowerCase().includes(currentFilters.search)) ||
      (course.domain && course.domain.toLowerCase().includes(currentFilters.search)) ||
      (course.coordinator && course.coordinator.toLowerCase().includes(currentFilters.search));
    
    // Domain filter
    const domainMatch = !currentFilters.domain || course.domain === currentFilters.domain;
    
    // Coordinator filter
    const coordinatorMatch = !currentFilters.coordinator || course.coordinator === currentFilters.coordinator;
    
    // Level filter
    const levelMatch = !currentFilters.level || course.level === currentFilters.level;
    
    // Duration filter
    const durationMatch = !currentFilters.duration || course.duration === currentFilters.duration;
    
    return searchMatch && domainMatch && coordinatorMatch && levelMatch && durationMatch;
  });

  renderCourses(filtered.slice(0, visibleCount));
  
  // Show/hide load more button
  if (loadMoreBtn) {
    loadMoreBtn.style.display = filtered.length > visibleCount ? "block" : "none";
    loadMoreBtn.onclick = () => {
      visibleCount += 6;
      renderCourses(filtered.slice(0, visibleCount));
      if (visibleCount >= filtered.length) {
        loadMoreBtn.style.display = "none";
      }
    };
  }
  
  // Show filter summary
  showFilterSummary(filtered.length, courseData.length);
}

function renderCourses(courses) {
  if (!courseSection) return;
  
  courseSection.innerHTML = "";

  if (courses.length === 0) {
    courseSection.innerHTML = `
      <div class="no-results">
        <h3>No courses found</h3>
        <p>Try adjusting your filters or search terms</p>
        <button onclick="resetAllFilters()" class="btn">Clear All Filters</button>
      </div>
    `;
    return;
  }

  let row = document.createElement("div");
  row.className = "cards-row";

  courses.forEach((course, index) => {
    const card = createCourseCard(course);
    row.appendChild(card);

    // Create new row every 3 cards
    if ((index + 1) % 3 === 0) {
      courseSection.appendChild(row);
      row = document.createElement("div");
      row.className = "cards-row";
    }
  });

  // Add remaining cards
  if (row.children.length > 0) {
    courseSection.appendChild(row);
  }
}

function createCourseCard(course) {
  const card = document.createElement("div");
  card.className = "course-card";
  
  // Handle missing images gracefully
  const imageSrc = course.image || course.img || "../images/Consultant.jpeg";
  const imageAlt = course.title || "Course Image";
  
  card.innerHTML = `
    <div class="card-image">
      <img src="${imageSrc}" alt="${imageAlt}" class="course-img" 
           onerror="this.src='../images/Consultant.jpeg'">
      ${course.enrolled ? `<div class="enrolled-badge">👥 ${course.enrolled}</div>` : ''}
    </div>
    <div class="card-content">
      <h4 class="course-title">${course.title || 'Untitled Course'}</h4>
      <p class="course-provider"><b>Provider:</b> ${course.coordinator || 'LearnEdge'}</p>
      <p class="course-date"><b>Start Date:</b> ${course.startDate || "Coming Soon"}</p>
      <p class="course-duration"><b>Duration:</b> ${course.duration || "TBD"}</p>
      <p class="course-level"><b>Level:</b> ${course.level || "All Levels"}</p>
      <div class="card-actions">
        <a href="/HTML/courseView.html?id=${course.id}" class="view-btn-link">
          <button class="view-btn">View More</button>
        </a>
        ${course.price ? `<span class="course-price">${course.price}</span>` : ''}
      </div>
    </div>
  `;
  
  // Add hover effects
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-5px)';
    card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
  });
  
  return card;
}

function setupNavigation() {
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

function showFilterSummary(filteredCount, totalCount) {
  // Remove existing filter summary
  const existingSummary = document.querySelector('.filter-summary');
  if (existingSummary) {
    existingSummary.remove();
  }
  
  // Create new filter summary
  const summary = document.createElement('div');
  summary.className = 'filter-summary';
  
  if (filteredCount === totalCount) {
    summary.innerHTML = `<p>Showing all ${totalCount} courses</p>`;
  } else {
    summary.innerHTML = `<p>Showing ${filteredCount} of ${totalCount} courses</p>`;
  }
  
  // Insert before course cards
  if (courseSection) {
    courseSection.parentNode.insertBefore(summary, courseSection);
  }
}

function resetAllFilters() {
  // Reset search
  if (searchbar) {
    searchbar.value = '';
  }
  
  // Reset selectors
  selectors.forEach(select => {
    select.value = '';
  });
  
  // Reset current filters
  currentFilters = {
    domain: '',
    coordinator: '',
    level: '',
    duration: '',
    search: ''
  };
  
  // Reset visible count
  visibleCount = 6;
  
  // Apply filters
  applyFilters();
}

function logoutUser() {
  localStorage.removeItem("loggedInUser");
  alert("Logged out successfully!");
  window.location.href = "/HTML/login.html";
}

function showLoadingState() {
  if (courseSection) {
    courseSection.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading courses...</p>
      </div>
    `;
  }
}

function hideLoadingState() {
  // Loading state will be replaced when courses are rendered
}

function showErrorMessage(message) {
  if (courseSection) {
    courseSection.innerHTML = `
      <div class="error-state">
        <h3>⚠️ Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" class="btn">Retry</button>
      </div>
    `;
  }
}

// Export functions for global access
window.resetAllFilters = resetAllFilters;