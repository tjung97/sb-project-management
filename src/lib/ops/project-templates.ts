import type { IssueKind, IssuePriority } from "@/src/types/firestore";

export interface ProjectTemplateIssue {
  title: string;
  description: string;
  kind: IssueKind;
  priority: IssuePriority;
  checklist: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  due_days: number;
  issues: ProjectTemplateIssue[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "new-store-launch",
    name: "New store launch",
    description: "Opening project covering equipment, signage, staffing, training, and launch readiness.",
    due_days: 45,
    issues: [
      {
        title: "Confirm equipment delivery and install",
        description: "Coordinate delivery windows, install date, and verification photos.",
        kind: "onboarding",
        priority: "high",
        checklist: ["Delivery date confirmed", "Install completed", "Photos attached"],
      },
      {
        title: "Finalize signage vendor and install date",
        description: "Track artwork approval, payment, and physical install.",
        kind: "follow_up",
        priority: "high",
        checklist: ["Artwork approved", "Payment complete", "Install date confirmed"],
      },
      {
        title: "Schedule opening team training",
        description: "Make sure managers and shift leads are ready before opening week.",
        kind: "store_work",
        priority: "normal",
        checklist: ["Training dates picked", "Shift leads invited", "Opening checklist reviewed"],
      },
    ],
  },
  {
    id: "equipment-repair",
    name: "Equipment repair",
    description: "Repair flow from report to vendor quote, approval, repair, and verification.",
    due_days: 14,
    issues: [
      {
        title: "Document issue with photo evidence",
        description: "Collect photos, symptoms, impact, and store schedule constraints.",
        kind: "fix",
        priority: "high",
        checklist: ["Photos attached", "Impact documented", "Urgency confirmed"],
      },
      {
        title: "Get vendor repair quote",
        description: "Contact vendor, capture estimate, and request repair window.",
        kind: "follow_up",
        priority: "high",
        checklist: ["Vendor contacted", "Quote attached", "Repair window requested"],
      },
      {
        title: "Verify repair complete",
        description: "Confirm repair with manager and attach final photo if needed.",
        kind: "store_work",
        priority: "normal",
        checklist: ["Repair completed", "Manager verified", "Issue closed"],
      },
    ],
  },
  {
    id: "vendor-setup",
    name: "Vendor setup",
    description: "Onboard a new vendor with contact, pricing, delivery, and payment follow-up.",
    due_days: 21,
    issues: [
      {
        title: "Collect vendor contact and terms",
        description: "Add contact details, payment terms, and delivery expectations.",
        kind: "email",
        priority: "normal",
        checklist: ["Contact saved", "Terms documented", "Delivery day confirmed"],
      },
      {
        title: "Confirm first order and delivery",
        description: "Track first order details and arrival confirmation.",
        kind: "warehouse",
        priority: "normal",
        checklist: ["First order placed", "Delivery received", "Invoice checked"],
      },
    ],
  },
];

export function getProjectTemplate(id: string) {
  return PROJECT_TEMPLATES.find((template) => template.id === id) ?? null;
}
