import { defineConfig } from 'astro/config';

// Matches the old WordPress URLs (/neuralink/, ...) so existing links keep working.
// The project grid moved from /portfolio/ to /projects/; the old URL redirects.
export default defineConfig({
  site: 'https://www.andersenlee.ca',
  redirects: { '/portfolio/': '/projects/' },
  trailingSlash: 'always',
  build: { format: 'directory' },
});
