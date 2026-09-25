export const INNOVATION_STAGES = [
  "open",
  "partner_assigned",
  "research",
  "prototype",
  "field_pilot",
  "deployment_review",
  "deployed",
] as const;

export type InnovationStage = (typeof INNOVATION_STAGES)[number];

export const INNOVATION_STAGE_LABELS: Record<string, { en: string; hi: string }> = {
  open: { en: "Open for partners", hi: "भागीदारों हेतु खुला" },
  partner_assigned: { en: "Partner assigned", hi: "भागीदार नियुक्त" },
  research: { en: "Research", hi: "अनुसंधान" },
  prototype: { en: "Prototype", hi: "प्रोटोटाइप" },
  field_pilot: { en: "Field Pilot", hi: "क्षेत्रीय परीक्षण" },
  deployment_review: { en: "Deployment Approval", hi: "तैनाती स्वीकृति" },
  deployed: { en: "Deployed / Impact Measurement", hi: "लागू / प्रभाव मापन" },
};

export interface InnovationProject {
  id: string;
  source_report_id: string | null;
  title: string;
  description: string;
  district: string | null;
  category_key: string | null;
  expected_outcome: string | null;
  deadline: string | null;
  status: string;
  assigned_partner_id: string | null;
  research_notes: string | null;
  prototype_url: string | null;
  pilot_notes: string | null;
  deployment_approved: boolean;
  government_comments: string | null;
  created_at: string;
  updated_at: string;
}
