const apiURL = "/api";

document.querySelector("form").addEventListener("submit", async function(e) {
    e.preventDefault();

    const email = document.querySelector("input[name='email']").value.trim();
    const password = document.querySelector("input[name='password']").value.trim();

    if (!email || !password) {
        alert("Please enter both email and password");
        return;
    }

    try {
        // Check server availability first
        const serverCheck = await fetch(apiURL);
        if (!serverCheck.ok) {
            throw new Error("Server not responding");
        }

        // Check all user types sequentially
        const userTypes = ['students', 'teachers', 'admins'];
        let user = null;
        let userType = null;

        for (const type of userTypes) {
            const response = await fetch(`${apiURL}/${type}?email=${email}&password=${password}`);
            const data = await response.json();
            
            if (data.length > 0) {
                user = data[0];
                userType = type.slice(0, -1); // Remove 's' from end (students -> student)
                break;
            }
        }

        if (user) {
            // Prepare user data for storage
            const userData = {
                id: user.id,
                name: user.name,
                email: user.email,
                type: userType,
                ...(userType === 'student' && {
                    domain: user.domain,
                    score: user.score
                }),
                ...(userType === 'teacher' && {
                    courses: user.courses || []
                })
            };

            // Store user session
            localStorage.setItem("loggedInUser", JSON.stringify(userData));
            
            // Redirect based on role
            const redirectPaths = {
                'admin': '/HTML/adminIndex.html',
                'teacher': '/HTML/teacherIndex.html',
                'student': '/HTML/index.html'
            };
            
            window.location.href = redirectPaths[userType] || '/HTML/index.html';

        } else {
            alert("Invalid email or password!");
        }

    } catch (error) {
        console.error("Login error:", error);
        alert("Login service unavailable. Please try again later.");
    }
});