# Task: build "ScreenTime Nepal"

Build a website called **ScreenTime Nepal**: an e-commerce storefront for digital subscriptions sold in Nepal.

## Products
Netflix, Prime Video, Spotify, Claude — each sold as 1, 2 and 3 month plans (duration selector, price per duration).

## Requirements
- Research first: look up realistic Nepal pricing (NPR) for each service and how Nepali digital-subscription resellers present/sell (payment via eSewa / Khalti / bank QR, WhatsApp/Instagram ordering). Put findings and price sources in RESEARCH.md. Use sensible reseller prices, and note they are placeholders the owner can edit.
- Fetch needed assets yourself (logos/brand icons via simple-icons or official brand SVGs, fonts, a favicon). Store locally under /assets. No broken hotlinks.
- Simple, clean design, but FILLED with animations: hero entrance, scroll-reveal, hover lift/tilt on cards, animated plan/duration toggle, animated price counter, marquee of service logos, cart drawer slide-in, button micro-interactions, smooth page transitions. Respect prefers-reduced-motion.
- Features: product grid, product detail/plan picker, cart (localStorage), checkout that sends the order to WhatsApp (wa.me link with order summary) plus eSewa/Khalti/bank instructions, FAQ, how-it-works, trust/testimonials section, footer with contact. Mobile-first and responsive.
- Keep the stack lightweight: static site (plain HTML/CSS/vanilla JS, or Vite if truly needed). Must deploy on Cloudflare Pages with no build step ideally.
- Keep WhatsApp number and prices in one config file (config.js) so they are easy to edit.
- Do not invent fake legal claims. Add a small disclaimer: not affiliated with the brands; trademarks belong to their owners.

## Delivery
- Test it locally (serve it and check pages load, cart works, no console errors).
- Write a proper README.md.
- Commit and `git push origin main` to https://github.com/prabeshkhati1/screentimenepal (remote already set).
