/**
 * The mock world behind the landing preview. Kept in one place so the areas, their projects
 * and the tasks underneath actually add up — a visitor clicking through should find the
 * same numbers everywhere, the way they would in the real app.
 */

export interface PreviewTask {
  title: string
  status: 'done' | 'in_progress' | 'paused' | 'idea'
  difficulty: 'S' | 'M' | 'L'
}

export interface PreviewProject {
  id: string
  title: string
  status: 'in_progress' | 'paused' | 'blocked' | 'idea'
  waited: string
  leftOff: string
  nextStep: string
  tasks: PreviewTask[]
}

export interface PreviewArea {
  id: string
  name: string
  icon: string
  colour: string
  projects: PreviewProject[]
}

export const AREAS: PreviewArea[] = [
  {
    id: 'work',
    name: 'Work',
    icon: 'pi-briefcase',
    colour: 'rgb(76 141 255)',
    projects: [
      {
        id: 'onboarding',
        title: 'Rewrite the onboarding email',
        status: 'in_progress',
        waited: '6 days',
        leftOff: 'Second draft written, still too long',
        nextStep: 'Cut the second paragraph, then send to Ada',
        tasks: [
          { title: 'Pull the old open rates', status: 'done', difficulty: 'S' },
          { title: 'Draft the new version', status: 'done', difficulty: 'M' },
          { title: 'Cut it down to one screen', status: 'in_progress', difficulty: 'S' },
          { title: 'Ask Ada to review', status: 'idea', difficulty: 'S' },
        ],
      },
      {
        id: 'q3',
        title: 'Q3 report',
        status: 'paused',
        waited: '2 weeks',
        leftOff: 'Numbers pulled, narrative not started',
        nextStep: 'Write the one-paragraph summary first',
        tasks: [
          { title: 'Export the numbers', status: 'done', difficulty: 'M' },
          { title: 'Write the summary', status: 'paused', difficulty: 'L' },
          { title: 'Make the charts', status: 'idea', difficulty: 'M' },
        ],
      },
      {
        id: 'hiring',
        title: 'Hiring page copy',
        status: 'blocked',
        waited: '9 days',
        leftOff: 'Waiting on the team photos',
        nextStep: 'Chase Deniz about the photos',
        tasks: [{ title: 'Collect team photos', status: 'paused', difficulty: 'S' }],
      },
    ],
  },
  {
    id: 'home',
    name: 'Home',
    icon: 'pi-home',
    colour: 'rgb(62 213 152)',
    projects: [
      {
        id: 'tax',
        title: 'Tax folder',
        status: 'paused',
        waited: '11 days',
        leftOff: 'Most receipts scanned, two missing',
        nextStep: 'Photograph the last two receipts',
        tasks: [
          { title: 'Scan January–June', status: 'done', difficulty: 'L' },
          { title: 'Photograph the last two', status: 'paused', difficulty: 'S' },
        ],
      },
      {
        id: 'shelf',
        title: 'Put up the hallway shelf',
        status: 'idea',
        waited: '3 weeks',
        leftOff: 'Bought the brackets, never opened the box',
        nextStep: 'Find the drill bits',
        tasks: [{ title: 'Find the drill bits', status: 'idea', difficulty: 'S' }],
      },
    ],
  },
  {
    id: 'writing',
    name: 'Writing',
    icon: 'pi-pencil',
    colour: 'rgb(255 168 76)',
    projects: [
      {
        id: 'chapter-3',
        title: 'Chapter 3 — the middle section',
        status: 'paused',
        waited: '3 weeks',
        leftOff: 'Mira is in the kitchen and the scene has stalled',
        nextStep: 'Decide whether Mira leaves before the storm',
        tasks: [
          { title: 'Reread chapter 2', status: 'done', difficulty: 'S' },
          { title: 'Write the kitchen scene', status: 'paused', difficulty: 'L' },
          { title: 'Fix the timeline', status: 'idea', difficulty: 'M' },
        ],
      },
    ],
  },
  {
    id: 'learning',
    name: 'Learning',
    icon: 'pi-book',
    colour: 'rgb(168 132 255)',
    projects: [
      {
        id: 'postgres',
        title: 'Finish the Postgres course',
        status: 'in_progress',
        waited: '4 days',
        leftOff: 'Halfway through indexes',
        nextStep: 'Watch the partial-index lesson',
        tasks: [
          { title: 'Section 1–4', status: 'done', difficulty: 'L' },
          { title: 'Indexes', status: 'in_progress', difficulty: 'M' },
        ],
      },
    ],
  },
]

/** Threads across every area, oldest first — what Today actually shows. */
export const HANGING = AREAS.flatMap((area) =>
  area.projects
    .filter((project) => project.status !== 'idea')
    .map((project) => ({ ...project, areaName: area.name, areaColour: area.colour })),
).sort((a, b) => Number(b.waited.split(' ')[0]) - Number(a.waited.split(' ')[0]))
