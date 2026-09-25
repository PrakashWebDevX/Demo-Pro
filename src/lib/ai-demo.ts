/**
 * Prototype AI analysis.
 *
 * Deterministic keyword logic so the demo works without any AI provider.
 * Keep this module the single place where suggestions are produced — a real
 * model can later be called from a server function and return the same shape.
 */

export interface AiSuggestion {
  category_key: string;
  category_label: string;
  priority: "low" | "medium" | "high";
  recommended_department: string;
  duplicate_count: number;
  location_relevance: string;
  next_action: string;
}

const CATEGORY_RULES: Array<{
  key: string;
  label: string;
  department: string;
  words: string[];
}> = [
  {
    key: "waste",
    label: "Waste Management",
    department: "Municipal Administration",
    words: ["garbage", "waste", "bin", "dump", "kachra", "trash", "litter"],
  },
  {
    key: "road_damage",
    label: "Road Damage",
    department: "Road Construction",
    words: ["road", "pothole", "damage", "sadak", "highway", "street damage"],
  },
  {
    key: "water",
    label: "Water Supply",
    department: "Drinking Water and Sanitation",
    words: ["water", "pipeline", "leak", "pani", "tap", "hand pump", "handpump"],
  },
  {
    key: "streetlight",
    label: "Streetlight",
    department: "Energy",
    words: ["light", "streetlight", "dark", "lamp", "bulb", "pole"],
  },
  {
    key: "drainage",
    label: "Drainage",
    department: "Urban Development and Housing",
    words: ["drain", "drainage", "sewer", "waterlogging", "nali", "overflow"],
  },
  {
    key: "safety",
    label: "Public Safety",
    department: "Urban Development and Housing",
    words: ["wire", "unsafe", "collapse", "accident", "danger", "fire"],
  },
  {
    key: "education",
    label: "School / Education",
    department: "School Education",
    words: ["school", "teacher", "classroom", "student", "vidyalaya"],
  },
  {
    key: "health",
    label: "Health",
    department: "Health",
    words: ["hospital", "health", "doctor", "medicine", "clinic", "sub-centre"],
  },
];

const HIGH_PRIORITY_WORDS = [
  "dangerous",
  "danger",
  "accident",
  "urgent",
  "unsafe",
  "emergency",
  "child",
  "collapse",
  "electric",
  "injury",
];

const DEFAULT_DEPARTMENT_BY_CATEGORY: Record<string, string> = {
  road_damage: "Road Construction",
  waste: "Municipal Administration",
  water: "Drinking Water and Sanitation",
  streetlight: "Energy",
  drainage: "Urban Development and Housing",
  safety: "Urban Development and Housing",
  education: "School Education",
  health: "Health",
  other: "Rural Development",
};

export function analyseReport(input: {
  title: string;
  description: string;
  categoryKey: string;
  district?: string;
  existing?: Array<{ category_key: string; district: string; title: string }>;
}): AiSuggestion {
  const text = `${input.title} ${input.description}`.toLowerCase();

  let matched = CATEGORY_RULES.find((rule) => rule.words.some((w) => text.includes(w)));
  if (!matched) {
    matched = CATEGORY_RULES.find((rule) => rule.key === input.categoryKey);
  }

  const categoryKey = matched?.key ?? input.categoryKey ?? "other";
  const department =
    matched?.department ?? DEFAULT_DEPARTMENT_BY_CATEGORY[categoryKey] ?? "Rural Development";

  const priority: AiSuggestion["priority"] = HIGH_PRIORITY_WORDS.some((w) => text.includes(w))
    ? "high"
    : "medium";

  const duplicateCount = (input.existing ?? []).filter(
    (r) => r.category_key === categoryKey && r.district === input.district,
  ).length;

  return {
    category_key: categoryKey,
    category_label: matched?.label ?? "Other",
    priority,
    recommended_department: department,
    duplicate_count: duplicateCount,
    location_relevance: input.district
      ? `Location matched to ${input.district} district records`
      : "Location not provided",
    next_action:
      priority === "high"
        ? `Immediate site inspection, then assign to ${department}`
        : `Verify details and assign to ${department}`,
  };
}
