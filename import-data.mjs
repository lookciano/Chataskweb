import mysql from 'mysql2/promise';
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./export-data.json', 'utf-8'));

const conn = await mysql.createConnection({
  host: 'gateway01.us-west-2.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2Mw1uKGJBXSbjfA.root',
  password: 'QPTG65yoXzvT7xap',
  database: 'test',
  ssl: { rejectUnauthorized: true }
});

// Import users
console.log('Importing users...');
for (const row of data.users) {
  await conn.execute(
    'INSERT INTO users (id, openId, displayName, email, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [row.id, row.openId, row.displayName || row.name, row.email, row.role || 'user', row.createdAt]
  );
}
console.log('Users: ' + data.users.length + ' imported');

// Import chat_rooms
console.log('Importing chat_rooms...');
for (const row of data.chatRooms) {
  await conn.execute(
    'INSERT INTO chat_rooms (id, name, description, createdBy, createdAt) VALUES (?, ?, ?, ?, ?)',
    [row.id, row.name, row.description, row.createdBy, row.createdAt]
  );
}
console.log('Chat rooms: ' + data.chatRooms.length + ' imported');

// Import chat_room_participants
console.log('Importing chat_room_participants...');
for (const row of data.chatRoomParticipants) {
  const user = data.users.find(u => u.id === row.userId);
  const displayName = user ? (user.displayName || user.name) : 'Unknown';
  await conn.execute(
    'INSERT INTO chat_room_participants (id, roomId, userId, displayName, joinedAt) VALUES (?, ?, ?, ?, ?)',
    [row.id, row.chatRoomId, row.userId, displayName, row.joinedAt]
  );
}
console.log('Participants: ' + data.chatRoomParticipants.length + ' imported');

// Import messages
console.log('Importing messages...');
for (const row of data.messages) {
  await conn.execute(
    'INSERT INTO messages (id, roomId, userId, content, senderName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [row.id, row.chatRoomId, row.senderId, row.content, null, row.createdAt]
  );
}
console.log('Messages: ' + data.messages.length + ' imported');

// Import tasks
console.log('Importing tasks...');
for (const row of data.tasks) {
  await conn.execute(
    'INSERT INTO tasks (id, roomId, taskNumber, description, assignedToName, status, priority, dueDate, createdAt, updatedAt, completedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [row.id, row.chatRoomId, row.taskNumber || 0, row.description, row.assignedToName, row.status, row.priority || 'medium', row.dueDate, row.createdAt, row.updatedAt, row.status === 'completed' ? row.updatedAt : null]
  );
}
console.log('Tasks: ' + data.tasks.length + ' imported');

console.log('All data imported successfully!');
await conn.end();
