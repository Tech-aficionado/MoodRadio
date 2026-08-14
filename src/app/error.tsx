'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ backgroundColor: '#000', color: '#fff', fontFamily: 'system-ui', padding: '2rem', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h1>
      <p style={{ color: '#ff6b6b', marginBottom: '0.5rem' }}>{error.message}</p>
      <pre style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'pre-wrap', maxWidth: '100%', overflow: 'auto' }}>
        {error.stack}
      </pre>
      <button
        onClick={() => reset()}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  );
}
