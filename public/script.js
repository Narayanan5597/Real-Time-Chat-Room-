document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    // DOM elements
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const messages = document.getElementById('messages');
    const userList = document.getElementById('userList'); // User list container
    const authFormArea = document.getElementById('authFormArea');
    const messageArea = document.getElementById('messageArea');
    const showLoginButton = document.getElementById('showLogin'); // Added button to show login form
    const showRegisterButton = document.getElementById('showRegister'); // Added button to show register form
    let receiverId = null; // ID of the selected receiver


    const token = getToken();
    if (token) {
        socket.emit('authenticate', { token: token });
    }


    showLoginButton.addEventListener('click', () => {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    });

    showRegisterButton.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    // Function to display messages to the user
    function displayMessage(message, isError = false) {
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.style.color = isError ? 'red' : 'green';
        document.body.insertBefore(messageElement, document.body.firstChild);
    }

    function storeToken(token) {
        localStorage.setItem('jwtToken', token);
    }

    function getToken() {
        return localStorage.getItem('jwtToken');
    }

    function storeSenderId(userId) {
        localStorage.setItem('userId', userId);
    }

    function getSenderId() {
        return localStorage.getItem('userId');
    }

    // Fetch and display registered users
    function fetchAndDisplayUsers() {
        fetch('/users', {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        })
        .then(response => response.json())
        .then(users => {
            console.log('Fetched Users:', users);
            displayUsers(users);
            document.getElementById('userListArea').style.display = 'block';

        })
        .catch(error => console.error('Error fetching users:', error));
    }

    function displayUsers(users) {
        userList.innerHTML = '';
        users.forEach(user => { 
            console.log('Creating div for user:', user.username); // Log each user's username
            const userDiv = document.createElement('div');
            userDiv.className = 'user';
            userDiv.setAttribute('data-user-id', user._id);
            userDiv.textContent = user.username;
            userDiv.onclick = () => selectUser(user._id);
            userList.appendChild(userDiv);
        });
    }

    function selectUser(userId) {
        receiverId = userId;
        console.log('Selected User ID:', userId);
        const senderId = getSenderId();
        if (senderId && receiverId) {
            socket.emit('join', { senderId, receiverId });
            fetchChatHistory(senderId, receiverId); // Fetch chat history
        }
        // Additional UI logic for highlighting the selected user can be added here
    }

    function fetchChatHistory(senderId, receiverId) {
        fetch(`/messages?userId=${senderId}&contactId=${receiverId}`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        })
        .then(response => response.json())
        .then(chatMessages => { // Renamed to chatMessages to avoid conflict
            chatMessages.forEach(msg => {
                const item = document.createElement('li');
                const isSender = msg.sender === senderId;
                item.textContent = msg.content;
                item.className = isSender ? 'message sender' : 'message receiver';
                messages.appendChild(item);
            });
            window.scrollTo(0, document.body.scrollHeight);
        })
        .catch(error => console.error('Error fetching chat history:', error));
    }
    

    // Handling login
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log("Login form submitted"); // Check if this gets logged

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        console.log(loginForm);
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        })
        .then(response => 
            {
            if (!response.ok) {
                throw new Error('Login failed');
            }
           return response.json();
        })
        .then(data => {
            console.log('Login successful:', data);
            storeToken(data.token); // Store the received JWT token
            storeSenderId(data.userId); // Store the user's ID
            fetchAndDisplayUsers(); // Fetch and display registered users
            authFormArea.style.display = 'none';
            messageArea.style.display = 'block';
        })
        .catch((error) => {
            console.error('Login error:', error);
            displayMessage('Login failed. Please try again.', true);
        });
    });

    // Handling registration
    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({username,email, password }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Registration failed');
            }
            return response.json();
        })
        .then(data => {
            console.log('Registration successful:', data);
            storeToken(data.token); // Store the received JWT token
            storeSenderId(data.userId); // Store the user's ID
            fetchAndDisplayUsers(); // Fetch and display registered users
            displayMessage('Registration successful. Logging in...');
            authFormArea.style.display = 'none';
            messageArea.style.display = 'block';
        })
       .catch((error) => {
            console.error('Registration error:', error);
            displayMessage('Registration failed. Please try again.', true);
        });
    });

    // Handling new message submission
   // Handling new message submission
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const messageContent = messageInput.value; // Correct variable name
    console.log('The message you got is:', messageContent); // Use messageContent

    const senderId = getSenderId();
    console.log('Token:', token);
    console.log('Receiver ID:', receiverId);
    console.log('Sender Id:', senderId);

    if (token && senderId && receiverId) {
        socket.emit('sendMessage', { senderId, receiverId, text: messageContent, token });
        const item = document.createElement('li');
        item.textContent = `You: ${messageContent}`;
        item.style.color = 'blue';
        messages.appendChild(item);
    } else {
        displayMessage('You are not logged in or no receiver is selected.', true);
    }

    messageInput.value = '';
});


    // Receiving messages from server
    socket.on('chat message', (msg) => {
        // If msg is already an object, no need to parse it
        const { sender, content } = msg;
        const isSender = sender === getSenderId();
        const item = document.createElement('li');
        item.textContent = content;
        item.className = isSender ? 'message sender' : 'message receiver';
        messages.appendChild(item);
        window.scrollTo(0, document.body.scrollHeight);
    });
});
