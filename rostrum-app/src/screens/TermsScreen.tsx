// =====================================================================
// The Rostrum · src/screens/TermsScreen.tsx
// Terms of Service. Plain-language draft reflecting what the platform
// actually does — recommend a lawyer's review before launch.
// =====================================================================
import { useNavigate } from 'react-router-dom';
import { C, ui, display } from '../lib/theme';

export const TERMS_VERSION = '2026-07-06';

export function TermsScreen({ embedded }: { embedded?: boolean }) {
  const nav = useNavigate();
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: embedded ? 0 : '30px 20px 70px' }}>
      {!embedded && (
        <button onClick={() => nav(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: ui, fontSize: 13, color: C.dim, padding: 0, marginBottom: 18 }}>← Back</button>
      )}
      <h1 style={{ fontFamily: display, fontSize: 30, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>Terms of Service</h1>
      <p style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, margin: '0 0 28px' }}>Last updated {TERMS_VERSION}</p>

      <Body>
        <P>Welcome to The Rostrum. These Terms of Service ("Terms") govern your access to and use of The Rostrum's
        website, apps, and services (the "Service"), operated at rostrums.site. By creating an account or using the
        Service, you agree to these Terms. If you don't agree, please don't use the Service.</P>

        <H>1. Who can use The Rostrum</H>
        <P>You must be at least 13 years old (or the minimum age of digital consent in your country, if higher)
        to create an account. By signing up, you confirm the information you provide is accurate and that you're
        legally able to enter this agreement.</P>

        <H>2. Your account</H>
        <P>You're responsible for keeping your login credentials secure and for all activity under your account.
        Tell us right away if you suspect unauthorized access. We may suspend or terminate accounts that violate
        these Terms or our Community Guidelines below.</P>

        <H>3. Live debates, recordings, and replays</H>
        <P>The Rostrum lets you host and join live audio/video debate rooms across several formats. When you're in a
        room, other participants may see your camera, hear your microphone, and see your profile information.</P>
        <P>Hosts can choose to record a room. Recordings are private by default and are only made public if the host
        explicitly chooses to do so. If you join a room, you acknowledge it may be recorded at the host's discretion,
        and that a public replay may include your participation if you were on camera, speaking, or otherwise
        visible in the recording. Hosts are responsible for the replays they choose to publish and can delete a
        recording permanently at any time.</P>
        <P>Downloaded replay files (MP4) are provided for the host's own use, including sharing on other platforms.
        You're responsible for complying with applicable law and any rights of other participants when you do so.</P>

        <H>4. D-Bucks, gifts, and payments</H>
        <P>The Rostrum uses an in-app currency ("D-Bucks") that can be purchased, earned, gifted, and — once you meet
        the platform's eligibility criteria — cashed out for real money, minus applicable platform fees, via Stripe.
        D-Bucks have no cash value except through this cash-out process and are non-refundable once spent, except
        where required by law. We may adjust D-Bucks pricing, earning rates, or cash-out terms going forward, and
        will make reasonable efforts to notify you of material changes.</P>
        <P>Payments and payouts are processed by Stripe. By using paid features, you also agree to Stripe's terms
        governing the payment services it provides on our behalf.</P>

        <H>5. Community Guidelines</H>
        <P>To keep The Rostrum a place for genuine debate, you agree not to:</P>
        <UL items={[
          'Harass, threaten, or abuse other users, including through hate speech or targeted discrimination.',
          'Impersonate another person or misrepresent your affiliation with any person or organization.',
          'Post or transmit unlawful, infringing, or sexually explicit content involving minors, or any content that violates others\u2019 rights.',
          'Attempt to disrupt, hack, or abuse the Service, including its live video or payment systems.',
          'Use the Service for spam, scams, or coordinated inauthentic behavior.',
        ]} />
        <P>Hosts and moderators can remove disruptive participants from a room; a removal is permanent for that
        room. Users can block one another; blocking a user you host prevents them from seeing or joining your
        events. We may also take independent action — including warnings, temporary bans, or permanent account
        termination — for violations of these Terms.</P>

        <H>6. Content ownership</H>
        <P>You retain ownership of content you create (including your video, audio, and chat messages). By
        participating in a debate, you grant The Rostrum a license to host, transmit, record (where enabled), and
        display that content as part of operating the Service — including to the host who may choose to publish a
        replay. You're responsible for ensuring you have the rights to anything you present, including slides,
        evidence, or media you upload.</P>

        <H>7. Disclaimers</H>
        <P>The Service is provided "as is." We don't guarantee it will be uninterrupted, error-free, or available at
        all times. Opinions expressed by users during debates are their own and don't reflect the views of The
        Rostrum.</P>

        <H>8. Limitation of liability</H>
        <P>To the maximum extent permitted by law, The Rostrum and its operators aren't liable for indirect,
        incidental, or consequential damages arising from your use of the Service, including loss of data,
        recordings, or D-Bucks balance.</P>

        <H>9. Changes to these Terms</H>
        <P>We may update these Terms from time to time. If we make material changes, we'll make reasonable efforts
        to notify you (such as an in-app notice or email) before they take effect. Continuing to use the Service
        after changes take effect means you accept the updated Terms.</P>

        <H>10. Contact</H>
        <P>Questions about these Terms? Reach out through the Help section in the app.</P>

        <p style={{ fontFamily: ui, fontSize: 12, color: C.faint, marginTop: 30, fontStyle: 'italic' }}>
          This document is a plain-language draft and is not a substitute for legal advice. Review with a qualified
          attorney before relying on it as your platform's binding terms.
        </p>
      </Body>
    </div>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: ui, fontSize: 14.5, color: C.dim, lineHeight: 1.7 }}>{children}</div>;
}
function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: display, fontSize: 18, fontWeight: 700, color: C.ink, margin: '26px 0 8px' }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 12px' }}>{children}</p>;
}
function UL({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
      {items.map((it, i) => <li key={i} style={{ marginBottom: 6 }}>{it}</li>)}
    </ul>
  );
}
