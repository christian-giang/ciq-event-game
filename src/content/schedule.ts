/**
 * The evening's running order, shown in the Schedule modal. The couple
 * edits this one array to match the real day.
 */
export type ScheduleItem = {
  time: string;
  title: string;
  detail?: string;
};

export const schedule: ScheduleItem[] = [
  { time: "6:00 – 6:30 PM", title: "Reception & pictures" },
  {
    time: "7:30 – 8:00 PM",
    title: "Opening",
    detail: "Music, first dance, then the floor opens for everyone",
  },
  { time: "8:30 – 9:00 PM", title: "Dinner" },
  { time: "10:00 PM", title: "Dinner ends", detail: "at the latest" },
  { time: "11:00 PM – 12:00 AM", title: "Cake" },
  { time: "1:00 AM", title: "End" },
];
