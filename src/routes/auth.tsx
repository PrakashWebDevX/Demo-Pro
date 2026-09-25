import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Page } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_ACCOUNTS, DISTRICTS, ROLE_HOME, ROLE_LABELS } from "@/lib/constants";
import { useLang } from "@/lib/i18n";
import { LanguageSelect } from "@/components/app/LanguageSelect";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login — Eco-Bridge" },
      {
        name: "description",
        content:
          "Sign in as a citizen, government officer, department administrator or innovation partner.",
      },
      { property: "og:title", content: "Login — Eco-Bridge" },
      {
        property: "og:description",
        content: "Citizen and officer sign-in for the Jharkhand civic issue platform.",
      },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/u, "Enter a 10 digit mobile number")
    .or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  district: z.string().min(1, "Select your district"),
});

function AuthPage() {
  const navigate = useNavigate();
  const { tr, lang, t } = useLang();
  const [busy, setBusy] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    password: "",
    district: "Ranchi",
    role: "citizen",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function goHomeFor(userId: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const role = (data?.role as string) ?? "citizen";
    navigate({ to: ROLE_HOME[role] ?? "/citizen" });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy("login");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Signed in", "लॉगिन सफल"));
    if (data.user) await goHomeFor(data.user.id);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setBusy("signup");
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: form.fullName.trim(),
          mobile: form.mobile.trim(),
          district: form.district,
          role: form.role,
        },
      },
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success(
        tr("Account created. Please check your email to confirm.", "खाता बन गया। कृपया ईमेल जाँचें।"),
      );
      return;
    }
    toast.success(tr("Account created", "खाता बन गया"));
    if (data.user) await goHomeFor(data.user.id);
  }

  async function demoLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    setBusy(account.email);
    let result = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });

    if (result.error) {
      const signUp = await supabase.auth.signUp({
        email: account.email,
        password: account.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: account.name,
            district: account.district,
            role: account.role,
            organization_name: "organization_name" in account ? account.organization_name : null,
            department_name: "department_name" in account ? account.department_name : null,
          },
        },
      });
      if (signUp.error) {
        setBusy(null);
        toast.error(signUp.error.message);
        return;
      }
      result = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
    }

    setBusy(null);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`${account.label} — ${tr("signed in", "लॉगिन सफल")}`);
    navigate({ to: ROLE_HOME[account.role] ?? "/citizen" });
  }

  return (
    <Page
      title={t("login")}
      actions={<LanguageSelect id="auth-lang" />}
      description={
        tr("Sign in with email, or use a clearly labelled demo account for presentation.", "ईमेल से लॉगिन करें, या प्रस्तुति के लिए डेमो खाते का उपयोग करें।")
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-surface p-5 sm:p-6">
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{tr("Sign in", "लॉगिन")}</TabsTrigger>
              <TabsTrigger value="signup">
                {tr("Create account", "नया खाता")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">
                    {tr("Email or mobile-linked email", "ईमेल")}
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{tr("Password", "पासवर्ड")}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={busy === "login"}>
                  {busy === "login" ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("login")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="mt-4 space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="full-name">{tr("Full name", "पूरा नाम")}</Label>
                  <Input
                    id="full-name"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="h-12 text-base"
                    aria-invalid={Boolean(errors["fullName"])}
                  />
                  {errors["fullName"] ? (
                    <p className="text-sm text-destructive">{errors["fullName"]}</p>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">{tr("Email", "ईमेल")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="h-12 text-base"
                      aria-invalid={Boolean(errors["email"])}
                    />
                    {errors["email"] ? (
                      <p className="text-sm text-destructive">{errors["email"]}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile">
                      {tr("Mobile number (optional)", "मोबाइल नंबर (वैकल्पिक)")}
                    </Label>
                    <Input
                      id="mobile"
                      inputMode="numeric"
                      value={form.mobile}
                      onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                      className="h-12 text-base"
                      aria-invalid={Boolean(errors["mobile"])}
                    />
                    {errors["mobile"] ? (
                      <p className="text-sm text-destructive">{errors["mobile"]}</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="district">{tr("District", "जिला")}</Label>
                    <Select
                      value={form.district}
                      onValueChange={(v) => setForm({ ...form, district: v })}
                    >
                      <SelectTrigger id="district" className="h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">{tr("I am a", "मैं हूँ")}</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger id="role" className="h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="citizen">{ROLE_LABELS["citizen"]}</SelectItem>
                        <SelectItem value="university">{ROLE_LABELS["university"]}</SelectItem>
                        <SelectItem value="partner">{ROLE_LABELS["partner"]}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{tr("Password", "पासवर्ड")}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="h-12 text-base"
                    aria-invalid={Boolean(errors["password"])}
                  />
                  {errors["password"] ? (
                    <p className="text-sm text-destructive">{errors["password"]}</p>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {tr("Officer, department and admin accounts are created by the Super Admin.", "अधिकारी, विभाग एवं प्रशासक खाते सुपर एडमिन द्वारा बनाए जाते हैं।")}
                </p>
                <Button type="submit" size="lg" className="w-full" disabled={busy === "signup"}>
                  {busy === "signup" ? <Loader2 className="size-4 animate-spin" /> : null}
                  {tr("Create account", "खाता बनाएँ")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <div className="card-surface p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-accent" aria-hidden="true" />
            <h2 className="text-xl font-bold">
              {tr("Demo Mode — for presentation", "डेमो मोड — प्रस्तुति हेतु")}
            </h2>
          </div>
          <p className="mt-2 text-muted-foreground">
            {tr("These are clearly labelled demo accounts with seeded data. Password for every demo account: Jharkhand#Demo2026", "ये स्पष्ट रूप से चिह्नित डेमो खाते हैं। सभी डेमो खातों का पासवर्ड: Jharkhand#Demo2026")}
          </p>
          <div className="mt-4 grid gap-3">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                size="lg"
                className="h-auto justify-between px-4 py-3 text-left"
                onClick={() => demoLogin(account)}
                disabled={busy === account.email}
              >
                <span>
                  <span className="block font-semibold">{account.label}</span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {account.email}
                  </span>
                </span>
                {busy === account.email ? <Loader2 className="size-4 animate-spin" /> : null}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Page>
  );
}
