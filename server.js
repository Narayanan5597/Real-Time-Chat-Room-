const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const http = require('http');
const socketio = require('socket.io');
const User = require('./Models/User');
const Message = require('./Models/Message');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const JWT_SECRET = process.env.JWT_SECRET;
const mongoUri = process.env.MONGO_URI;

mongoose.connect(mongoUri, {
  useNewUrlParser: true, 
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB successfully connected"))
.catch(err => console.log(err));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json()); 

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

app.use(passport.initialize());


passport.use(new LocalStrategy({ usernameField: 'email' },
    async (email, password, done) => {
        const user = await User.findOne({ email });
        console.log("User found:", user); // Log if user is found
        if (!user) return done(null, false, { message: 'Incorrect email.' });

        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Password match:", isMatch); // Log password match result
        if (!isMatch) return done(null, false, { message: 'Incorrect password.' });

        return done(null, user);
    }
));


const generateToken = user => {
    return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
};

app.post('/register', async (req, res) => {
    const { username,email, password } = req.body;
    console.log("Registering user:", req.body); // Log the received data

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        user = new User({ username,email, password: hashedPassword });
        await user.save();
        res.json({ token: generateToken(user), userId: user._id }); // Sending token and userId
    } catch (error) {
        console.error("Error saving user: ", error);
        res.status(500).send("Error registering new user");
    }
});

app.post('/login', passport.authenticate('local', { session: false }), (req, res) => {
    console.log("Login Request:", req.body); // Log the request body
    res.json({ token: generateToken(req.user), userId: req.user.id });
});


app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username').exec(); 
        console.log("Fetched Users:", users); 

        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error); // Log any errors
        res.status(500).send("Error fetching users");
    }
});

app.get('/messages', authenticateToken, async (req, res) => {
    const { userId, contactId } = req.query;
    try {
        const room = [userId, contactId].sort().join('-');
        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: contactId },
                { sender: contactId, receiver: userId }
            ]
        }).exec();
        res.json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).send("Error fetching messages");
    }
});

    
io.on('connection', socket => {
    console.log('New WebSocket connection', socket.id);
  //  socket.emit('chat message', 'Hello from server');

    socket.on('authenticate', ({ token }) => {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.log('Authentication failed:', err.message);
                socket.disconnect();
            } else {
                console.log('Authenticated user:', user);
                socket.user = user;
            }
        });
    });
    socket.on('join', ({ senderId, receiverId }) => {
        const room = [senderId, receiverId].sort().join('-');
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    socket.on('sendMessage', async ({ senderId, receiverId, text }) => {

        console.log('Sender Id:',senderId);
        console.log('Reciever Id: ',receiverId);
        console.log('Text Enetered',text);
        console.log('Socket User:', socket.user)

        if (!socket.user) 
        {
            console.log('No authenticated user associated with this socket');
            return;
        }
        try {
            const message = new Message({ sender: senderId, receiver: receiverId, content: text });
            await message.save();

            // Determine the room and emit the message to it
            const room = [senderId, receiverId].sort().join('-');
            io.to(room).emit('chat message', { sender: senderId, content: text });
            console.log('Message saved and emitted to room:', room);
        } catch (error) {
            console.error("Error saving message: ", error);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


