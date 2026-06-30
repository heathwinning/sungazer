import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  /** Page title (appended to "Sungazer — ") */
  title?: string;
  /** Meta description (overrides default) */
  description?: string;
  /** Additional keywords to merge with defaults */
  keywords?: string;
  /** JSON-LD structured data object */
  schema?: Record<string, unknown>;
}

const BASE_TITLE = 'Sungazer — Solar Position & Daylight Charts';
const BASE_DESC =
  'Interactive solar position and daylight visualization tools. Compare day length, sun elevation, azimuth, shadow length, equation of time, polar sun paths, and a live daylight map for any city on Earth.';
const BASE_KEYWORDS = [
  'solar position',
  'daylight chart',
  'sun elevation',
  'azimuth',
  'day length',
  'equation of time',
  'shadow length',
  'polar sun path',
  'daylight map',
  'solar calculator',
  'sunrise',
  'sunset',
  'astronomy tool',
];

export default function SEOHead({ title, description, keywords, schema }: SEOHeadProps) {
  const pageTitle = title ? `${title} — Sungazer` : BASE_TITLE;
  const pageDesc = description || BASE_DESC;
  const pageKeywords = keywords
    ? [...BASE_KEYWORDS, ...keywords.split(',').map((k) => k.trim())].join(', ')
    : BASE_KEYWORDS.join(', ');

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="title" content={pageTitle} />
      <meta name="description" content={pageDesc} />
      <meta name="keywords" content={pageKeywords} />

      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDesc} />

      <meta property="twitter:title" content={pageTitle} />
      <meta property="twitter:description" content={pageDesc} />

      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}
