import type { Metadata } from 'next';
import { PolicyPage, Section } from '@/components/PolicyPage';

export const metadata: Metadata = {
  title: 'Terms of Use — MoodRadio',
  description: 'The terms that apply when you use MoodRadio.',
};

export default function Terms() {
  return (
    <PolicyPage title="Terms" updated="15 August 2026">
      <Section heading="What this is">
        <p>
          MoodRadio is a free personal project, not a commercial product. You
          describe how you feel, it works out an emotion, and it queues music
          from YouTube that fits. There is no paid tier and no company behind it.
        </p>
      </Section>

      <Section heading="Provided as-is">
        <p>
          MoodRadio is provided without warranty of any kind. It may be
          unavailable, lose your mood history, suggest music you dislike, or be
          shut down at any time without notice. Do not depend on it for anything
          that matters.
        </p>
      </Section>

      <Section heading="Music comes from YouTube">
        <p>
          No audio is hosted here. Everything plays through YouTube&rsquo;s
          embedded player, so your use is also governed by the{' '}
          <a
            href="https://www.youtube.com/t/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/40 hover:decoration-white"
          >
            YouTube Terms of Service
          </a>
          . MoodRadio claims no rights over any music, artwork, or metadata it
          displays; those belong to their respective owners.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          You need a Google account to sign in, because both the AI request and
          reading your YouTube library require a verified identity. Keep your
          Google account secure — anyone with access to it has access to your
          MoodRadio session.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>Please do not:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            Automate or script requests in a way that burns through the shared
            YouTube and AI quotas
          </li>
          <li>Attempt to access other people&rsquo;s mood history</li>
          <li>Use it to break YouTube&rsquo;s terms or any applicable law</li>
        </ul>
        <p>
          Quotas are finite and shared: heavy automated use degrades the app for
          everyone, including you.
        </p>
      </Section>

      <Section heading="Source code">
        <p>
          MoodRadio is open source under the MIT licence and available on{' '}
          <a
            href="https://github.com/Tech-aficionado/MoodRadio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/40 hover:decoration-white"
          >
            GitHub
          </a>
          . The MIT licence covers the code in that repository. It does not grant
          any rights to the music, and it does not entitle you to use the hosted
          instance or its API keys.
        </p>
      </Section>

      <Section heading="Privacy">
        <p>
          What is collected and where it is stored is described in the{' '}
          <a
            href="/privacy"
            className="text-white underline decoration-white/40 hover:decoration-white"
          >
            Privacy Policy
          </a>
          , which forms part of these terms.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions, data removal requests, or bug reports: open an issue on the{' '}
          <a
            href="https://github.com/Tech-aficionado/MoodRadio/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/40 hover:decoration-white"
          >
            GitHub repository
          </a>
          .
        </p>
      </Section>
    </PolicyPage>
  );
}
