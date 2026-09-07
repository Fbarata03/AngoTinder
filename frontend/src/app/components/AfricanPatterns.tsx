/**
 * Padrão geométrico inspirado nos tecidos e na arte Cokwe/Ovimbundu de Angola —
 * losangos entrelaçados, zigue-zagues e pontos. Usa `currentColor`, por isso
 * segue a cor do texto onde for colocado (ex.: text-secondary = dourado).
 */
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
      <defs>
        {/* Losangos entrelaçados com cruz interior (motivo "sona") */}
        <pattern id="ango-diamonds" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M24 2 L46 24 L24 46 L2 24 Z" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.28" />
          <path d="M24 12 L36 24 L24 36 L12 24 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.22" />
          <path d="M24 12 L24 36 M12 24 L36 24" stroke="currentColor" strokeWidth="1" opacity="0.18" />
          <circle cx="24" cy="24" r="1.6" fill="currentColor" opacity="0.4" />
          <circle cx="0" cy="0" r="1.6" fill="currentColor" opacity="0.3" />
          <circle cx="48" cy="0" r="1.6" fill="currentColor" opacity="0.3" />
          <circle cx="0" cy="48" r="1.6" fill="currentColor" opacity="0.3" />
          <circle cx="48" cy="48" r="1.6" fill="currentColor" opacity="0.3" />
        </pattern>
        {/* Faixa de zigue-zague */}
        <pattern id="ango-zigzag" x="0" y="0" width="32" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 18 L8 6 L16 18 L24 6 L32 18" stroke="currentColor" strokeWidth="1.25" fill="none" opacity="0.16" />
          <path d="M0 24 L8 12 L16 24 L24 12 L32 24" stroke="currentColor" strokeWidth="1.25" fill="none" opacity="0.1" />
        </pattern>
      </defs>
      <rect width="200" height="200" fill="url(#ango-zigzag)" />
      <rect width="200" height="200" fill="url(#ango-diamonds)" />
    </svg>
  );
}
