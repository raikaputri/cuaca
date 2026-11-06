import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// vAPI x402 Weather API — pay-per-call di Base ($0.001 USDC / call)
// Data dari Open-Meteo (gratis, tanpa API key): geocoding + forecast.
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT || 3000);

// Wallet penerima pembayaran (USDC di Base). Default: wallet MetaMask iki.
// Ganti lewat env PAY_TO kalau mau pakai alamat lain — JANGAN commit
// private key apa pun ke repo ini; server tidak butuh private key.
const PAY_TO =
  process.env.PAY_TO || "0xf724f897D9E526B704b24EA5a7c8ebD160909285";

const PRICE = process.env.PRICE || "$0.001";
const NETWORK = "eip155:8453"; // Base mainnet (CAIP-2)
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.monexprotocol.org";

const app = express();

const __dirname = dirname(fileURLToPath(import.meta.url));
const openapi = JSON.parse(
  readFileSync(join(__dirname, "..", "openapi.json"), "utf-8"),
);

// --- x402 paywall (v2): hanya /weather/current yang berbayar -------------
// API persis sesuai paket terinstal @x402/express 2.30.0:
// paymentMiddlewareFromConfig(routes, facilitatorClient, schemes)
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

app.use(
  paymentMiddlewareFromConfig(
    {
      "GET /weather/current": {
        accepts: {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
        },
        description: "Current weather for a city (Open-Meteo).",
      },
    },
    facilitator,
    [{ network: NETWORK, server: new ExactEvmScheme() }],
  ),
);

// --- Route gratis ----------------------------------------------------------
app.get("/", (_req, res) => {
  res.json({
    name: "Iki Weather",
    description:
      "Pay-per-call weather API via x402 — $0.001 USDC per call on Base.",
    paid_route: "GET /weather/current?city=Jakarta",
    price: PRICE,
    network: NETWORK,
    payTo: PAY_TO,
    openapi: "/openapi.json",
  });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// Dokumen OpenAPI — ini URL yang dimasukkan ke form "Add API" vAPI
// (Discover step): https://<host-kamu>/openapi.json
app.get("/openapi.json", (_req, res) => res.json(openapi));

// --- Route berbayar --------------------------------------------------------
app.get("/weather/current", async (req, res) => {
  const city = String(req.query.city || "Jakarta").trim();
  if (!city) return res.status(400).json({ error: "query param city wajib diisi" });

  try {
    // 1. Geocoding: nama kota -> lat/lon (Open-Meteo, gratis)
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city,
      )}&count=1&language=en&format=json`,
    );
    if (!geoRes.ok) throw new Error(`geocoding HTTP ${geoRes.status}`);
    const geo = await geoRes.json();
    if (!geo.results?.length) {
      return res.status(404).json({ error: `kota tidak ditemukan: ${city}` });
    }
    const place = geo.results[0];

    // 2. Forecast saat ini (Open-Meteo, gratis)
    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10kmh,wind_direction_10deg,pressure_msl,cloud_cover&timezone=auto`,
    );
    if (!wxRes.ok) throw new Error(`forecast HTTP ${wxRes.status}`);
    const wx = await wxRes.json();
    const c = wx.current || {};

    res.json({
      city: place.name,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: wx.timezone,
      current: {
        temp_c: c.temperature_2m,
        feels_like_c: c.apparent_temperature,
        humidity_pct: c.relative_humidity_2m,
        wind_kmh: c.wind_speed_10kmh,
        wind_dir_deg: c.wind_direction_10deg,
        pressure_hpa: c.pressure_msl,
        cloud_cover_pct: c.cloud_cover,
        condition_code: c.weather_code,
        observed_at: c.time,
      },
      payer: res.locals.payment?.payer ?? null,
    });
  } catch (e) {
    console.error("weather error:", e);
    res.status(502).json({ error: "gagal ambil data cuaca", detail: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Iki Weather jalan di port ${PORT}`);
  console.log(`  Berbayar : GET /weather/current?city=Jakarta — ${PRICE} di ${NETWORK}`);
  console.log(`  Penerima : ${PAY_TO}`);
  console.log(`  OpenAPI  : /openapi.json`);
});
