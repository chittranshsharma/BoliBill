"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

const API = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000";
type Shop = { id: string; name: string; address: string | null; role: "owner" | "cashier" };
type Product = { id: string; sku: string; name: string; alias: string | null; unit: string; pricePaise: number; active: boolean };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? body?.message ?? "Request failed.");
  return body as T;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  const loadShops = useCallback(async () => {
    const list = await api<Shop[]>("/api/shops");
    setShops(list);
    setShopId((current) => list.some((shop) => shop.id === current) ? current : (list[0]?.id ?? ""));
  }, []);

  useEffect(() => {
    api<{ session: unknown }>("/api/auth/get-session")
      .then(async (result) => { if (result?.session) { setSignedIn(true); await loadShops(); } })
      .catch(() => setNotice("API unavailable. Start the local database and API."))
      .finally(() => setReady(true));
  }, [loadShops]);

  useEffect(() => {
    if (!shopId) return;
    const controller = new AbortController();
    api<Product[]>(`/api/shops/${shopId}/products?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(setProducts).catch((error) => { if (error.name !== "AbortError") setNotice(error.message); });
    return () => controller.abort();
  }, [shopId, query]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const fields = new FormData(event.currentTarget);
    const payload = { email: fields.get("email"), password: fields.get("password"), ...(mode === "sign-up" ? { name: fields.get("name") } : {}) };
    try {
      await api(`/api/auth/${mode}/email`, { method: "POST", body: JSON.stringify(payload) });
      setSignedIn(true); await loadShops();
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }

  async function createShop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const shop = await api<Shop>("/api/shops", { method: "POST", body: JSON.stringify({ name: fields.get("name"), address: fields.get("address") }) });
      await loadShops(); setProducts([]); setShopId(shop.id); form.reset();
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const value = String(fields.get("price"));
    if (!/^\d+(\.\d{1,2})?$/.test(value)) { setNotice("Enter a price with at most two decimal places."); setBusy(false); return; }
    const [rupees, paise = ""] = value.split(".");
    const pricePaise = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));
    try {
      await api(`/api/shops/${shopId}/products`, { method: "POST", body: JSON.stringify({ sku: fields.get("sku"), name: fields.get("name"), alias: fields.get("alias") || undefined, unit: fields.get("unit"), pricePaise }) });
      setProducts(await api<Product[]>(`/api/shops/${shopId}/products?q=${encodeURIComponent(query)}`)); form.reset();
    } catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }

  async function toggle(product: Product) {
    try {
      await api(`/api/shops/${shopId}/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ active: !product.active }) });
      setProducts((items) => items.map((item) => item.id === product.id ? { ...item, active: !item.active } : item));
    } catch (error) { setNotice((error as Error).message); }
  }

  async function signOut() {
    await api("/api/auth/sign-out", { method: "POST", body: "{}" });
    setSignedIn(false); setShops([]); setShopId(""); setProducts([]);
  }

  const shop = shops.find((item) => item.id === shopId);
  return <main>
    <header className="topbar"><div><div className="brand">Boli<span>Bill</span><b>.</b></div><small>Faster billing for Indian counters</small></div><div className="top-actions"><span className="phase">PHASE 1 · CATALOG</span>{signedIn && <button className="link" onClick={signOut}>Sign out</button>}</div></header>
    {!ready ? <p className="loading">Connecting to your workspace…</p> : !signedIn ? <div className="welcome"><section><span className="eyebrow">LOCAL-FIRST CASHIER TOOLS</span><h1>Less typing.<br/><em>More flow.</em></h1><p>Set up your shop and product catalog today. Voice billing and payment follow in the next phases.</p><div className="footnote">English · हिन्दी · Hinglish · No paid APIs</div></section><section className="card auth"><span className="eyebrow">YOUR WORKSPACE</span><h2>{mode === "sign-in" ? "Welcome back" : "Create an account"}</h2><form onSubmit={authenticate} className="form">{mode === "sign-up" && <label>Name<input name="name" required minLength={2} autoComplete="name" /></label>}<label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} /></label><button className="primary" disabled={busy}>{mode === "sign-in" ? "Sign in" : "Create account"}</button></form><button className="link switch" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}</button></section></div> : <div className="workspace"><aside><span className="eyebrow">WORKSPACE</span><h1>Catalog</h1><p className="muted">Products ready for fast search at checkout.</p><label>Current shop<select value={shopId} onChange={(event) => setShopId(event.target.value)}><option value="">Select a shop</option>{shops.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role}</option>)}</select></label><div className="rule"/><h3>Add a shop</h3><form onSubmit={createShop} className="form"><label>Shop name<input name="name" required minLength={2} placeholder="Sharma Kirana" /></label><label>Address (optional)<textarea name="address" rows={2} placeholder="For future receipts" /></label><button className="secondary" disabled={busy}>Create shop</button></form></aside><section className="content">{shop ? <><div className="content-heading"><div><span className="eyebrow">{shop.role.toUpperCase()} ACCESS</span><h2>{shop.name}</h2><p className="muted">{shop.address || "No address added"}</p></div><span className="count">{products.length} products shown</span></div><label className="search">Search catalog<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, SKU, or alias" /></label><div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Unit</th><th>Price</th><th>Status</th>{shop.role === "owner" && <th>Action</th>}</tr></thead><tbody>{products.map((item) => <tr key={item.id}><td><strong>{item.name}</strong>{item.alias && <small>{item.alias}</small>}</td><td className="mono">{item.sku}</td><td>{item.unit}</td><td className="price">₹{(item.pricePaise / 100).toFixed(2)}</td><td><span className={item.active ? "pill active" : "pill"}>{item.active ? "Active" : "Inactive"}</span></td>{shop.role === "owner" && <td><button className="link" onClick={() => toggle(item)}>{item.active ? "Deactivate" : "Activate"}</button></td>}</tr>)}</tbody></table>{products.length === 0 && <div className="empty">No products found. {shop.role === "owner" ? "Add one below." : "Ask the owner to add products."}</div>}</div>{shop.role === "owner" && <section className="card add"><span className="eyebrow">OWNER TOOLS</span><h3>Add a product</h3><form onSubmit={createProduct} className="product-form"><label>SKU<input name="sku" required placeholder="RICE-01" /></label><label>Name<input name="name" required placeholder="Basmati rice" /></label><label>Alias<input name="alias" placeholder="Chawal" /></label><label>Unit<select name="unit"><option value="each">Each</option><option value="kg">kg</option><option value="g">g</option><option value="l">L</option><option value="ml">mL</option></select></label><label>Price (₹)<input name="price" required inputMode="decimal" placeholder="120.00" /></label><button className="primary" disabled={busy}>Add product</button></form></section>}</> : <div className="empty large">Create a shop to start your catalog.</div>}</section></div>}
    {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}>×</button></div>}
  </main>;
}
