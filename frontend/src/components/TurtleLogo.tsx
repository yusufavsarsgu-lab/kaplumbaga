import React from 'react';

interface Props {
  size?: number;
  className?: string;
}

const TurtleLogo: React.FC<Props> = ({ size = 64, className = '' }) => {
  const gradientId = `shell-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="20" x2="80" y1="28" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22c55e" />
          <stop offset="1" stopColor="#166534" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="58" rx="34" ry="28" fill={`url(#${gradientId})`} />
      <ellipse cx="50" cy="58" rx="24" ry="19" fill="#15803d" opacity="0.72" />
      <path d="M50 35v45M28 58h44M35 43l30 30M65 43 35 73" stroke="#bbf7d0" strokeWidth="2.4" opacity="0.65" />
      <circle cx="50" cy="23" r="14" fill="#86efac" />
      <circle cx="44.5" cy="20" r="3" fill="#fff" />
      <circle cx="55.5" cy="20" r="3" fill="#fff" />
      <circle cx="45" cy="20.5" r="1.45" fill="#14532d" />
      <circle cx="56" cy="20.5" r="1.45" fill="#14532d" />
      <path d="M44 27c4 4 8 4 12 0" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="39.5" cy="25" r="2.4" fill="#fecaca" opacity="0.75" />
      <circle cx="60.5" cy="25" r="2.4" fill="#fecaca" opacity="0.75" />
      <ellipse cx="22" cy="53" rx="6" ry="10" fill="#86efac" transform="rotate(-23 22 53)" />
      <ellipse cx="78" cy="53" rx="6" ry="10" fill="#86efac" transform="rotate(23 78 53)" />
      <ellipse cx="29" cy="82" rx="6" ry="10" fill="#86efac" transform="rotate(-12 29 82)" />
      <ellipse cx="71" cy="82" rx="6" ry="10" fill="#86efac" transform="rotate(12 71 82)" />
      <path d="M50 84 57 93H43l7-9Z" fill="#86efac" />
    </svg>
  );
};

export default TurtleLogo;
