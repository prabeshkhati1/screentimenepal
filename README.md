# ScreenTime Nepal

A lightweight, mobile-friendly static storefront for Netflix, Prime Video, Spotify and Claude subscription inquiries in Nepal. Customers choose 1-, 2- or 3-month plans, collect them in a local cart and send an order request via WhatsApp. **This is not a payment gateway and does not activate subscriptions.**

## Before accepting orders

Edit [`config.js`](config.js):

- Set `whatsappNumber` to **your own** WhatsApp number with country code, digits only (e.g. `97798XXXXXXXX` with real digits). Until this is set, the site opens WhatsApp's generic share flow instead of directing orders to the shop.
- Verify and edit each product's `prices` (NPR) and the specific account/fulfilment terms with your suppliers. The displayed prices are estimates; see [`RESEARCH.md`](RESEARCH.md) for sources and assumptions.
- Optionally set `instagramUrl` to your real business profile. No account or payment destination is supplied by default.
- Share **verified** eSewa/Khalti details or bank QR and delivery terms with the customer in the chat before they pay. The site does not collect payments or customer credentials.

The order message includes selected plans, quantities, estimated total, payment preference and optional name. The cart is stored only in the visitor's browser (`localStorage`); sending a message does not clear it or count as a completed purchase.

## Run and test

Serve the directory over HTTP (ES modules do not run reliably from `file://`):

```sh
python3 -m http.server 4173
# Visit http://localhost:4173
```

Run the dependency-free Chrome browser smoke test from the project root:

```sh
node tests/smoke.mjs
```

Chrome or Chromium must be installed (`CHROME_BIN` can override the executable). The test serves the site on localhost, checks assets, plan selection, cart persistence, checkout message, mobile overflow and browser errors.

## Deploy to Cloudflare Pages

Connect the GitHub repo to Cloudflare Pages. Choose **no framework**, leave the build command empty, set the output directory to `/` (repository root), and deploy the `main` branch. No dependencies, build step, secrets, server or remote asset hosts are needed. Re-deploy after updating `config.js`.

All fonts, brand assets, favicon, CSS and JS are stored locally under `assets/` or at the repository root. The UI respects reduced-motion preferences. ScreenTime Nepal is not affiliated with the brands shown; trademarks belong to their owners.
