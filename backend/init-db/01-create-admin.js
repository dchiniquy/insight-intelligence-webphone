// MongoDB initialization script to create default admin user
// This runs when the container starts for the first time

db = db.getSiblingDB('webphone-app');

// Create admin user for development
const adminExists = db.users.findOne({ email: 'admin@webphone.local' });

if (!adminExists) {
  db.users.insertOne({
    username: 'admin',
    email: 'admin@webphone.local',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj5w7UjnzQCy', // hashed 'password123'
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    phone: '+15551234567',
    preferences: {
      theme: 'auto',
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      defaultTwilioNumber: 'don'
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  print('Admin user created: admin@webphone.local / password123');
} else {
  print('Admin user already exists');
}

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.calls.createIndex({ userId: 1, createdAt: -1 });
db.calls.createIndex({ callSid: 1 }, { unique: true });
db.calls.createIndex({ twilioNumber: 1, createdAt: -1 });
db.messages.createIndex({ userId: 1, createdAt: -1 });
db.messages.createIndex({ messageSid: 1 }, { unique: true });
db.messages.createIndex({ twilioNumber: 1, createdAt: -1 });
db.messages.createIndex({ 'thread.threadId': 1, createdAt: 1 });

print('Database indexes created successfully');