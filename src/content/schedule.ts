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

/**
 * The "What to bring" tab in the Schedule modal. Edit this list to match the
 * day — `detail` is the optional smaller line under each item.
 */
export type BringItem = {
  item: string;
  detail?: string;
};

export const bring: BringItem[] = [
  { item: "NO COMPUTER", detail: "Not needed!" },
  { item: "Your phone", detail: "It's the game controller" },
  { item: "Swimwear & towel", detail: "There's a pool" },
  { item: "Sportswear", detail: "For the afternoon sports" },
  { item: "Sunscreen & a hat", detail: "We'll be outside" },
  { item: "Insect repellent", detail: "To keep bugs away" },
];
