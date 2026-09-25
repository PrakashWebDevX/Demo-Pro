import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { EmptyState, Page } from "@/components/app/Page";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { INNOVATION_STAGE_LABELS } from "@/lib/innovation";

export const Route = createFileRoute("/innovation/")({
  head: () => ({
    meta: [
      { title: "Innovation Challenges — Eco-Bridge" },
      {
        name: "description",
        content:
          "Approved civic challenges from Jharkhand districts open to universities, startups and CSR partners.",
      },
      { property: "og:title", content: "Innovation Challenges — Eco-Bridge" },
      {
        property: "og:description",
        content: "Work with the Government of Jharkhand on real local problems.",
      },
    ],
  }),
  component: InnovationList,
});

function InnovationList() {
  const { lang, pick } = useLang();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["innovation-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Page
      title={lang === "en" ? "Innovation Challenges" : "नवाचार चुनौतियाँ"}
      description={
        lang === "en"
          ? "Government-approved local problems open to universities, startups, industries and CSR partners."
          : "सरकार द्वारा स्वीकृत स्थानीय समस्याएँ — विश्वविद्यालय, स्टार्टअप एवं सीएसआर भागीदारों के लिए।"
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {!isLoading && projects.length === 0 ? (
          <EmptyState title={lang === "en" ? "No open challenges" : "कोई चुनौती नहीं"} />
        ) : null}
        {projects.map((p) => (
          <Link
            key={p.id}
            to="/innovation/$id"
            params={{ id: p.id }}
            className="card-surface block p-5 transition-colors hover:bg-muted"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">
              <Lightbulb className="size-4" aria-hidden="true" />
              {pick(INNOVATION_STAGE_LABELS[p.status])}
            </span>
            <h2 className="mt-3 text-lg font-bold">{p.title}</h2>
            <p className="mt-1 line-clamp-3 text-muted-foreground">{p.description}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {p.district ?? "Jharkhand"}
              {p.deadline
                ? ` · ${lang === "en" ? "Deadline" : "अंतिम तिथि"}: ${new Date(p.deadline).toLocaleDateString()}`
                : ""}
            </p>
          </Link>
        ))}
      </div>
    </Page>
  );
}
