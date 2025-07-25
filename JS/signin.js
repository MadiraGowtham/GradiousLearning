const apiURL = "/api";

document.querySelector("form").addEventListener("submit", async function(e) {
    e.preventDefault();

    const firstName = document.querySelector(".fname").value.trim();
    const lastName = document.querySelector(".lname").value.trim();
    const email = document.querySelectorAll("input")[2].value.trim();
    const phone = document.querySelector(".number").value.trim();
    const password = document.querySelectorAll("input")[5].value;
    const confirmPassword = document.querySelectorAll("input")[6].value;

    // Validation
    if (!firstName || !lastName || !email || !phone || !password) {
        alert("Please fill in all fields");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    // Check if email already exists
    try {
        const emailCheck = await fetch(`${apiURL}/students?email=${email}`);
        const existingUsers = await emailCheck.json();
        
        if (existingUsers.length > 0) {
            alert("Email already registered!");
            return;
        }

        // Create new student
        const newStudent = {
            name: `${firstName} ${lastName}`,
            email: email,
            password: password,
            phone: phone,
            domain: "General", // Default domain
            score: 0,
            assignments: {
                completed: 0,
                pending: 0,
                overdue: 0
            },
            attendance: 0,
            quizTypes: {
                MCQ: 0,
                Written: 0,
                Project: 0
            },
            activityLog: [new Date().toISOString().split('T')[0]] // Current date
        };

        const response = await fetch(`${apiURL}/students`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newStudent)
        });

        if (response.ok) {
            alert("Registration successful! Redirecting to login...");
            window.location.href = "/HTML/login.html";
        } else {
            throw new Error("Failed to create account");
        }

    } catch (error) {
        console.error("Registration error:", error);
        alert("Registration failed. Please try again later.");
    }
});