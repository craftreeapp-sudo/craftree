import { ImageResponse } from 'next/og';

export const alt = 'Craftree — L’arbre de fabrication de la civilisation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0A0E17 0%, #111827 50%, #0A0E17 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            padding: 48,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'baseline',
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#E8ECF4',
            }}
          >
            <span>Craft</span>
            <span style={{ color: '#3B82F6' }}>ree</span>
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#8B95A8',
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            L’arbre de fabrication de la civilisation
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
