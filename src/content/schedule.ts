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
  { time: "08:00-08:30", title: "Arrival and Coffee", detail: "" },
  { time: "08:30-09:00", title: "Kickoff & Quests", detail: "" },
  { time: "09:00-10:00", title: "CIQ Challenge", detail: "Work in groups of 3-4" },
  { time: "10:00-11:30", title: "Idea presentations", detail: "Pen and Paper only" },
  { time: "11:30-15:00", title: "Churrasco", detail: "Also time for pool and meetings" },
  { time: "15:00-17:30", title: "Sports", detail: "Last chance to win points" },
  { time: "17:30-18:00", title: "Closing", detail: "" },
];
