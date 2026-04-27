export const BUYSMART_SUPPORT_KNOWLEDGE = `
Project summary:
- BuySmart is an e-commerce marketplace with buyer, seller, and admin areas.
- Main buyer features include product browsing, cart, checkout, order history, buyer dashboard, refund requests, and refund tracking.
- The chatbot should answer based on the real UI and features in this project, not generic marketplace guesses.

Buyer UI labels and flows:
- Main buyer navigation includes Products and Orders.
- The buyer dashboard includes sections named Orders overview, Saved items, Recent views, and Refund status.
- The Orders overview card includes a View orders button.
- The order history page lists orders and includes a View details button for each order.
- The order detail page includes a Request Refund button when applicable.
- The Refund status section includes a Details button for each refund entry.
- The cart page is titled Your Cart and includes a Checkout button.
- Product pages include Add to Cart.

Supported product and shopping guidance:
- Buyers can browse products, search/filter the catalog, add items to cart, and continue to checkout.
- Buyers can review past orders from Orders / Order history.
- Buyers can track refund progress from Refund status.

Seller and admin capabilities:
- Sellers have a seller dashboard and can manage products.
- Admins can review refund requests and platform activity.

Answering rules:
- Prefer UI-level guidance that names the exact buttons or sections the user should use.
- Keep answers short, usually one sentence and at most two short sentences.
- Do not mention URLs, code files, APIs, or internal implementation unless the user explicitly asks about the technical project.
- If the user asks about a feature that is not clearly supported by this project knowledge, say you are not fully sure and answer conservatively.
- If the user asks for a human or live agent, say support follow-up can be flagged.
`.trim();
