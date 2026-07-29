import type { Metadata } from "next"
import { ResourcePageShell, ResourceSection } from "@/components/ResourcePageShell"
import { SITE_CONTACT } from "@/config/siteContact"

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Volimox handles information submitted through its website and demonstrations.",
}

const sections = [
  { id: "scope", label: "What this covers" },
  { id: "information", label: "Information we receive" },
  { id: "use", label: "How we use it" },
  { id: "providers", label: "Service providers" },
  { id: "choices", label: "Your choices" },
  { id: "changes", label: "Updates and contact" },
]

export default function PrivacyPage() {
  return (
    <ResourcePageShell
      eyebrow="Privacy"
      title="Information should have a clear path."
      description="This working draft explains what Volimox may receive through its website, interactive demonstrations, and contact workflows."
      badge="Working draft"
      sections={sections}
    >
      <div className="mb-12 border-l-4 border-signal bg-canvas-muted p-5 text-sm leading-7 text-ink-muted sm:p-6">
        This page is a launch draft and is not legal advice. The final privacy notice should be reviewed before the public launch.
      </div>

      <div className="space-y-14">
        <ResourceSection id="scope" index={1} title="What this covers">
          <p>
            This notice applies to information submitted on volimox.com and to information created when a visitor uses a Volimox demonstration. It describes the general handling of contact details, demo inputs, messages, and technical information.
          </p>
          <p>
            A demonstration may be illustrative rather than a live customer workflow. Any separate customer agreement or deployment-specific notice controls the relevant production service.
          </p>
        </ResourceSection>

        <ResourceSection id="information" index={2} title="Information we may receive">
          <p>Depending on the path a visitor chooses, Volimox may receive:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Contact details such as name, work email, company, phone number, and the business need described in a form.</li>
            <li>Information a visitor provides during a voice, chat, SMS, or workflow demonstration.</li>
            <li>Consent and delivery details needed to send an explicitly requested demo call, message, or email.</li>
            <li>Basic technical information needed to operate the site, protect the forms, limit abuse, and diagnose failures.</li>
          </ul>
          <p>Visitors should not submit passwords, payment card details, government identifiers, or other sensitive information through a demonstration.</p>
        </ResourceSection>

        <ResourceSection id="use" index={3} title="How we use information">
          <p>We may use submitted information to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide and explain the requested demonstration.</li>
            <li>Respond to an operation brief, product question, or support request.</li>
            <li>Maintain delivery status, prevent duplicate actions, and protect the site from abuse.</li>
            <li>Improve the reliability, usability, and safety of Volimox workflows.</li>
            <li>Meet legal, security, and recordkeeping obligations when they apply.</li>
          </ul>
          <p>We do not treat a demonstration as permission to send recurring marketing messages. Any message or call flow should use the consent language shown at the point of request.</p>
        </ResourceSection>

        <ResourceSection id="providers" index={4} title="Service providers and storage">
          <p>
            Volimox may use carefully selected providers for hosting, voice, SMS, email delivery, analytics, and secure data storage. The provider used depends on the workflow and environment being demonstrated or deployed.
          </p>
          <p>
            We aim to share only the information needed for the requested operation. Provider-specific processing, retention, and transfer terms may also apply and should be reviewed for any production deployment.
          </p>
        </ResourceSection>

        <ResourceSection id="choices" index={5} title="Your choices">
          <p>
            A visitor can choose not to submit a form or stop using a demonstration. If a visitor has requested a message or call, the instructions included in that communication can be used to opt out where applicable.
          </p>
          <p>
            For questions about information submitted to Volimox, contact{" "}
            <a className="font-semibold text-ink underline decoration-signal underline-offset-4" href={"mailto:" + SITE_CONTACT.email}>
              {SITE_CONTACT.email}
            </a>
            .
          </p>
        </ResourceSection>

        <ResourceSection id="changes" index={6} title="Updates and contact">
          <p>
            We may update this notice as the website, demonstrations, or services change. The page will show the current working version, and material changes should be reflected in an updated notice before they apply to a new use.
          </p>
          <p>
            General contact: {SITE_CONTACT.address}. Phone:{" "}
            <a className="font-semibold text-ink underline decoration-signal underline-offset-4" href={"tel:" + SITE_CONTACT.phoneTel}>
              {SITE_CONTACT.phoneDisplay}
            </a>
            .
          </p>
        </ResourceSection>
      </div>
    </ResourcePageShell>
  )
}
