# Research: ScreenTime Nepal

Checked 30 September 2026. Prices below are **editable storefront placeholders**, not official prices, live quotations, or an offer from the named brands. Verify supply, terms, fulfilment method, and current pricing before taking payment. All prices in NPR.

| Service | Reference found | Storefront placeholder (1 / 2 / 3 months) |
| --- | --- | --- |
| Netflix | [RoyalSewa dual-screen listing](https://www.royalsewa.com/product/netflix-subscription-price-in-nepal-dual-screen): Rs. 499 / 899 / 1,399 for 1 / 2 / 3 months. Its [single-screen listing](https://www.royalsewa.com/product/netflix-subscription-price-in-nepal-single-screen-shared) starts at Rs. 350. | 499 / 899 / 1,399 (based on the dual-screen example; do not promise a particular account type until confirmed). |
| Prime Video | [RoyalSewa single-screen listing](https://www.royalsewa.com/product/amazon-prime-subscription-price-in-nepal): Rs. 99 for 1 month and Rs. 299 for 3 months. | 199 / 379 / 549 (higher provisional price to allow for supplier variation; not a quoted RoyalSewa price). |
| Spotify | [RoyalSewa individual-plan listing](https://www.royalsewa.com/product/spotify-premium-price-in-nepal-individual-plan): Rs. 999 for 2 months, Rs. 1,499 for 3 months; [Spotify Nepal](https://www.spotify.com/np-en/premium/) advertises Individual at US$3.29/month after its introductory offer. | 549 / 999 / 1,499 (1-month estimate extrapolated from reseller prices). |
| Claude | [RoyalSewa private listing](https://www.royalsewa.com/product/claude-ai-subscription-in-nepal-private): Rs. 3,699 for 1 month; [shared listing](https://www.royalsewa.com/product/claude-ai-subscription-in-nepal-shared): Rs. 1,999 for 1 month. | 3,699 / 7,299 / 10,799 (2/3 months estimated; fulfilment must be confirmed). |

Added 13 October 2026 from the owner's previous ScreenTime Nepal site (screentimenepal.pages.dev, deployed 7 October 2026). These are the owner's own listed prices:

| Service | Plans | Storefront price |
| --- | --- | --- |
| Gemini AI Pro | 18 months, Shared plan / Private profile | 499 / 999 |
| Duolingo Super | 12 months | 999 |

## How local sellers operate

- RoyalSewa's [store](https://www.royalsewa.com/store) displays NPR prices and duration options and lists eSewa, Khalti, ConnectIPS, and bank transfer; its [contact page](https://www.royalsewa.com/contact) links WhatsApp. This suggests a familiar flow of selecting a plan, confirming with a seller, then paying locally.
- [RoyalSewa's Netflix guide](https://www.royalsewa.com/blog/how-to-buy-netflix-subscription-in-nepal-in-2026-cheapest-plans-explained) describes ordering without an international card via eSewa or Khalti. Social DMs/Instagram are another common contact channel. The owner's Instagram account, [@screentimenp](https://www.instagram.com/screentimenp/), listed on their previous site, is configured as an order channel. **No payment destination was supplied**, so the storefront does not invent one.
- ScreenTime Nepal has **no payment integration**: a WhatsApp message is an order request, not proof of purchase. The customer should request verified eSewa/Khalti details or a bank QR from the owner in the chat before sending money. No testimonials, fulfilment guarantees, or official brand affiliation are asserted.

The owner should set `whatsappNumber` and verify prices in `config.js` before accepting orders. With no number set, checkout offers Instagram only, copying the order for the visitor to paste into the chat. If Instagram is also removed, WhatsApp falls back to a share flow that **cannot reach the owner automatically**.

Brand marks: Netflix, Spotify, Claude, Google Gemini and Duolingo from [Simple Icons](https://github.com/simple-icons/simple-icons) (v16.35.0, recolored with each brand's color); Prime Video from [Wikimedia Commons (2024 logo)](https://commons.wikimedia.org/wiki/File:Amazon_Prime_Video_logo_(2024).svg). Text uses the visitor's system font, so no web fonts are loaded. All assets are stored in `assets/`.
