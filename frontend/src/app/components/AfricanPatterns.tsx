export function AfricanPattern({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 200 200"
      width="100%"
      height="100%"
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
