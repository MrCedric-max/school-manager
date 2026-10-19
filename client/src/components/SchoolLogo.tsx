import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { cx } from './ui';

/**
 * The school crest.
 *
 * The server always has one: the picture uploaded in *Settings*, or the crest that ships with the
 * app. It is printed on the report cards and shown wherever the school identifies itself — the
 * sign-in page, the sidebar, the class reports. If the picture cannot be read the crest falls back to
 * a monogram of the school name, so no page is ever left with a broken image.
 */
export function SchoolLogo({
  version = 'crest',
  className,
  fallback,
  monogramClassName,
}: {
  /** Cache-busting value from the settings (`logoVersion`). */
  version?: string;
  className?: string;
  /** Shown when the picture is missing — the school name, or an icon when it is empty. */
  fallback?: string;
  monogramClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const initials = (fallback ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  if (broken) {
    return (
      <div
        className={cx(
          'flex items-center justify-center bg-school-50 font-bold text-school-900',
          monogramClassName ?? 'h-10 w-10 rounded-lg text-sm',
          className,
        )}
        aria-hidden="true"
      >
        {initials || <GraduationCap className="h-1/2 w-1/2" />}
      </div>
    );
  }

  return (
    <img
      src={`/api/logo?v=${encodeURIComponent(version)}`}
      alt={fallback ? `${fallback} ${''}`.trim() : ''}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
