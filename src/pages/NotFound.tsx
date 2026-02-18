import { Link } from 'react-router-dom';
import { GlitchText } from '../components/GlitchText';

export function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <GlitchText text="404" tag="h1" />
      <p style={{ color: '#888', marginTop: '1rem', fontSize: '1.1rem' }}>
        Page not found
      </p>
      <Link
        to="/"
        style={{
          display: 'inline-block',
          marginTop: '2rem',
          padding: '0.5rem 1.5rem',
          border: '1px solid #0f0',
          color: '#0f0',
          textDecoration: 'none',
          fontFamily: 'monospace',
        }}
      >
        RETURN TO OVERVIEW
      </Link>
    </div>
  );
}
