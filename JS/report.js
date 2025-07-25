// JS/report.js - Student Issue Submission
const API_BASE = '/api';
const reportForm = document.getElementById('reportForm');
const formFeedback = document.getElementById('formFeedback');

if (reportForm) {
  reportForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    formFeedback.textContent = '';
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();
    if (!name || !email || !subject || !message) {
      formFeedback.textContent = 'Please fill in all fields.';
      formFeedback.style.color = 'red';
      return;
    }
    // Compose issue object
    const issue = {
      studentName: name,
      studentEmail: email,
      subject,
      description: message,
      date: new Date().toISOString().slice(0, 10),
      status: 'open'
    };
    try {
      const res = await fetch(`${API_BASE}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issue)
      });
      if (!res.ok) throw new Error('Failed to submit issue');
      formFeedback.textContent = 'Your issue has been submitted successfully!';
      formFeedback.style.color = 'green';
      reportForm.reset();
    } catch (err) {
      formFeedback.textContent = 'Failed to submit issue. Please try again.';
      formFeedback.style.color = 'red';
    }
  });
} 