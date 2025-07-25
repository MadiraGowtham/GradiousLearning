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

// Helper: API endpoints
const API_BASE = '/api';
const ENDPOINTS = {
  student: API_BASE + '/students',
  teacher: API_BASE + '/teachers',
};

const container = document.querySelector('.container');
const userForm = document.getElementById('userForm');
const userIdInput = document.getElementById('userId');
const userRoleInput = document.getElementById('userRole');
const userNameInput = document.getElementById('userName');
const userEmailInput = document.getElementById('userEmail');
const userPasswordInput = document.getElementById('userPassword');
const cancelEditBtn = document.getElementById('cancelEdit');
const userTypeSelect = document.querySelector('.userType');
const searchInput = document.querySelector('.search');

let users = [];
let editing = false;

async function fetchUsers() {
  const [students, teachers] = await Promise.all([
    fetch(ENDPOINTS.student).then(r => r.json()),
    fetch(ENDPOINTS.teacher).then(r => r.json()),
  ]);
  users = [
    ...students.map(u => ({ ...u, type: 'student' })),
    ...teachers.map(u => ({ ...u, type: 'teacher' })),
  ];
  applyFilters();
}

function renderUsers(filtered) {
  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<p>No users found.</p>';
    return;
  }
  filtered.forEach(user => {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.innerHTML = `
      <img src="../images/profileicon.jpeg" alt="Avatar" class="user-avatar" />
      <h3>${user.name}</h3>
      <div class="user-role">${user.type.charAt(0).toUpperCase() + user.type.slice(1)}</div>
      <div class="user-email">${user.email}</div>
      <div class="user-password">${user.password}</div>
      <div class="card-actions">
        <button onclick="editUser('${user.id}', '${user.type}')">Edit</button>
        <button onclick="deleteUser('${user.id}', '${user.type}')">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function applyFilters() {
  const type = userTypeSelect.value;
  const searchValue = searchInput.value.toLowerCase();
  let filtered = users;
  if (type !== 'all') filtered = filtered.filter(u => u.type === type);
  if (searchValue) filtered = filtered.filter(u => u.name.toLowerCase().includes(searchValue));
  renderUsers(filtered);
}

// Add User button logic
const addUserBtn = document.getElementById('addUserBtn');
const usersCrudSection = document.querySelector('.users-crud');
addUserBtn.addEventListener('click', () => {
  userForm.reset();
  userIdInput.value = '';
  editing = false;
  usersCrudSection.style.display = 'block';
  cancelEditBtn.style.display = 'inline-block';
  userNameInput.focus();
});

// Show form when editing
window.editUser = function(id, type) {
  const user = users.find(u => u.id == id && u.type === type);
  if (!user) return;
  editing = true;
  userIdInput.value = user.id;
  userRoleInput.value = user.type;
  userNameInput.value = user.name;
  userEmailInput.value = user.email;
  userPasswordInput.value = user.password;
  usersCrudSection.style.display = 'block';
  cancelEditBtn.style.display = 'inline-block';
  userNameInput.focus();
};

window.deleteUser = async function(id, type) {
  if (!confirm('Delete this user?')) return;
  await fetch(`${ENDPOINTS[type]}/${id}`, { method: 'DELETE' });
  fetchUsers();
};

// Hide form on cancel
cancelEditBtn.onclick = function() {
  userForm.reset();
  editing = false;
  usersCrudSection.style.display = 'none';
  cancelEditBtn.style.display = 'none';
};

// Hide form after submit
userForm.onsubmit = async function(e) {
  e.preventDefault();
  const id = userIdInput.value;
  const type = userRoleInput.value;
  const data = {
    name: userNameInput.value,
    email: userEmailInput.value,
    password: userPasswordInput.value,
  };
  if (editing) {
    await fetch(`${ENDPOINTS[type]}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } else {
    await fetch(ENDPOINTS[type], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
  userForm.reset();
  editing = false;
  usersCrudSection.style.display = 'none';
  cancelEditBtn.style.display = 'none';
  fetchUsers();
};

userTypeSelect.addEventListener('change', applyFilters);
searchInput.addEventListener('input', applyFilters);

// Logout function
function logoutUser() {
  localStorage.clear();
  sessionStorage.clear();
  alert('You have been logged out.');
  window.location.href = '/HTML/login.html';
}

// Profile Initials Avatar Logic
function renderProfileSection() {
  const profileInitials = document.getElementById('profileInitials');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  
  // Try to get admin info from localStorage, fallback to default
  let name = 'Admin User';
  let email = 'admin@example.com';
  let initials = 'AU';
  
  const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
  if (loggedInUser) {
    name = loggedInUser.name || name;
    email = loggedInUser.email || email;
    // Get initials: first letter of first and last name
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      initials = parts[0][0].toUpperCase() + parts[parts.length-1][0].toUpperCase();
    } else if (parts.length === 1) {
      initials = parts[0][0].toUpperCase();
    }
  }
  
  // Render initials avatar (CSS handles styling)
  profileInitials.textContent = initials;
  profileName.textContent = name;
  profileEmail.textContent = email;
}

document.addEventListener('DOMContentLoaded', function() {
  // Check access first
  if (!checkAdminAccess()) {
    return;
  }
  
  // Continue with page initialization
  renderProfileSection();
  fetchUsers();
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const btns = document.querySelectorAll(".btn1");
  const loginButton = btns[btns.length - 1]; // rightmost .btn1 (Login/Profile)
  if (user && loginButton) {
    // Get initials from first and last name
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
    document.getElementById("logout-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
    });
  }
}); 