/**
 * The event's running order, shown in the Schedule modal. Edit this one array
 * to match the real Combat IQ team event agenda.
 *
 * PLACEHOLDER — replace with the real schedule.
 */
export type ScheduleItem = {
  time: string;
  title: string;
  detail?: string;
};

export const schedule: ScheduleItem[] = [
  { time: "TBD", title: "Welcome & sign-in", detail: "Grab your access code and set up your profile" },
  { time: "TBD", title: "Games begin", detail: "Quests open — start earning points" },
  { time: "TBD", title: "Break" },
  { time: "TBD", title: "Final results", detail: "Leaderboard freezes" },
];
