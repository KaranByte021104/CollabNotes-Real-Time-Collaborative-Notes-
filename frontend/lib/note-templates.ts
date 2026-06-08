export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  iconName: string;
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start with a clean slate.',
    iconName: 'FileText',
    content: JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph' }]
    })
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    description: 'Attendees, Agenda, action items, and next steps.',
    iconName: 'ClipboardList',
    content: JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Meeting Notes' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Date: ' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Attendees' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Attendee 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Attendee 2' }] }] }
          ]
        },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Agenda' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Write down the main topics discussed...' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Action Items' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[ ] Define project milestones' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[ ] Assign task owners' }] }] }
          ]
        },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Next Steps' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Plan for the next sync meeting...' }] }
      ]
    })
  },
  {
    id: 'todo-list',
    name: 'To-Do List',
    description: 'Track your personal or team checklist tasks.',
    iconName: 'ListTodo',
    content: JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'To-Do List' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Here is a list of tasks that need to be accomplished today:' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[ ] High Priority Task 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[ ] Task 2' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[ ] Low Priority Task 3' }] }] }
          ]
        }
      ]
    })
  },
  {
    id: 'project-brief',
    name: 'Project Brief',
    description: 'Overview, goals, timeline, and success metrics.',
    iconName: 'Heading',
    content: JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Project Brief' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Project Overview' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Provide a brief summary of the project...' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Goals & Objectives' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Goal 1: Improve efficiency by 20%' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Goal 2: Streamline user onboarding flow' }] }] }
          ]
        },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Scope' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Detail the scope of work...' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Timeline' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Define milestones and dates...' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Stakeholders' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'List the key people involved...' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Success Metrics' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'How will success be measured?' }] }
      ]
    })
  },
  {
    id: 'weekly-planner',
    name: 'Weekly Planner',
    description: 'Stay organized Monday through Friday.',
    iconName: 'Calendar',
    content: JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Weekly Planner' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Monday' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tasks for Monday' }] }] }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Tuesday' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tasks for Tuesday' }] }] }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Wednesday' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tasks for Wednesday' }] }] }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Thursday' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tasks for Thursday' }] }] }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Friday' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Tasks for Friday' }] }] }] }
      ]
    })
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Pros, cons, ideas, and action steps.',
    iconName: 'Lightbulb',
    content: JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Brainstorm Session' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Main Idea' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Describe the main topic or question...' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Pros' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Pro 1' }] }] }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Cons' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Con 1' }] }] }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Next Steps' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Actions to execute on this brainstorm...' }] }
      ]
    })
  }
];
