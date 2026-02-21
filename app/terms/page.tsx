import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Terms of Service | Wist',
  description: 'Terms of Service and Privacy Policy for Wist — your smart wishlist.',
}

export default function TermsPage() {
  const effectiveDate = 'February 19, 2026'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-zinc-600" />
          </Link>
          <h1 className="text-lg font-bold text-zinc-900">Legal</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Terms of Service */}
        <article className="prose prose-zinc prose-sm sm:prose max-w-none">
          <h1 className="text-3xl font-bold text-zinc-900 mb-1">Terms of Service</h1>
          <p className="text-sm text-zinc-400 mb-8">Effective date: {effectiveDate}</p>

          <p>
            Welcome to <strong>Wist</strong> ("we," "us," or "our"). Wist is a wishlist and price-tracking
            platform available at <strong>wist.app</strong> and through our browser extension
            (collectively, the "Service"). By accessing or using the Service, you agree to be bound by
            these Terms of Service ("Terms"). If you do not agree, do not use the Service.
          </p>

          <h2>1. Eligibility</h2>
          <p>
            You must be at least 13 years of age to create an account and use the Service. If you are
            under 18, you represent that your parent or legal guardian has reviewed and agreed to these
            Terms on your behalf. We reserve the right to terminate accounts that we reasonably believe
            belong to individuals under 13.
          </p>

          <h2>2. Accounts</h2>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>You agree to provide accurate, current information when creating your account.</li>
            <li>You may not share, sell, or transfer your account to another person.</li>
            <li>
              We may suspend or terminate your account at any time if we believe you have violated
              these Terms or if required by law.
            </li>
          </ul>

          <h2>3. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
            <li>
              Scrape, crawl, or use automated means to access the Service beyond the features we
              explicitly provide (e.g., our browser extension).
            </li>
            <li>Interfere with or disrupt the integrity or performance of the Service.</li>
            <li>Attempt to gain unauthorized access to any portion of the Service.</li>
            <li>Upload content that is defamatory, obscene, or infringes the rights of others.</li>
            <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
          </ul>

          <h2>4. User Content</h2>
          <p>
            "User Content" means any data, text, images, or other materials you submit to the Service
            (e.g., item titles, notes, profile information). You retain ownership of your User Content.
            By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to
            use, store, display, and reproduce it solely as necessary to operate and improve the Service.
          </p>
          <p>
            We may remove or restrict access to User Content that violates these Terms or applicable law.
          </p>

          <h2>5. Third-Party Websites & Products</h2>
          <p>
            The Service allows you to save links to products on third-party retailer websites (e.g.,
            Amazon, Target). We do not sell any products. We are not a party to any transaction between
            you and a retailer. Product names, images, and prices are sourced from publicly available
            information and may not always be accurate or up to date. We make no guarantees about the
            accuracy of scraped product data.
          </p>

          <h2>6. Price Tracking & Notifications</h2>
          <p>
            Wist periodically checks prices of items you have saved. Price data is provided on an
            "as-is" basis and may be delayed or inaccurate. We do not guarantee that you will be
            notified of every price change. You should always verify the current price directly on the
            retailer's website before making a purchase.
          </p>

          <h2>7. Browser Extension</h2>
          <p>
            Our browser extension operates within your browser to help you save items. The extension
            accesses the current webpage's content (product title, price, image) only when you actively
            use it. It does not track your browsing history, collect data from pages you do not interact
            with, or run in the background when not in use.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            The Service and its original content (excluding User Content) are and shall remain the
            exclusive property of Wist and its licensors. Our trademarks and trade dress may not be used
            without our prior written consent.
          </p>

          <h2>9. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER
            EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE
            WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL WIST, ITS OFFICERS, DIRECTORS,
            EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, WHETHER BASED ON
            WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE
            POSSIBILITY OF SUCH DAMAGES.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Wist and its affiliates from any claim, demand,
            loss, or damage (including reasonable attorneys' fees) arising out of or related to your use
            of the Service, your User Content, or your violation of these Terms.
          </p>

          <h2>12. Changes to the Terms</h2>
          <p>
            We may update these Terms from time to time. When we do, we will revise the "Effective date"
            at the top. Your continued use of the Service after the changes take effect constitutes your
            acceptance of the revised Terms. If you do not agree, you should stop using the Service and
            delete your account.
          </p>

          <h2>13. Termination</h2>
          <p>
            You may delete your account at any time by contacting us. We may terminate or suspend your
            access to the Service at our sole discretion, without prior notice, for conduct that we
            believe violates these Terms or is harmful to other users, us, or third parties.
          </p>

          <h2>14. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the United
            States, without regard to conflict of law principles. Any disputes arising under these Terms
            shall be resolved in the courts located within the United States.
          </p>

          {/* Privacy Policy */}
          <div className="mt-16 pt-16 border-t border-zinc-200" id="privacy">
            <h1 className="text-3xl font-bold text-zinc-900 mb-1">Privacy Policy</h1>
            <p className="text-sm text-zinc-400 mb-8">Effective date: {effectiveDate}</p>

            <p>
              This Privacy Policy explains how Wist ("we," "us," or "our") collects, uses, and protects
              your information when you use our website, browser extension, and related services
              (collectively, the "Service").
            </p>

            <h2>1. Information We Collect</h2>

            <h3>a. Information You Provide</h3>
            <ul>
              <li><strong>Account Information:</strong> Email address, name, username, profile picture, and age (collected during onboarding).</li>
              <li><strong>Profile Data:</strong> Bio, social media handles, and Amazon affiliate ID (optional).</li>
              <li><strong>Wishlist Data:</strong> Product URLs, titles, prices, images, notes, and collection assignments that you save to the Service.</li>
            </ul>

            <h3>b. Information Collected Automatically</h3>
            <ul>
              <li><strong>Usage Data:</strong> Pages visited, features used, timestamps, and general interaction patterns.</li>
              <li><strong>Device Information:</strong> Browser type, operating system, and screen resolution.</li>
              <li><strong>Cookies:</strong> We use essential cookies for authentication and session management. We do not use advertising or third-party tracking cookies.</li>
            </ul>

            <h3>c. Information from Third Parties</h3>
            <ul>
              <li><strong>Google OAuth:</strong> If you sign in with Google, we receive your name, email address, and profile picture from Google. We do not access your Google contacts, emails, or any other Google data.</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>To provide and maintain the Service (displaying your wishlist, tracking prices, sending notifications).</li>
              <li>To authenticate your identity and secure your account.</li>
              <li>To personalize your experience (e.g., content filtering based on age).</li>
              <li>To communicate with you about the Service (account-related emails, not marketing).</li>
              <li>To improve and develop new features.</li>
              <li>To enforce our Terms of Service and protect against fraud or abuse.</li>
            </ul>

            <h2>3. How We Share Your Information</h2>
            <p>We do <strong>not</strong> sell your personal information. We may share information in the following limited circumstances:</p>
            <ul>
              <li><strong>Public Profiles:</strong> If you set up a username, your profile page (name, bio, avatar, and active wishlist items) is publicly visible at your profile URL.</li>
              <li><strong>Service Providers:</strong> We use Supabase for authentication and data storage, and Vercel for hosting. These providers process data on our behalf under their respective privacy policies.</li>
              <li><strong>Legal Requirements:</strong> We may disclose your information if required by law, subpoena, or other legal process, or if we believe disclosure is necessary to protect our rights or the safety of others.</li>
            </ul>

            <h2>4. Browser Extension</h2>
            <p>
              Our browser extension accesses webpage content (product title, price, image) only when you
              actively click the extension button or use the "Add to Wist" feature. The extension:
            </p>
            <ul>
              <li>Does <strong>not</strong> track your browsing history.</li>
              <li>Does <strong>not</strong> collect data from pages you do not explicitly interact with.</li>
              <li>Does <strong>not</strong> run background scripts that monitor your activity.</li>
              <li>Only sends data to our servers when you choose to save an item.</li>
            </ul>

            <h2>5. Data Retention</h2>
            <p>
              We retain your account data and wishlist items for as long as your account is active. If you
              delete your account, we will delete your personal data within 30 days, except where we are
              required to retain it for legal or compliance purposes.
            </p>

            <h2>6. Data Security</h2>
            <p>
              We use industry-standard security measures to protect your data, including encryption in
              transit (HTTPS/TLS), encrypted storage, and row-level security policies on our database.
              However, no method of transmission over the internet is 100% secure, and we cannot guarantee
              absolute security.
            </p>

            <h2>7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>Object to or restrict certain processing of your data.</li>
              <li>Data portability (receive your data in a structured format).</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at the email below.
            </p>

            <h2>8. Children's Privacy</h2>
            <p>
              The Service is not directed to children under 13. We do not knowingly collect personal
              information from children under 13. If we become aware that we have collected data from a
              child under 13 without parental consent, we will take steps to delete that information.
              Users between 13 and 17 may use the Service with parental consent, and certain content
              restrictions are automatically applied.
            </p>

            <h2>9. International Users</h2>
            <p>
              The Service is operated from the United States. If you are accessing the Service from
              outside the United States, please be aware that your information may be transferred to,
              stored, and processed in the United States where our servers are located. By using the
              Service, you consent to this transfer.
            </p>

            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              "Effective date" at the top. We encourage you to review this page periodically. Your
              continued use of the Service after changes take effect constitutes your acceptance of the
              revised policy.
            </p>

            <h2>11. Contact Us</h2>
            <p>
              If you have questions or concerns about these Terms or this Privacy Policy, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> support@wist.app
            </p>
          </div>
        </article>

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-zinc-200 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-violet-600 hover:text-violet-700 font-medium"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}
