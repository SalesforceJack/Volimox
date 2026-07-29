import type { Metadata } from "next"
import { ResourcePageShell, ResourceSection } from "@/components/ResourcePageShell"
import { SITE_CONTACT } from "@/config/siteContact"

export const metadata: Metadata = {
  title: "Legal",
  description: "Volimox website and demonstration terms of use.",
}

const sections = [
  { id: "scope", label: "Website and demos" },
  { id: "use", label: "Acceptable use" },
  { id: "reliance", label: "No automatic outcome" },
  { id: "ownership", label: "Content and ownership" },
  { id: "providers", label: "Third-party services" },
  { id: "contact", label: "Contact and updates" },
]

export default function LegalPage() {
  return (
    <ResourcePageShell
      eyebrow="Legal"
      title="The useful details, in plain language."
      description="These working terms set expectations for the Volimox website, interactive demonstrations, and early conversations about an implementation."
      badge="Working draft"
      sections={sections}
    >
      <div className="mb-12 border-l-4 border-signal bg-canvas-muted p-5 text-sm leading-7 text-ink-muted sm:p-6">
        This page is a launch draft and is not legal advice. Final terms should be reviewed before the public launch.
      </div>

      <div className="space-y-14">
        <ResourceSection id="scope" index={1} title="Website and demonstrations">
          <p>
            Volimox provides information about operational AI systems and may provide interactive demonstrations of possible workflows. Demo businesses, records, conversations, quotes, and outcomes may be fictional or illustrative.
          </p>
          <p>
            A demonstration does not create a customer relationship, service commitment, appointment, payment authorization, or production deployment unless Volimox and the customer agree to one separately.
          </p>
        </ResourceSection>

        <ResourceSection id="use" index={2} title="Acceptable use">
          <p>Visitors may use the website for lawful evaluation and communication with Volimox. Visitors must not:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Submit information they are not authorized to share.</li>
            <li>Attempt to disrupt, probe, overload, or bypass controls on the site or its demonstrations.</li>
            <li>Use a voice, SMS, or email demonstration to harass, impersonate, defraud, or contact someone without appropriate permission.</li>
            <li>Reverse engineer or reproduce protected materials except where applicable law allows it.</li>
          </ul>
        </ResourceSection>

        <ResourceSection id="reliance" index={3} title="No automatic outcome">
          <p>
            Demonstrations are designed to show a possible operating pattern. They are not a promise that a workflow will be accurate, available, compliant, or suitable for a particular business without configuration, testing, and human review.
          </p>
          <p>
            Do not rely on a demo for medical, legal, financial, emergency, safety, or other professional advice. Do not treat an illustrative quote, response, schedule, or record as a completed real-world action.
          </p>
        </ResourceSection>

        <ResourceSection id="ownership" index={4} title="Content and ownership">
          <p>
            The Volimox name, visual identity, site content, software, and original demonstration materials belong to Volimox or their respective owners. A visitor receives permission to view and evaluate the site, not ownership of its underlying materials.
          </p>
          <p>
            Third-party names and logos are used to describe integrations or examples. They remain the property of their respective owners.
          </p>
        </ResourceSection>

        <ResourceSection id="providers" index={5} title="Third-party services">
          <p>
            Demonstrations may connect to third-party services for voice, SMS, email, AI processing, hosting, or storage. Those services have their own terms and policies. Their availability and behavior can change independently of Volimox.
          </p>
          <p>
            Production use requires an explicit implementation scope, approved configuration, security review, and testing appropriate to the business process.
          </p>
        </ResourceSection>

        <ResourceSection id="contact" index={6} title="Contact and updates">
          <p>
            We may update these working terms as the website and product evolve. Questions about this page can be sent to{" "}
            <a className="font-semibold text-ink underline decoration-signal underline-offset-4" href={"mailto:" + SITE_CONTACT.email}>
              {SITE_CONTACT.email}
            </a>
            .
          </p>
          <p>
            Volimox contact address: {SITE_CONTACT.address}. Phone: {SITE_CONTACT.phoneDisplay}.
          </p>
        </ResourceSection>
      </div>
    </ResourcePageShell>
  )
}
