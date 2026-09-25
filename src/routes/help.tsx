import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/app/Page";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help and FAQ — Eco-Bridge" },
      {
        name: "description",
        content:
          "How to report a civic issue in Jharkhand, track its status, and what each status means.",
      },
      { property: "og:title", content: "Help and FAQ — Eco-Bridge" },
      {
        property: "og:description",
        content: "Simple answers about reporting issues and tracking government action.",
      },
    ],
  }),
  component: HelpPage,
});

const FAQ = [
  {
    q: { en: "How do I report an issue?", hi: "मैं समस्या कैसे दर्ज करूँ?" },
    a: {
      en: "Tap Report an Issue, choose a category, describe the problem in simple words, add a photo, add your location and submit. You will get an issue number such as JH-2026-0001.",
      hi: "‘समस्या दर्ज करें’ चुनें, श्रेणी चुनें, सरल शब्दों में समस्या लिखें, फोटो और स्थान जोड़ें और जमा करें। आपको JH-2026-0001 जैसा शिकायत नंबर मिलेगा।",
    },
  },
  {
    q: { en: "What happens after I submit?", hi: "जमा करने के बाद क्या होता है?" },
    a: {
      en: "An officer reviews your report with the help of an AI suggestion. AI helps decisions, humans approve actions. The officer approves it, assigns a department, and the status moves to In Progress and then Resolved.",
      hi: "अधिकारी एआई सुझाव की सहायता से आपकी शिकायत की समीक्षा करते हैं। निर्णय अधिकारी ही लेते हैं। स्वीकृति के बाद विभाग सौंपा जाता है और स्थिति ‘कार्य जारी’ फिर ‘समाधान हो गया’ हो जाती है।",
    },
  },
  {
    q: { en: "Can I use it without internet?", hi: "क्या बिना इंटरनेट उपयोग कर सकते हैं?" },
    a: {
      en: "You can save an incomplete report as an offline draft on your phone. It stays in this browser and can be submitted when you are online again. This is prototype offline support.",
      hi: "आप अधूरी शिकायत को ऑफलाइन ड्राफ्ट के रूप में अपने फोन में सहेज सकते हैं और इंटरनेट आने पर जमा कर सकते हैं। यह प्रोटोटाइप ऑफलाइन सुविधा है।",
    },
  },
  {
    q: { en: "Will I get SMS or WhatsApp updates?", hi: "क्या एसएमएस या व्हाट्सएप मिलेगा?" },
    a: {
      en: "In this prototype you receive in-app notifications only. SMS integration ready and WhatsApp integration ready — no real messages are sent until a provider is configured.",
      hi: "इस प्रोटोटाइप में केवल ऐप के अंदर सूचनाएँ मिलती हैं। एसएमएस और व्हाट्सएप एकीकरण तैयार है, परंतु अभी संदेश नहीं भेजे जाते।",
    },
  },
  {
    q: { en: "Is this for emergencies?", hi: "क्या यह आपातकाल के लिए है?" },
    a: {
      en: "No. For emergencies contact the appropriate official emergency service. This platform does not replace emergency services.",
      hi: "नहीं। आपातकाल में संबंधित आधिकारिक आपातकालीन सेवा से संपर्क करें।",
    },
  },
];

function HelpPage() {
  const { lang, t } = useLang();
  return (
    <Page
      title={t("help_faq")}
      description={
        lang === "en"
          ? "Simple answers for first-time users."
          : "पहली बार उपयोग करने वालों के लिए सरल उत्तर।"
      }
    >
      <div className="card-surface p-4 sm:p-6">
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {lang === "en" ? item.q.en : item.q.hi}
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                {lang === "en" ? item.a.en : item.a.hi}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Page>
  );
}
