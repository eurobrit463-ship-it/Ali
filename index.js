const express = require('express');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const db = admin.firestore();
const auth = admin.auth();

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName
    });

    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: email,
      displayName: displayName,
      createdAt: new Date(),
      status: 'offline'
    });

    res.status(201).json({ message: 'User created successfully', uid: userRecord.uid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await auth.getUserByEmail(email);
    
    await db.collection('users').doc(user.uid).update({
      status: 'online',
      lastLogin: new Date()
    });

    res.json({ message: 'Login successful', uid: user.uid });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Send Message
app.post('/api/messages/send', async (req, res) => {
  try {
    const { senderId, receiverId, content, type, mediaUrl } = req.body;

    const message = {
      senderId: senderId,
      receiverId: receiverId,
      content: content,
      type: type, // 'text', 'image', 'video', 'audio'
      mediaUrl: mediaUrl || null,
      timestamp: new Date(),
      read: false
    };

    const docRef = await db.collection('messages').add(message);
    
    res.status(201).json({ 
      message: 'Message sent successfully',
      messageId: docRef.id,
      data: message 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Messages Between Two Users
app.get('/api/messages/:userId1/:userId2', async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    const messages = await db.collection('messages')
      .where('senderId', 'in', [userId1, userId2])
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const data = messages.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ messages: data });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get User Profile
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.collection('users').doc(userId).get();

    if (!user.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.data() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update User Status
app.put('/api/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    await db.collection('users').doc(userId).update({
      status: status,
      lastSeen: new Date()
    });

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
