import type { Metadata } from 'next';
import { PolicyPage, Section } from '@/components/PolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy — MoodRadio',
  description:
    'What MoodRadio collects, where it is stored, and how to remove it.',
};

export default function Privacy() {
  return (
    <PolicyPage title="Privacy" updated="15 August 2026">
      <Section heading="In short">
        <p>
          MoodRadio is a personal project. It reads your YouTube library to
          learn what you listen to, and sends the mood text you type to an AI
          model so it can pick music. Your taste profile never leaves your
          browser. The mood text and the emotion detected from it are saved so
          you can see your own history.
        </p>
      </Section>

      <Section heading="Signing in">
        <p>
          Sign-in uses Google via Firebase Authentication. From your Google
          account MoodRadio receives your email address, display name, profile
          photo URL, and a Google user id. This is used only to identify your
          session and attach your mood history to you.
        </p>
      </Section>

      <Section heading="YouTube access">
        <p>
          MoodRadio requests the{' '}
          <code className="text-white/85">youtube.readonly</code> scope. It is
          read-only: nothing is ever posted, liked, subscribed to, or changed on
          your YouTube account.
        </p>
        <p>
          It reads your liked videos, your playlists, and your subscriptions to
          work out which artists, genres and languages you actually listen to.
          Only videos in YouTube&rsquo;s Music category are kept.
        </p>
        <p>
          The resulting taste profile is stored in your browser&rsquo;s
          localStorage and is <strong className="text-white">not</strong> sent
          to any server or database. A summary of it (genres, artist names,
          languages) is included in the request to the AI model so suggestions
          match your taste.
        </p>
      </Section>

      <Section heading="Stored in your browser only">
        <p>These never leave your device except as described above:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <code className="text-white/85">moodradio_music_profile</code> —
            your taste profile
          </li>
          <li>
            <code className="text-white/85">moodradio_taste_feedback</code> —
            artists you liked or skipped in the app, and recently played tracks
          </li>
          <li>
            <code className="text-white/85">moodradio_google_token</code> and{' '}
            <code className="text-white/85">
              moodradio_google_token_expiry
            </code>{' '}
            — your Google access token, so YouTube can be read without asking
            you to sign in repeatedly
          </li>
        </ul>
        <p>
          Clearing site data in your browser removes all of it permanently.
        </p>
      </Section>

      <Section heading="Stored on a server">
        <p>
          Mood history is saved to a hosted Postgres database (Supabase), in a
          table called <code className="text-white/85">mood_entries</code>. Each
          row holds the text you typed, the emotion detected from it, its
          intensity, the search terms generated, and a timestamp. This is what
          the History and Insights pages read.
        </p>
      </Section>

      <Section heading="AI processing">
        <p>
          The mood text you type is sent to Google&rsquo;s Gemini model through a
          self-hosted proxy, together with the taste summary described above, in
          order to detect an emotion and choose search terms. Do not type
          anything into MoodRadio that you would not want processed by a
          third-party AI service.
        </p>
      </Section>

      <Section heading="Sharing a mood">
        <p>
          If you use the share button on a mood, that single entry is given a
          public id and becomes readable by <strong className="text-white">
          anyone who has the link</strong>, without signing in. Nothing is
          shared unless you press share.
        </p>
      </Section>

      <Section heading="Playback and embeds">
        <p>
          Music plays through YouTube&rsquo;s embedded player. YouTube receives
          the usual information it collects when you watch a video, governed by
          Google&rsquo;s own privacy policy rather than this one. MoodRadio does
          not host or store any audio.
        </p>
      </Section>

      <Section heading="Limited use">
        <p>
          MoodRadio&rsquo;s use of information received from Google APIs adheres
          to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/40 hover:decoration-white"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. YouTube data is used only to
          personalise music suggestions for you. It is never sold, never used
          for advertising, and never transferred to anyone else.
        </p>
      </Section>

      <Section heading="What is not done">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>No analytics, tracking pixels, or advertising</li>
          <li>No selling or sharing of personal data</li>
          <li>No writes to your YouTube or Google account</li>
          <li>No email beyond what Google provides at sign-in</li>
        </ul>
      </Section>

      <Section heading="Removing your data">
        <p>
          Revoke MoodRadio&rsquo;s access to your Google account at{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/40 hover:decoration-white"
          >
            myaccount.google.com/permissions
          </a>
          . Clear site data in your browser to erase everything held locally.
        </p>
        <p>
          There is no self-serve delete for stored mood history yet. To have it
          removed, open an issue on the{' '}
          <a
            href="https://github.com/Tech-aficionado/MoodRadio"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/40 hover:decoration-white"
          >
            GitHub repository
          </a>{' '}
          and it will be deleted.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          This policy may change as the app does. The date at the top reflects
          the latest revision, and the full history is public in the repository.
        </p>
      </Section>
    </PolicyPage>
  );
}
