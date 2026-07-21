import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'gateway01.us-west-2.prod.aws.tidbcloud.com',
  port: 4000,
  user: '2Mw1uKGJBXSbjfA.root',
  password: 'QPTG65yoXzvT7xap',
  database: 'sys',
  ssl: { rejectUnauthorized: true },
  multipleStatements: true
});

const sql = `
CREATE TABLE IF NOT EXISTS users (
  id int AUTO_INCREMENT PRIMARY KEY,
  openId varchar(255) NOT NULL,
  displayName varchar(255) NOT NULL,
  email varchar(255),
  avatarUrl text,
  role enum('admin','user') NOT NULL DEFAULT 'user',
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY \`users_openId_unique\` (\`openId\`)
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id int AUTO_INCREMENT PRIMARY KEY,
  name varchar(255) NOT NULL,
  description text,
  createdBy int,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_room_participants (
  id int AUTO_INCREMENT PRIMARY KEY,
  roomId int NOT NULL,
  userId int NOT NULL,
  displayName varchar(255) NOT NULL,
  joinedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY \`room_participant_unique\` (\`roomId\`, \`userId\`)
);

CREATE TABLE IF NOT EXISTS messages (
  id int AUTO_INCREMENT PRIMARY KEY,
  roomId int NOT NULL,
  userId int,
  content text NOT NULL,
  senderName varchar(255),
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id int AUTO_INCREMENT PRIMARY KEY,
  roomId int NOT NULL,
  taskNumber int NOT NULL,
  description text NOT NULL,
  assignedToName varchar(255),
  status enum('pending','completed') NOT NULL DEFAULT 'pending',
  priority enum('low','medium','high') NOT NULL DEFAULT 'medium',
  dueDate timestamp,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completedAt timestamp,
  UNIQUE KEY \`task_room_number_unique\` (\`roomId\`, \`taskNumber\`)
);
`;

try {
  await conn.query(sql);
  console.log('All tables created successfully!');
  
  const [tables] = await conn.execute('SHOW TABLES');
  console.log('Tables in database:', JSON.stringify(tables));
} catch(e) {
  console.error('Error:', e.message);
} finally {
  await conn.end();
}
