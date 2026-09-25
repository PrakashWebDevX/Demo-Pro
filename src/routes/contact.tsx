import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Cpu, GraduationCap, Landmark, LifeBuoy } from "lucide-react";
import { Page } from "@/components/app/Page";
import contactArt from "@/assets/contact-illustration.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Eco-Bridge" },
      {
        name: "description",
        content: "Contact citizen support, government, innovation and technical teams.",
      },
      { property: "og:title", content: "Contact Us — Eco-Bridge" },
      {
        property: "og:description",
        content: "We are here to help citizens and partner organizations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

const CARDS = [
  { icon: LifeBuoy, title: "Citizen Support", email: "support@civicconnect.demo", text: "Help with reporting or tracking an issue." },
  { icon: Landmark, title: "Government Partnership", email: "government@civicconnect.demo", text: "For department onboarding and issue management." },
  { icon: GraduationCap, title: "University and Innovation Partnership", email: "innovation@civicconnect.demo", text: "For research, prototype, and pilot collaboration." },
  { icon: Cpu, title: "Technical Support", email: "tech@civicconnect.demo", text: "For platform and account support." },
];

const USER_TYPES = ["Citizen", "Government", "University", "Industry", "Other"] as const;

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(255),
  subject: z.string().trim().min(3, "Please add a subject").max(150),
  message: z.string().trim().min(10, "Message should be at least 10 characters").max(2000),
  user_type: z.enum(USER_TYPES),
});

const FAQ: Array<[string, string]> = [
  ["How do I report an issue?", "Log in, tap “Report an Issue”, choose a category, describe the problem, add a photo and location, then submit. You can also use “Report by Phone”."],
  ["Can I track my report?", "Yes. Open “My Reports” to see the live status timeline, from Submitted to Resolved. You also get notifications on every change."],
  ["Does AI make final decisions?", "No. AI only suggests a category, priority and department. A government officer reviews and approves every action."],
  ["How can my organization partner with the platform?", "Universities, startups and CSR partners can browse Innovation Challenges and express interest, or write to innovation@civicconnect.demo."],
];

function ContactPage() {
  const [form, setForm] = useState({ full_name: "", email: "", subject: "", message: "", user_type: "Citizen" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSending(true);
    const { error } = await supabase.from("contact_messages").insert(parsed.data);
    setSending(false);
    if (error) {
      toast.error("Could not send your message. Please try again.");
      return;
    }
    toast.success("Message sent");
    setSent(true);
  }

  const field = (k: keyof typeof form) => ({
    id: k,
    value: form[k],
    "aria-invalid": Boolean(errors[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <Page
      title="Contact Eco-Bridge"
      description="We are here to help citizens and partner organizations."
      actions={
        <img
          src={contactArt}
          alt="Illustration of a message bubble and map pin connected to city buildings"
          width={112}
          height={112}
          loading="lazy"
          decoding="async"
          className="hidden size-24 sm:block sm:size-28"
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <div key={c.title} className="card-surface p-4">
            <c.icon className="size-6 text-accent" aria-hidden="true" />
            <p className="mt-2 font-semibold">{c.title}</p>
            <p className="text-sm text-muted-foreground">{c.text}</p>
            <a href={`mailto:${c.email}`} className="mt-2 block break-all text-sm font-medium text-primary underline">
              {c.email}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="card-surface p-5 lg:col-span-3" aria-labelledby="form-h">
          <h2 id="form-h" className="text-xl font-bold">Send us a message</h2>
          {sent ? (
            <div className="mt-4 flex flex-col items-center gap-2 p-6 text-center">
              <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
              <p className="text-lg font-semibold">Thank you. Our team will respond soon.</p>
              <Button variant="outline" onClick={() => { setSent(false); setForm({ full_name: "", email: "", subject: "", message: "", user_type: "Citizen" }); }}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 grid gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={errors["full_name"]}><Input {...field("full_name")} /></Field>
                <Field label="Email" error={errors["email"]}><Input type="email" {...field("email")} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Subject" error={errors["subject"]}><Input {...field("subject")} /></Field>
                <Field label="User type" error={errors["user_type"]}>
                  <select {...field("user_type")} className="h-11 rounded-md border bg-background px-3">
                    {USER_TYPES.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Message" error={errors["message"]}><Textarea rows={5} {...field("message")} /></Field>
              <Button type="submit" size="lg" disabled={sending}>{sending ? "Sending…" : "Send Message"}</Button>
            </form>
          )}
        </section>

        <section className="lg:col-span-2" aria-labelledby="faq-h">
          <h2 id="faq-h" className="text-xl font-bold">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-2">
            {FAQ.map(([q, a]) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                <AccordionContent>{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>
    </Page>
  );
}

function Field({ label, error, children }: { label: string; error: string | undefined; children: React.ReactElement<{ id: string }> }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={children.props.id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
