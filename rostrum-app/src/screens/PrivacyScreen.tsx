// =====================================================================
// The Rostrum · src/screens/PrivacyScreen.tsx
// Privacy Policy. Plain-language draft reflecting the real data flows —
// recommend a lawyer's review before launch.
// =====================================================================
import { useNavigate } from 'react-router-dom';
import { C, ui, display } from '../lib/theme';

export const PRIVACY_VERSION = '2026-07-06';

export function PrivacyScreen({ embedded }: { embedded?: boolean }) {
  const nav = useNavigate();
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: embedded ? 0 : '30px 20px 70px' }}>
      {!embedded && (
        <button onClick={() => nav(-1)} style={{ background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: ui, fontSize: 13, color: C.dim, padding: 0, marginBottom: 18 }}>← Back</button>
      )}
      <h1 style={{ fontFamily: display, fontSize: 30, fontWeight: 700, color: C.ink, margin: '0 0 4px' }}>Privacy Policy</h1>
      <p style={{ fontFamily: ui, fontSize: 12.5, color: C.faint, margin: '0 0 28px' }}>Last updated {PRIVACY_VERSION}</p>

      <Body>
        <P>This Privacy Policy explains what information The Rostrum collects, how we use it, and the choices you
        have. It applies to rostrums.site and our apps.</P>

        <H>1. Information we collect</H>
        <P><b>Account information:</b> your email address, display name, handle, password (stored encrypted, never
        in plain text), and any profile details you add (bio, avatar, social links, topics of interest).</P>
        <P><b>Debate activity:</b> the rooms you host, join, or watch; your role (host, speaker, judge, audience);
        chat messages, votes, poll responses, and evidence you submit within a debate.</P>
        <P><b>Audio and video:</b> while you're in a live room, your microphone and camera streams are transmitted
        to other participants in real time via our video provider (LiveKit Cloud). If a host records the room, that
        recording is stored on our behalf in Cloudflare R2 storage. Recordings are private by default and only
        become accessible to others if the host explicitly makes them public.</P>
        <P><b>Payment information:</b> if you send a tip, pay for entry to a debate, subscribe, or receive payments
        as a creator, your payment and payout details are collected and processed directly by Stripe — we never see
        or store your full card or bank-account numbers. We do store records of the transactions you take part in
        (such as amounts, dates, and the parties involved) for accounting, tax, and support purposes.</P>
        <P><b>Usage information:</b> device/browser type, IP address, pages visited, and similar technical data,
        collected automatically to keep the Service running reliably and securely.</P>

        <H>2. How we use your information</H>
        <UL items={[
          'To operate the Service — running live debates, matching you with rooms, and processing votes.',
          'To process payments and creator payouts through Stripe.',
          'To keep the platform safe — investigating reports, enforcing our Terms and Community Guidelines, and preventing abuse.',
          'To communicate with you — account confirmations, security alerts, and (if you don\u2019t opt out) product updates.',
          'To improve the Service — understanding how features are used so we can fix problems and build better ones.',
        ]} />

        <H>3. Who we share information with</H>
        <P>We don't sell your personal information. We share data only as needed to run the Service:</P>
        <UL items={[
          'Other participants in a room can see your camera, hear your microphone, and see your public profile and chat messages while you\u2019re present.',
          'Supabase, our database and authentication provider, stores your account and platform data securely.',
          'LiveKit Cloud powers our real-time audio/video transport.',
          'Cloudflare R2 stores recorded replays.',
          'Stripe processes payments, payouts, and related financial data.',
          'We may disclose information if required by law, or to protect the rights, safety, or property of The Rostrum or our users.',
        ]} />

        <H>4. Recordings and replays</H>
        <P>If a host records a debate, that recording is stored privately unless the host chooses to publish it. A
        public replay is visible to anyone and may include your camera, voice, and chat activity from that session.
        Hosts can delete a recording at any time, which permanently removes the file from storage. If you want a
        recording of a room you participated in reviewed or removed, contact the host or use the in-app report
        feature.</P>

        <H>5. Your choices</H>
        <UL items={[
          'You can edit or delete most profile information at any time from your account settings.',
          'You can block other users, and you can choose whether to appear on camera in any room.',
          'You can request account deletion by contacting us through the Help section; we\u2019ll delete or anonymize your personal data except where we\u2019re required to retain records (for example, financial transaction history).',
        ]} />

        <H>6. Data retention</H>
        <P>We keep your account information for as long as your account is active. Debate activity, transaction
        records, and moderation reports may be retained after account deletion where needed for legal, security, or
        financial recordkeeping purposes.</P>

        <H>7. Children's privacy</H>
        <P>The Rostrum isn't directed at children under 13, and we don't knowingly collect personal information from
        them. If you believe a child has created an account, please contact us so we can remove it.</P>

        <H>8. Security</H>
        <P>We use industry-standard safeguards — including encryption in transit, access controls, and row-level
        database security — to protect your information. No system is perfectly secure, and we can't guarantee
        absolute security.</P>

        <H>9. Changes to this policy</H>
        <P>We may update this Privacy Policy from time to time. We'll make reasonable efforts to notify you of
        material changes before they take effect.</P>

        <H>10. Contact</H>
        <P>Questions about this policy or your data? Reach out through the Help section in the app.</P>

        <p style={{ fontFamily: ui, fontSize: 12, color: C.faint, marginTop: 30, fontStyle: 'italic' }}>
          This document is a plain-language draft and is not a substitute for legal advice. Review with a qualified
          attorney before relying on it as your platform's binding policy.
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
