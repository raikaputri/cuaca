# Iki Weather — API cuaca pay-per-call (x402, Base)

API cuaca $0,001 USDC per call di Base. Data dari Open-Meteo (gratis, tanpa
API key). Dibuat untuk didaftarkan di vAPI Call
(https://api.vapinetwork.ai/call/my-apis/new).

## Cara kerja

- `GET /weather/current?city=Jakarta` — route berbayar.
- Tanpa pembayaran, server balas **HTTP 402** berisi detail pembayaran
  (harga $0,001, USDC, network `base`, payTo wallet kamu).
- Pembeli tanda tangan otorisasi EIP-3009 → facilitator
  (`https://x402.org/facilitator`) verifikasi & settle → server balas data.
- Server **tidak pegang private key apa pun**.

## Konfigurasi (env)

| Var | Default | Arti |
|---|---|---|
| `PAY_TO` | `0xf724f897D9E526B704b24EA5a7c8ebD160909285` | Wallet penerima USDC (MetaMask iki) |
| `PRICE` | `$0.001` | Harga per call |
| `NETWORK` | `base` | Base mainnet |
| `FACILITATOR_URL` | `https://facilitator.monexprotocol.org` | Facilitator x402 (harus dukung Base mainnet — facilitator publik x402.org hanya testnet, jadi jangan pakai itu untuk mainnet) |
| `PORT` | `3000` | Port server |

## Jalankan lokal

```bash
npm install
npm start
# Tes tanpa bayar — harus balas 402:
curl -s http://localhost:3000/weather/current?city=Jakarta | head -c 600
# Route gratis:
curl -s http://localhost:3000/health
curl -s http://localhost:3000/.well-known/x402
```

## Deploy (Railway, gratis tier)

1. Push folder ini ke GitHub (repo baru, privat atau publik).
2. Railway → New Project → Deploy from GitHub repo.
3. Set env var `PAY_TO` (opsional, default sudah wallet iki).
4. Railway memberi domain `https://<nama>.up.railway.app` — itu host publikmu.
5. Cek dari internet: `curl https://<host>/health` harus balas `{"ok":true}`.

Alternatif: Render (Web Service, free tier) atau Fly.io — langkahnya sama
(connect repo, `npm start`, domain publik otomatis).

## Daftarkan di vAPI Call

1. Buka https://api.vapinetwork.ai/call/my-apis/new
2. Method **GET**, isi URL: `https://<host-kamu>/openapi.json`
   (atau endpoint langsung `https://<host-kamu>/weather/current?city=Jakarta`)
3. Ikuti langkah Discover → Describe → Payout.
   Payout wallet = alamat yang sama dengan `PAY_TO` di atas.

## Uji bayar end-to-end (setelah deploy)

Dari mesin yang punya USDC di Base (misal CLI vAPI):

```bash
vapi pay 'https://<host-kamu>/weather/current?city=Jakarta' \
  --method GET --network eip155:8453 \
  --expected-pay-to 0xf724f897D9E526B704b24EA5a7c8ebD160909285 \
  --max 0.01 --json
```

Harus balas status 200 + data cuaca. USDC $0,001 masuk ke wallet `PAY_TO`.

## File

- `src/server.js` — server Express + middleware `@x402/express` v2
- `openapi.json` — dokumen OpenAPI (ganti `servers[0].url` dengan host
  hasil deploy sebelum didaftarkan)
- `package.json` — deps: `express`, `@x402/core`, `@x402/express`,
  `@x402/evm`, `@x402/svm` (v2.30.0)
