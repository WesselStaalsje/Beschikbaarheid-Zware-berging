export const DEPOTS = [
  "Eindhoven",
  "Duiven",
  "Breda",
  "Roosendaal",
  "Ermelo",
  "Ede",
  "Veghel",
  "Hulten",
] as const;

export const PLUS_ROSTER = [
  { id: "eindhoven-twan", name: "Twan", depot: "Eindhoven" },
  { id: "eindhoven-simon", name: "Simon", depot: "Eindhoven" },
  { id: "duiven-erik", name: "Erik", depot: "Duiven" },
  { id: "duiven-hans-peter", name: "Hans-Peter", depot: "Duiven" },
  { id: "breda-arthur", name: "Arthur", depot: "Breda" },
  { id: "roosendaal-jorgen", name: "Jörgen", depot: "Roosendaal" },
  { id: "ermelo-jordi", name: "Jordi", depot: "Ermelo" },
  { id: "ede-timothy", name: "Timothy", depot: "Ede" },
  { id: "veghel-paul", name: "Paul", depot: "Veghel" },
] as const;

export const PLUS_ROSTER_BY_ID: Map<string, (typeof PLUS_ROSTER)[number]> = new Map(PLUS_ROSTER.map((responder) => [responder.id, responder]));
