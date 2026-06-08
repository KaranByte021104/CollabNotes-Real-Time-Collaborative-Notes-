import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import * as path from 'path';

// Load environment variables from .env file at backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { User } from '../entities/user.entity';
import { Workspace } from '../entities/workspace.entity';
import { Note } from '../entities/note.entity';
import { ActivityLog, ActivityEventType } from '../entities/activity-log.entity';
import { WorkspaceParticipant } from '../entities/workspace-participant.entity';

const appDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'collab_notes',
  entities: [User, Workspace, Note, ActivityLog, WorkspaceParticipant],
  synchronize: true, // auto-create schema before seeding
});

async function run() {
  console.log('Connecting to database...');
  await appDataSource.initialize();
  console.log('Database connected successfully.');

  const userRepository = appDataSource.getRepository(User);
  const workspaceRepository = appDataSource.getRepository(Workspace);
  const noteRepository = appDataSource.getRepository(Note);
  const logRepository = appDataSource.getRepository(ActivityLog);
  const participantRepository = appDataSource.getRepository(WorkspaceParticipant);

  // 1. Check if test user already exists, or create them
  const testEmail = 'test@example.com';
  let testUser = await userRepository.findOne({ where: { email: testEmail } });
  
  if (!testUser) {
    console.log('Creating test user...');
    testUser = new User();
    testUser.name = 'Test User';
    testUser.email = testEmail;
    testUser.password = await bcrypt.hash('password123', 10);
    testUser = await userRepository.save(testUser);
    console.log('Test user created.');
  } else {
    console.log('Test user already exists.');
  }

  // 2. Check if test workspace already exists, or create it
  const workspaceCode = 'test-workspace-01';
  let testWorkspace = await workspaceRepository.findOne({ where: { code: workspaceCode } });

  if (!testWorkspace) {
    console.log('Creating test workspace...');
    testWorkspace = new Workspace();
    testWorkspace.name = 'My First Workspace';
    testWorkspace.code = workspaceCode;
    testWorkspace.createdBy = testUser;
    testWorkspace = await workspaceRepository.save(testWorkspace);
    console.log('Test workspace created.');

    // 3. Create Notes for workspace
    console.log('Creating associated notes...');
    const welcomeNote = new Note();
    welcomeNote.title = 'Welcome Note';
    welcomeNote.order = 0;
    welcomeNote.content = '{"type":"doc","content":[{"type":"paragraph"}]}';
    welcomeNote.ydocState = null;
    welcomeNote.workspace = testWorkspace;
    await noteRepository.save(welcomeNote);

    const meetingNote = new Note();
    meetingNote.title = 'Meeting Notes';
    meetingNote.order = 1;
    meetingNote.content = '{"type":"doc","content":[{"type":"paragraph"}]}';
    meetingNote.ydocState = null;
    meetingNote.workspace = testWorkspace;
    await noteRepository.save(meetingNote);
    console.log('Associated notes created.');

    // 4. Create Workspace Participant link
    console.log('Adding test user as participant...');
    const participant = new WorkspaceParticipant();
    participant.workspace = testWorkspace;
    participant.user = testUser;
    participant.workspaceId = testWorkspace.id;
    participant.userId = testUser.id;
    await participantRepository.save(participant);
    console.log('Participant added.');

    // 5. Create activity log
    console.log('Creating user_joined activity log...');
    const activityLog = new ActivityLog();
    activityLog.eventType = ActivityEventType.USER_JOINED;
    activityLog.workspace = testWorkspace;
    activityLog.user = testUser;
    activityLog.metadata = { userName: testUser.name };
    await logRepository.save(activityLog);
    console.log('Activity log created.');
  } else {
    console.log('Test workspace already exists.');
  }

  console.log(`Seed complete. Workspace code: ${workspaceCode}`);
  await appDataSource.destroy();
}

run().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
