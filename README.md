# ScreenTime Nepal

A lightweight static storefront for Netflix, Prime Video, Spotify, Claude, Gemini AI Pro and Duolingo Super plans in Nepal. Customers pick a plan, collect it in a bag stored in their browser, and send the order as a chat message on WhatsApp or Instagram. **This is not a payment gateway and does not activate subscriptions.**

The interface follows Apple's design approach: a white theme, system typography, lightweight liquid-glass surfaces, a translucent navigation bar, and spring-physics sheets you can drag, flick away or grab mid-animation (bottom sheets on phones; a centered card and a side panel on larger screens). Blur is reserved for a few small, high-value surfaces; repeated cards use cheap translucent gradients and compositor-friendly motion. Motion plays once on entry, follows scroll (the hero recedes, icons drift, the closing icons gather into a fan) or follows the pointer (icons tilt, tiles light up in their brand color); nothing loops. It respects reduced motion, reduced transparency and increased contrast settings.

## Before accepting orders

Edit [`config.js`](config.js):

- `whatsappNumber`: your WhatsApp number with country code, digits only (e.g. `97798XXXXXXXX` with real digits). While it's empty, checkout offers Instagram only.
- `instagramUrl`: your business profile (currently `@screentimenp`). Instagram can't pre-fill a message, so checkout copies the order and opens a chat with that account. Set it to `''` to hide Instagram.
- `products`: each plan is `'label': price` in NPR. Duration labels such as `'3 months'` also show a per-month price; plans like Shared/Private take a `term`. Each product's logo is `assets/<id>.svg`; its brand color is a `[data-brand=<id>]` rule in `styles.css` (blue if missing).
- Verify prices and fulfilment terms with your suppliers. See [`RESEARCH.md`](RESEARCH.md) for sources and assumptions.
- Share verified eSewa/Khalti details or a bank QR in the chat before the customer pays. The site never collects payments or customer credentials.

The order message lists the plans, quantities, estimated total, payment preference and optional name. Sending it doesn't clear the bag or count as a purchase. Plans can be linked directly, e.g. `/#netflix` or `/#gemini-ai-pro`; links from the previous site (`/products/<id>`) still open the matching plan.

## Run and test

Serve the directory over HTTP (ES modules do not run from `file://`):

```sh
python3 -m http.server 4173
# Visit http://localhost:4173
```

Use the Node version in [`.nvmrc`](.nvmrc) before installing the test tooling.

Install the local test dependency and its pinned headless Chromium browser:

```sh
npm install
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install --with-deps chromium
```

Run the headless Playwright smoke test from the project root:

```sh
npm test
```

Playwright launches its project-local Chromium in headless mode. The test checks the white theme (even when the system prefers dark), liquid-glass materials, scroll-in animations finishing visible, the catalog, plan picker, bag, checkout message, persistence, phone sheet gestures, old product links, reduced motion, mobile overflow and browser errors. Expected prices are read from `config.js`.

## Deploy

Production is the Cloudflare Pages project `screentimenepal` (direct upload, <https://screentimenepal.pages.dev>). Upload only the public files:

```sh
rm -rf /tmp/screentime-dist && mkdir /tmp/screentime-dist
cp -r index.html styles.css app.js config.js assets /tmp/screentime-dist/
npx wrangler pages deploy /tmp/screentime-dist --project-name screentimenepal --branch main
```

There is no production build step, and the deployed site has no runtime dependencies, secrets or remote asset hosts. Playwright is a development-only verification dependency. Without a `404.html`, Pages serves `index.html` for unknown paths, which keeps plan links working. Re-deploy after editing `config.js`; earlier deployments stay available for rollback in the Cloudflare dashboard.

All brand assets, the favicon, CSS and JS are local; text uses the visitor's system font. ScreenTime Nepal is not affiliated with the brands shown; trademarks belong to their owners.
