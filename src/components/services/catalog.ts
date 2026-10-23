// Static scope copy for the Field Engineer service; the service list itself now lives in the database.
export const fieldEngineerScope = {
  in: ["Engineer deployment under the agreed visit-count or man-day model", "Installation, basic configuration, testing, and issue troubleshooting", "Standard working hours and defined coverage locations", "Daily or visit-wise reporting and closure sign-off"],
  out: ["Work beyond agreed hours, holidays, or night shifts", "Travel, lodging, and boarding outside the agreed location limit", "Height work, hot work, or activity requiring special safety clearance", "Tools, ladders, lifts, consumables, or OEM-level advanced support unless agreed"],
};
