// Dynamic Messaging System for LearnEdge LMS
class MessagingSystem {
    constructor() {
        this.currentUser = null;
        this.currentChat = null;
        this.selectedMessage = null;
        this.blockedUsers = new Set();
        this.apiBase = '/api';
        this.chats = new Map(); // Store chats in memory for now
        this.refreshInterval = null;
        
        this.init();
    }

    async init() {
        try {
            // Check authentication
            const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
            if (!loggedInUser) {
                this.redirectToLogin();
                return;
            }

            this.currentUser = loggedInUser;
            
            // Load blocked users
            await this.loadBlockedUsers();
            
            // Load existing chats from database
            await this.loadExistingChats();
            
            // Initialize UI
            this.initializeUI();
            
            // Load contacts and chats
            await this.loadContacts();
            
            // Start real-time updates
            this.startRealTimeUpdates();
            
            console.log('Messaging system initialized successfully');
        } catch (error) {
            console.error('Failed to initialize messaging system:', error);
            this.showNotification('Failed to initialize messaging system', 'error');
        }
    }

    initializeUI() {
        // Initialize new UI elements
        this.initializeNewUI();
        
        // Initialize legacy UI elements for compatibility
        this.initializeLegacyUI();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    initializeNewUI() {
        // New UI elements
        this.elements = {
            courseFilter: document.getElementById('courseFilter'),
            contactsList: document.getElementById('contactsList'),
            chatUserDetails: document.getElementById('chatUserDetails'),
            chatUserAvatar: document.getElementById('chatUserAvatar'),
            chatMessages: document.getElementById('chatMessages'),
            replyInput: document.getElementById('replyInput'),
            sendBtn: document.getElementById('sendBtn'),
            forwardBtn: document.getElementById('forwardBtn'),
            deleteBtn: document.getElementById('deleteBtn'),
            blockBtn: document.getElementById('blockBtn')
        };

        // Initialize empty state
        this.showEmptyState();
    }

    initializeLegacyUI() {
        // Legacy UI elements for compatibility
        this.legacyElements = {
            filter: document.querySelector('.contacts .filter'),
            contacts: document.querySelector('.contacts'),
            chatDetails: document.getElementById('chat-details'),
            legacyReplyInput: document.querySelector('.reply input'),
            legacySendBtn: document.querySelector('.reply .btn')
        };
    }

    setupEventListeners() {
        // Send message functionality
        if (this.elements.sendBtn) {
            this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (this.elements.replyInput) {
            this.elements.replyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Action buttons
        if (this.elements.forwardBtn) {
            this.elements.forwardBtn.addEventListener('click', () => this.forwardMessage());
        }

        if (this.elements.deleteBtn) {
            this.elements.deleteBtn.addEventListener('click', () => this.deleteMessage());
        }

        if (this.elements.blockBtn) {
            this.elements.blockBtn.addEventListener('click', () => this.toggleBlockUser());
        }

        // Course filter
        if (this.elements.courseFilter) {
            this.elements.courseFilter.addEventListener('change', () => this.onCourseFilterChange());
        }

        // Legacy compatibility
        if (this.legacyElements.legacySendBtn) {
            this.legacyElements.legacySendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (this.legacyElements.legacyReplyInput) {
            this.legacyElements.legacyReplyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }

    async loadContacts() {
        try {
            const { teachers, students, courses, enrollments } = await this.fetchAllResources();
            
            if (this.currentUser.type === 'teacher') {
                await this.loadTeacherContacts(teachers, students, enrollments);
            } else if (this.currentUser.type === 'student') {
                await this.loadStudentContacts(teachers, students, enrollments);
            }
        } catch (error) {
            console.error('Failed to load contacts:', error);
            this.showNotification('Failed to load contacts', 'error');
        }
    }

    async loadTeacherContacts(teachers, students, enrollments) {
        const teacher = teachers.find(t => t.id === this.currentUser.id);
        if (!teacher || !teacher.courses || teacher.courses.length === 0) {
            this.showNoCoursesMessage();
            return;
        }

        console.log('Loading teacher contacts for:', teacher.name);
        console.log('Teacher courses:', teacher.courses);

        // Show course filter
        this.showCourseFilter(teacher.courses);
        
        // Load first course by default
        if (teacher.courses.length > 0) {
            await this.loadContactsForCourse(teacher.courses[0], teachers, students, enrollments);
        }
    }

    async loadStudentContacts(teachers, students, enrollments) {
        const studentEnrollments = enrollments.filter(e => e.studentId === this.currentUser.id);
        const enrolledCourses = studentEnrollments.map(e => e.courseTitle);

        if (enrolledCourses.length === 0) {
            this.showNoCoursesMessage();
            return;
        }

        if (enrolledCourses.length > 1) {
            // Show course filter for multiple courses
            this.showCourseFilter(enrolledCourses);
            await this.loadContactsForCourse(enrolledCourses[0], teachers, students, enrollments);
        } else {
            // Hide filter for single course
            this.hideCourseFilter();
            await this.loadContactsForCourse(enrolledCourses[0], teachers, students, enrollments);
        }
    }

    async loadContactsForCourse(courseTitle, teachers, students, enrollments) {
        this.clearContacts();

        const contacts = [];

        if (this.currentUser.type === 'teacher') {
            // For teachers: show students enrolled in this course
            const enrolledStudentIds = enrollments
                .filter(e => e.courseTitle === courseTitle)
                .map(e => e.studentId);
            
            console.log('Course:', courseTitle);
            console.log('Enrolled student IDs:', enrolledStudentIds);
            
            const enrolledStudents = students.filter(s => enrolledStudentIds.includes(s.id));
            console.log('Enrolled students:', enrolledStudents);
            
            enrolledStudents.forEach(student => {
                contacts.push({
                    id: student.id,
                    name: student.name + ' (Student)',
                    type: 'student',
                    course: courseTitle,
                    avatar: student.avatar || '../images/profileicon.jpeg'
                });
            });
        } else if (this.currentUser.type === 'student') {
            // For students: show teachers and fellow students
            // Add teachers for this course
            const courseTeachers = teachers.filter(t => t.courses && t.courses.includes(courseTitle));
            courseTeachers.forEach(teacher => {
                contacts.push({
                    id: teacher.id,
                    name: teacher.name + ' (Instructor)',
                    type: 'teacher',
                    course: courseTitle,
                    avatar: teacher.avatar || '../images/profileicon.jpeg'
                });
            });

            // Add fellow students for this course
            const coStudentIds = enrollments
                .filter(e => e.courseTitle === courseTitle && e.studentId !== this.currentUser.id)
                .map(e => e.studentId);
            
            const coStudents = students.filter(s => coStudentIds.includes(s.id));
            coStudents.forEach(student => {
                contacts.push({
                    id: student.id,
                    name: student.name + ' (Student)',
                    type: 'student',
                    course: courseTitle,
                    avatar: student.avatar || '../images/profileicon.jpeg'
                });
            });
        }

        // Add contacts to UI
        contacts.forEach(contact => this.addContactToUI(contact));

        if (contacts.length === 0) {
            this.showNoContactsMessage();
        }
    }

    addContactToUI(contact) {
        // Add to new UI
        if (this.elements.contactsList) {
            const contactElement = this.createContactElement(contact);
            this.elements.contactsList.appendChild(contactElement);
        }

        // Add to legacy UI for compatibility
        if (this.legacyElements.contacts) {
            const legacyContactElement = this.createLegacyContactElement(contact);
            this.legacyElements.contacts.appendChild(legacyContactElement);
        }
    }

    createContactElement(contact) {
        const contactDiv = document.createElement('div');
        contactDiv.className = 'contact';
        contactDiv.setAttribute('data-id', contact.id);
        contactDiv.setAttribute('data-course', contact.course);
        
        contactDiv.innerHTML = `
            <img src="${contact.avatar}" alt="Contact" class="img">
            <div class="details">
                <h3>${contact.name}</h3>
                <p>${contact.id}</p>
                <small>${contact.course}</small>
            </div>
        `;

        contactDiv.addEventListener('click', () => this.openChat(contact));
        return contactDiv;
    }

    createLegacyContactElement(contact) {
        const contactDiv = document.createElement('div');
        contactDiv.className = 'contact';
        contactDiv.innerHTML = `
            <img src="${contact.avatar}" alt="Contact" class="img">
            <div class="details">
                <h3>${contact.name}</h3>
                <p>${contact.id}</p>
                <small>${contact.course}</small>
            </div>
        `;
        contactDiv.addEventListener('click', () => this.openChat(contact));
        return contactDiv;
    }

    async openChat(contact) {
        try {
            // Update UI to show selected contact
            this.selectContact(contact);
            
            // Load or create chat
            const chat = await this.getOrCreateChat(contact.id, contact.course);
            this.currentChat = chat;
            
            // Load messages
            await this.loadChatMessages(chat);
            
            // Enable input
            this.enableChatInput();
            
            // Update chat header
            this.updateChatHeader(contact);
            
            console.log('Chat opened:', contact);
        } catch (error) {
            console.error('Failed to open chat:', error);
            this.showNotification('Failed to open chat', 'error');
        }
    }

    async getOrCreateChat(contactId, course) {
        // Create a unique chat key
        const chatKey = [this.currentUser.id, contactId, course].sort().join('_');
        
        // Check if chat exists in memory
        if (this.chats.has(chatKey)) {
            return this.chats.get(chatKey);
        }
        
        // Try to load existing chat from API
        try {
            const response = await fetch(`${this.apiBase}/chats`);
            if (response.ok) {
                const allChats = await response.json();
                const existingChat = allChats.find(chat => 
                    chat.participants.includes(this.currentUser.id) && 
                    chat.participants.includes(contactId) && 
                    chat.course === course
                );
                
                if (existingChat) {
                    this.chats.set(chatKey, existingChat);
                    return existingChat;
                }
            }
        } catch (error) {
            console.log('No existing chat found, creating new one');
        }
        
        // Create new chat
        const newChat = {
            id: chatKey,
            participants: [this.currentUser.id, contactId].sort(),
            course: course,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save new chat to database
        try {
            const response = await fetch(`${this.apiBase}/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newChat)
            });
            
            if (response.ok) {
                const savedChat = await response.json();
                this.chats.set(chatKey, savedChat);
                return savedChat;
            }
        } catch (error) {
            console.error('Failed to save chat to database:', error);
        }
        
        this.chats.set(chatKey, newChat);
        return newChat;
    }

    async loadChatMessages(chat) {
        this.clearChatMessages();
        
        if (!chat.messages || chat.messages.length === 0) {
            this.showEmptyChatState();
            return;
        }

        const messagesContainer = this.elements.chatMessages;
        const chatHistory = document.createElement('div');
        chatHistory.className = 'chat-history';

        chat.messages.forEach((message, index) => {
            const messageElement = this.createMessageElement(message, index);
            chatHistory.appendChild(messageElement);
        });

        messagesContainer.appendChild(chatHistory);
        this.scrollToBottom();
    }

    createMessageElement(message, index) {
        const isOwnMessage = message.senderId === this.currentUser.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-bubble ${isOwnMessage ? 'sent' : 'received'}`;
        messageDiv.setAttribute('data-message-id', message.id);
        messageDiv.setAttribute('data-index', index);
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageDiv.innerHTML = `
            ${message.forwardedFrom ? '<div class="forwarded-indicator"><i class="fas fa-share"></i> Forwarded</div>' : ''}
            <div class="message-text">${this.escapeHtml(message.text)}</div>
            <div class="message-timestamp">${timestamp}</div>
        `;

        messageDiv.addEventListener('click', () => this.selectMessage(message, messageDiv));
        return messageDiv;
    }

    async sendMessage() {
        if (!this.currentChat) {
            this.showNotification('Please select a contact to chat with', 'error');
            return;
        }

        const input = this.elements.replyInput || this.legacyElements.legacyReplyInput;
        const text = input.value.trim();

        if (!text) {
            return;
        }

        try {
            // Disable send button and show loading
            this.setSendButtonLoading(true);

            // Create new message
            const newMessage = {
                id: Date.now().toString(),
                senderId: this.currentUser.id,
                text: text,
                timestamp: new Date().toISOString(),
                forwardedFrom: null
            };
            
            // Add message to chat
            this.currentChat.messages.push(newMessage);
            this.currentChat.updatedAt = new Date().toISOString();
            
            // Save updated chat to database
            try {
                const response = await fetch(`${this.apiBase}/chats/${this.currentChat.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.currentChat)
                });
                
                if (!response.ok) {
                    console.error('Failed to save message to database');
                }
            } catch (error) {
                console.error('Failed to save message to database:', error);
            }
            
            // Clear input
            input.value = '';
            
            // Add message to UI
            this.addMessageToUI(newMessage);
            
            // Scroll to bottom
            this.scrollToBottom();
            
            console.log('Message sent successfully');
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showNotification('Failed to send message', 'error');
        } finally {
            this.setSendButtonLoading(false);
        }
    }

    addMessageToUI(message) {
        const messagesContainer = this.elements.chatMessages;
        let chatHistory = messagesContainer.querySelector('.chat-history');
        
        if (!chatHistory) {
            chatHistory = document.createElement('div');
            chatHistory.className = 'chat-history';
            messagesContainer.appendChild(chatHistory);
        }

        const messageElement = this.createMessageElement(message, chatHistory.children.length);
        chatHistory.appendChild(messageElement);
    }

    async deleteMessage() {
        if (!this.selectedMessage) {
            this.showNotification('Please select a message to delete', 'error');
            return;
        }

        if (this.selectedMessage.senderId !== this.currentUser.id) {
            this.showNotification('You can only delete your own messages', 'error');
            return;
        }

        try {
            // Remove message from chat
            const messageIndex = this.currentChat.messages.findIndex(m => m.id === this.selectedMessage.id);
            if (messageIndex !== -1) {
                this.currentChat.messages.splice(messageIndex, 1);
                this.currentChat.updatedAt = new Date().toISOString();
                
                // Save updated chat to database
                try {
                    const response = await fetch(`${this.apiBase}/chats/${this.currentChat.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(this.currentChat)
                    });
                    
                    if (!response.ok) {
                        console.error('Failed to save deleted message to database');
                    }
                } catch (error) {
                    console.error('Failed to save deleted message to database:', error);
                }
            }

            // Remove message from UI
            const messageElement = document.querySelector(`[data-message-id="${this.selectedMessage.id}"]`);
            if (messageElement) {
                messageElement.remove();
            }

            this.selectedMessage = null;
            this.updateActionButtons();
            this.showNotification('Message deleted successfully', 'success');
        } catch (error) {
            console.error('Failed to delete message:', error);
            this.showNotification('Failed to delete message', 'error');
        }
    }

    async forwardMessage() {
        if (!this.selectedMessage) {
            this.showNotification('Please select a message to forward', 'error');
            return;
        }

        // Show forward modal
        this.showForwardModal();
    }

    async toggleBlockUser() {
        if (!this.currentChat) {
            return;
        }

        const contactId = this.currentChat.participants.find(p => p !== this.currentUser.id);
        const isBlocked = this.blockedUsers.has(contactId);

        try {
            if (isBlocked) {
                this.blockedUsers.delete(contactId);
                this.elements.blockBtn.innerHTML = '<i class="fas fa-ban"></i> Block';
            } else {
                this.blockedUsers.add(contactId);
                this.elements.blockBtn.innerHTML = '<i class="fas fa-user-check"></i> Unblock';
            }

            // Save to localStorage
            localStorage.setItem(`blockedUsers_${this.currentUser.id}`, JSON.stringify([...this.blockedUsers]));

            this.showNotification(`User ${isBlocked ? 'unblocked' : 'blocked'} successfully`, 'success');
        } catch (error) {
            console.error('Failed to toggle block:', error);
            this.showNotification(`Failed to ${isBlocked ? 'unblock' : 'block'} user`, 'error');
        }
    }

    // UI Helper Methods
    selectContact(contact) {
        // Remove active class from all contacts
        document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
        
        // Add active class to selected contact
        const contactElement = document.querySelector(`[data-id="${contact.id}"]`);
        if (contactElement) {
            contactElement.classList.add('active');
        }
    }

    selectMessage(message, element) {
        // Remove selected class from all messages
        document.querySelectorAll('.message-bubble').forEach(m => m.classList.remove('selected'));
        
        // Add selected class to clicked message
        element.classList.add('selected');
        this.selectedMessage = message;
        
        this.updateActionButtons();
    }

    updateActionButtons() {
        const hasSelectedMessage = this.selectedMessage !== null;
        const isOwnMessage = this.selectedMessage && this.selectedMessage.senderId === this.currentUser.id;

        if (this.elements.forwardBtn) {
            this.elements.forwardBtn.disabled = !hasSelectedMessage;
        }

        if (this.elements.deleteBtn) {
            this.elements.deleteBtn.disabled = !hasSelectedMessage || !isOwnMessage;
        }
    }

    enableChatInput() {
        if (this.elements.replyInput) {
            this.elements.replyInput.disabled = false;
        }
        if (this.elements.sendBtn) {
            this.elements.sendBtn.disabled = false;
        }
        if (this.legacyElements.legacyReplyInput) {
            this.legacyElements.legacyReplyInput.disabled = false;
        }
        if (this.legacyElements.legacySendBtn) {
            this.legacyElements.legacySendBtn.disabled = false;
        }
    }

    updateChatHeader(contact) {
        if (this.elements.chatUserDetails) {
            this.elements.chatUserDetails.innerHTML = `
                <h3>${contact.name}</h3>
                <p>${contact.id} • ${contact.course}</p>
            `;
        }

        if (this.elements.chatUserAvatar) {
            // Remove "(Instructor)" or "(Student)" from name for initials
            const cleanName = contact.name.replace(/\s*\([^)]*\)/g, '');
            const names = cleanName.split(' ').filter(name => name.length > 0);
            
            let initials;
            if (names.length >= 2) {
                // Use first letter of first name and first letter of last name
                initials = `${names[0][0]}${names[names.length - 1][0]}`;
            } else if (names.length === 1) {
                // Use first two letters of single name
                initials = names[0].substring(0, 2);
            } else {
                // Fallback to first two letters of full name
                initials = cleanName.substring(0, 2);
            }
            
            this.elements.chatUserAvatar.textContent = initials.toUpperCase();
        }

        // Update legacy UI
        if (this.legacyElements.chatDetails) {
            this.legacyElements.chatDetails.innerHTML = `
                <h3>${contact.name}</h3>
                <p>${contact.id}</p>
            `;
        }
    }

    showEmptyState() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to Messages</h3>
                    <p>Select a contact from the sidebar to start chatting</p>
                </div>
            `;
        }
    }

    showEmptyChatState() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>No messages yet</h3>
                    <p>Start the conversation by sending a message</p>
                </div>
            `;
        }
    }

    clearContacts() {
        if (this.elements.contactsList) {
            this.elements.contactsList.innerHTML = '';
        }
        if (this.legacyElements.contacts) {
            const contacts = this.legacyElements.contacts.querySelectorAll('.contact');
            contacts.forEach(c => c.remove());
        }
    }

    clearChatMessages() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        }
    }

    showCourseFilter(courses) {
        if (this.elements.courseFilter) {
            this.elements.courseFilter.style.display = 'block';
            this.elements.courseFilter.innerHTML = `
                <option selected disabled>Filter By Course</option>
                ${courses.map(course => `<option value="${course}">${course}</option>`).join('')}
            `;
        }
    }

    hideCourseFilter() {
        if (this.elements.courseFilter) {
            this.elements.courseFilter.style.display = 'none';
        }
    }

    showNoCoursesMessage() {
        this.clearContacts();
        if (this.elements.contactsList) {
            this.elements.contactsList.innerHTML = `
                <div class="contact">
                    <div class="details">
                        <h3>No courses found</h3>
                        <p>Please enroll in a course to start messaging</p>
                    </div>
                </div>
            `;
        }
    }

    showNoContactsMessage() {
        if (this.elements.contactsList) {
            this.elements.contactsList.innerHTML = `
                <div class="contact">
                    <div class="details">
                        <h3>No contacts found</h3>
                        <p>No one is enrolled in this course yet</p>
                    </div>
                </div>
            `;
        }
    }

    setSendButtonLoading(loading) {
        const sendBtn = this.elements.sendBtn || this.legacyElements.legacySendBtn;
        if (sendBtn) {
            if (loading) {
                sendBtn.innerHTML = '<span class="loading"></span> Sending...';
                sendBtn.disabled = true;
            } else {
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
                sendBtn.disabled = false;
            }
        }
    }

    scrollToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    // Real-time updates
    startRealTimeUpdates() {
        this.refreshInterval = setInterval(() => {
            if (this.currentChat) {
                this.refreshChat();
            }
        }, 3000); // Refresh every 3 seconds
    }

    async refreshChat() {
        try {
            const response = await fetch(`${this.apiBase}/chats/${this.currentChat.id}`);
            if (response.ok) {
                const updatedChat = await response.json();
                if (updatedChat.messages.length !== this.currentChat.messages.length) {
                    this.currentChat = updatedChat;
                    await this.loadChatMessages(updatedChat);
                }
            }
        } catch (error) {
            console.error('Failed to refresh chat:', error);
        }
    }

    // Utility methods
    async fetchAllResources() {
        const [teachers, students, courses, enrollments] = await Promise.all([
            fetch(`${this.apiBase}/teachers`).then(res => res.json()),
            fetch(`${this.apiBase}/students`).then(res => res.json()),
            fetch(`${this.apiBase}/courses`).then(res => res.json()),
            fetch(`${this.apiBase}/enrollments`).then(res => res.json())
        ]);
        return { teachers, students, courses, enrollments };
    }

    async loadBlockedUsers() {
        // For now, load from localStorage
        try {
            const blockedIds = JSON.parse(localStorage.getItem(`blockedUsers_${this.currentUser.id}`) || '[]');
            this.blockedUsers = new Set(blockedIds);
        } catch (error) {
            console.error('Failed to load blocked users:', error);
            this.blockedUsers = new Set();
        }
    }

    async loadExistingChats() {
        try {
            const response = await fetch(`${this.apiBase}/chats`);
            if (response.ok) {
                const allChats = await response.json();
                
                // Load chats where current user is a participant
                allChats.forEach(chat => {
                    if (chat.participants && chat.participants.includes(this.currentUser.id)) {
                        const chatKey = chat.id;
                        this.chats.set(chatKey, chat);
                    }
                });
                
                console.log('Loaded existing chats:', this.chats.size);
            }
        } catch (error) {
            console.error('Failed to load existing chats:', error);
        }
    }

    showNotification(message, type = 'success') {
        // Use the notification system from the HTML if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#28a745' : '#dc3545'};
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                z-index: 10000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    redirectToLogin() {
        alert('Please log in to access messages.');
        window.location.href = '/HTML/login.html';
    }

    // Event handlers
    async onCourseFilterChange() {
        const selectedCourse = this.elements.courseFilter.value;
        if (selectedCourse && selectedCourse !== 'Filter By Course') {
            try {
                const { teachers, students, courses, enrollments } = await this.fetchAllResources();
                await this.loadContactsForCourse(selectedCourse, teachers, students, enrollments);
            } catch (error) {
                console.error('Failed to load contacts for course:', error);
                this.showNotification('Failed to load contacts for selected course', 'error');
            }
        }
    }

    // Modal methods
    showForwardModal() {
        // Implementation for forward modal
        console.log('Show forward modal');
    }

    // Cleanup
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize messaging system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
    
    if (!loggedInUser) {
        alert('Please log in to access messages.');
        window.location.href = '/HTML/login.html';
        return;
    }
    
    // Check if user is a student or teacher
    if (loggedInUser.type !== 'student' && loggedInUser.type !== 'teacher') {
        alert('Messages are only available for students and teachers.');
        if (loggedInUser.type === 'admin') {
            window.location.href = '/HTML/adminIndex.html';
        } else {
            window.location.href = '/HTML/login.html';
        }
        return;
    }
    
    // Initialize the messaging system
    window.messagingSystem = new MessagingSystem();
});

// Export for global access
window.MessagingSystem = MessagingSystem;