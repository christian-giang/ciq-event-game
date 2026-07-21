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
  { time: "10:00-11:00", title: "Group presentations", detail: "Pen and Paper only" },
  { time: "11:00-12:00", title: "Free Time / Meetings", detail: "" },
  { time: "12:00-14:00", title: "Churrasco", detail: "" },
  { time: "14:00-15:00", title: "Free Time / Meetings", detail: "" },
  { time: "15:00-17:30", title: "Sports / Pool", detail: "" },
  { time: "17:30-18:00", title: "Closing", detail: "" },
];
