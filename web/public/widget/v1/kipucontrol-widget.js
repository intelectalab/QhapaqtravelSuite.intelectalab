const SCRIPT_ORIGIN = new URL(import.meta.url).origin;
const EVENTS = ["kipucontrol:ready", "kipucontrol:resize", "kipucontrol:date_selected", "kipucontrol:quote", "kipucontrol:checkout"];
const PASSTHROUGH = ["key", "lang", "currency", "theme", "radius", "reviews"];

class KipuControlFrame extends HTMLElement {
  static get observedAttributes() {
    return ["product", "category", "host", ...PASSTHROUGH];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.onMessage = this.onMessage.bind(this);
  }

  connectedCallback() {
    window.addEventListener("message", this.onMessage);
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.onMessage);
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  host() {
    return (this.getAttribute("host") || SCRIPT_ORIGIN).replace(/\/+$/, "");
  }

  path() {
    return "catalogo";
  }

  source() {
    const query = new URLSearchParams();
    for (const name of PASSTHROUGH) {
      const value = this.getAttribute(name);
      if (value === null) continue;
      query.set(name, name === "theme" ? value.replace("#", "") : name === "reviews" && value === "" ? "1" : value);
    }
    const category = this.getAttribute("category");
    if (category) query.set("category", category);
    return `${this.host()}/widget/${encodeURIComponent(this.path())}?${query.toString()}`;
  }

  render() {
    const src = this.source();
    if (this.frame && this.frame.getAttribute("src") === src) return;
    const radius = Number(this.getAttribute("radius") || 10);
    this.shadowRoot.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `:host{display:block;width:100%}iframe{display:block;width:100%;min-height:${this.minHeight()}px;border:0;border-radius:${Math.max(0, Math.min(24, radius))}px;background:transparent;transition:height .2s ease}`;
    const frame = document.createElement("iframe");
    frame.setAttribute("src", src);
    frame.setAttribute("title", this.getAttribute("lang") === "en" ? "Online booking" : "Reserva en línea");
    frame.setAttribute("loading", "lazy");
    frame.setAttribute("allow", "payment");
    this.shadowRoot.append(style, frame);
    this.frame = frame;
  }

  minHeight() {
    return 640;
  }

  onMessage(event) {
    if (!this.frame || event.source !== this.frame.contentWindow || event.origin !== new URL(this.host()).origin) return;
    const data = event.data;
    if (!data || typeof data !== "object" || !EVENTS.includes(data.type)) return;
    if (data.type === "kipucontrol:resize" && data.detail && Number(data.detail.height) > 0) this.frame.style.height = `${Math.ceil(Number(data.detail.height))}px`;
    this.dispatchEvent(new CustomEvent(data.type, { detail: data.detail || {}, bubbles: true, composed: true }));
  }
}

class KipuControlBooking extends KipuControlFrame {
  path() {
    return this.getAttribute("product") || "catalogo";
  }
}

class KipuControlCatalog extends KipuControlFrame {
  minHeight() {
    return 420;
  }
}

const REVIEW_ATTRIBUTES = ["sources", "min-rating", "count", "layout"];

class KipuControlReviews extends KipuControlFrame {
  static get observedAttributes() {
    return [...KipuControlFrame.observedAttributes, ...REVIEW_ATTRIBUTES];
  }

  path() {
    return "resenas";
  }

  source() {
    const url = new URL(super.source());
    for (const name of REVIEW_ATTRIBUTES) {
      const value = this.getAttribute(name);
      if (value !== null && value !== "") url.searchParams.set(name, value);
    }
    return url.toString();
  }

  minHeight() {
    return 260;
  }
}

if (!customElements.get("kipucontrol-booking")) customElements.define("kipucontrol-booking", KipuControlBooking);
if (!customElements.get("kipucontrol-catalog")) customElements.define("kipucontrol-catalog", KipuControlCatalog);
if (!customElements.get("kipucontrol-reviews")) customElements.define("kipucontrol-reviews", KipuControlReviews);
