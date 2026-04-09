export function AfricanPattern({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <pattern id="pattern1" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="20" cy="20" r="2" fill="currentColor" opacity="0.3" />
        <path d="M20 10 L25 20 L20 30 L15 20 Z" fill="currentColor" opacity="0.2" />
      </pattern>
      <pattern id="pattern2" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M30 0 L40 20 L30 40 L20 20 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.2" />
        <circle cx="30" cy="30" r="5" fill="currentColor" opacity="0.15" />
      </pattern>
      <rect width="200" height="200" fill="url(#pattern1)" />
      <rect width="200" height="200" fill="url(#pattern2)" />
    </svg>
  );
}

export function AngolanFlag({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="20" fill="#CE1126" />
      <rect y="20" width="60" height="20" fill="#000000" />
      <g transform="translate(30, 20)">
        <circle cx="0" cy="0" r="6" stroke="#FFCD00" strokeWidth="1.5" fill="none" />
        <circle cx="0" cy="0" r="1.5" fill="#FFCD00" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <rect key={i} x="-0.5" y="-7" width="1" height="2" fill="#FFCD00" transform={`rotate(${angle})`} />
        ))}
        <path d="M-8 -2 L-3 0 L-8 2" stroke="#FFCD00" strokeWidth="1.5" fill="none" />
        <path d="M0 -8 L8 8" stroke="#FFCD00" strokeWidth="1.5" />
      </g>
      <path d="M30 8 L31 11 L34 11 L31.5 13 L32.5 16 L30 14 L27.5 16 L28.5 13 L26 11 L29 11 Z" fill="#FFCD00" />
    </svg>
  );
}
