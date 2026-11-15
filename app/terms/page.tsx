import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal-page';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="Last updated: May 19, 2026">
      <h2>1. Contractual Relations &amp; Acceptance of Terms</h2>
      <p>
        These Terms of Service govern the access and use of the digital web interfaces, applications, and routing engines provided by Reclaiming. By creating an
        account or initializing a claim workflow on our platform, you explicitly declare that you possess the full legal capacity and authorization required
        under Nigerian probate laws to manage the estate assets of the deceased person whose parameters you enter.
      </p>

      <h2>2. Description of Service &amp; Verification Prerequisites</h2>
      <p>
        Reclaiming provides a technical routing utility linking consumer requests to identity verification APIs (QoreID) and automated interbank ledger querying
        switches (NIBSS e-DMMS).
      </p>
      <ul>
        <li><strong>The Verification Gate:</strong> You acknowledge and agree that access to asset discovery ledgers is strictly contingent upon QoreID successfully verifying your legal documentation.</li>
        <li><strong>Administrative Access Overrides:</strong> The company retains absolute administrative oversight. All discovery claims successfully compiled through the system are queued for final validation review by institutional compliance officers.</li>
      </ul>

      <h2>3. Standard Pricing, Fee Structure, &amp; Financial Mandate</h2>
      <p>By interacting with the final settlement validation layout, you enter into a binding financial mandate agreement with Reclaiming:</p>
      <ul>
        <li><strong>Service Assessment Rate:</strong> Reclaiming levies a fixed platform service fee equivalent to exactly 10% of the gross cumulative worth of all monetary assets, bank balances, and unclaimed dividend payouts discovered and recovered through the platform pipeline.</li>
        <li><strong>Processing Execution Method:</strong> This 10% platform fee is systematically and automatically deducted directly from the gross asset pool at the point of clearing and settlement, prior to routing the net remaining balances to your finalized container.</li>
      </ul>

      <h2>4. Prohibited System Exploitation &amp; Indemnity</h2>
      <p>
        Any attempt to input counterfeit Letters of Administration, fake Death Certificates, or unauthorized third-party BVN strings constitutes criminal fraud
        under the Cybercrimes Act of Nigeria. You agree to fully indemnify and hold harmless Reclaiming, its technical partners, and directors against any legal
        claims, liabilities, or regulatory penalties arising from fraudulent documents or false declarations uploaded to your profile.
      </p>
    </LegalPage>
  );
}
