# Vercel SPA routing note

The Vercel configuration rewrites all non-`/api/*` requests to `index.html` so
client-side routes (for example, `/session/:id`) refresh without a 404.
