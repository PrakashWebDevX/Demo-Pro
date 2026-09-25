export const DISTRICTS = [
  "Ranchi",
  "Dhanbad",
  "East Singhbhum",
  "Bokaro",
  "Deoghar",
  "Dumka",
  "Hazaribagh",
  "Giridih",
  "Gumla",
  "Palamu",
  "Ramgarh",
  "Koderma",
  "Chatra",
  "Garhwa",
  "Latehar",
  "Lohardaga",
  "Khunti",
  "Simdega",
  "West Singhbhum",
  "Saraikela-Kharsawan",
  "Jamtara",
  "Godda",
  "Pakur",
  "Sahibganj",
];

export const CATEGORY_KEYS = [
  "road_damage",
  "waste",
  "water",
  "streetlight",
  "drainage",
  "safety",
  "education",
  "health",
  "other",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORY_LABELS: Record<string, { en: string; hi: string }> = {
  road_damage: { en: "Road Damage", hi: "सड़क क्षति" },
  waste: { en: "Waste Management", hi: "कचरा प्रबंधन" },
  water: { en: "Water Supply", hi: "जल आपूर्ति" },
  streetlight: { en: "Streetlight", hi: "स्ट्रीट लाइट" },
  drainage: { en: "Drainage", hi: "नाली" },
  safety: { en: "Public Safety", hi: "सार्वजनिक सुरक्षा" },
  education: { en: "School / Education", hi: "विद्यालय / शिक्षा" },
  health: { en: "Health", hi: "स्वास्थ्य" },
  other: { en: "Other", hi: "अन्य" },
};

export const STATUS_FLOW = [
  "submitted",
  "under_review",
  "approved",
  "assigned",
  "in_progress",
  "resolved",
] as const;

export const STATUS_LABELS: Record<string, { en: string; hi: string }> = {
  submitted: { en: "Submitted", hi: "दर्ज किया गया" },
  under_review: { en: "Under Review", hi: "समीक्षा में" },
  approved: { en: "Approved", hi: "स्वीकृत" },
  assigned: { en: "Assigned", hi: "विभाग को सौंपा" },
  in_progress: { en: "In Progress", hi: "कार्य जारी" },
  resolved: { en: "Resolved", hi: "समाधान हो गया" },
  rejected: { en: "Rejected", hi: "अस्वीकृत" },
  info_requested: { en: "More Information Needed", hi: "अधिक जानकारी चाहिए" },
};

export const PRIORITY_LABELS: Record<string, { en: string; hi: string }> = {
  low: { en: "Low", hi: "कम" },
  medium: { en: "Medium", hi: "मध्यम" },
  high: { en: "High", hi: "उच्च" },
};

export const ROLE_LABELS: Record<string, string> = {
  citizen: "Citizen",
  officer: "Government Officer",
  dept_admin: "Department Administrator",
  university: "University / Student Team",
  partner: "Industry / Startup / CSR Partner",
  admin: "Super Admin",
};

export const ROLE_HOME: Record<string, string> = {
  citizen: "/citizen",
  officer: "/officer",
  dept_admin: "/department",
  university: "/partner",
  partner: "/partner",
  admin: "/admin",
};

export const DEMO_ACCOUNTS = [
  {
    role: "citizen",
    email: "citizen@demo.jh",
    password: "Jharkhand#Demo2026",
    name: "Demo Citizen",
    label: "Demo Citizen",
    district: "Ranchi",
  },
  {
    role: "officer",
    email: "officer@demo.jh",
    password: "Jharkhand#Demo2026",
    name: "Officer R. Kumar",
    label: "Demo Government Officer",
    district: "Ranchi",
  },
  {
    role: "dept_admin",
    email: "department@demo.jh",
    password: "Jharkhand#Demo2026",
    name: "Dept. Admin S. Mahto",
    label: "Demo Department Admin",
    district: "Ranchi",
    department_name: "Municipal Administration",
  },
  {
    role: "university",
    email: "university@demo.jh",
    password: "Jharkhand#Demo2026",
    name: "NIT Jamshedpur Student Team",
    label: "Demo University Partner",
    district: "East Singhbhum",
    organization_name: "NIT Jamshedpur",
  },
  {
    role: "partner",
    email: "industry@demo.jh",
    password: "Jharkhand#Demo2026",
    name: "Jharkhand CSR Alliance",
    label: "Demo Industry Partner",
    district: "Ranchi",
    organization_name: "Jharkhand CSR Alliance",
  },
  {
    role: "admin",
    email: "admin@demo.jh",
    password: "Jharkhand#Demo2026",
    name: "Super Admin",
    label: "Demo Super Admin",
    district: "Ranchi",
  },
] as const;

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number];
