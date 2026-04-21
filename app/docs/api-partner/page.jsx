import Link from 'next/link';

export const metadata = {
  title: 'Partner API Docs | PBS Mail',
  description: 'Dokumentasi publik untuk penggunaan Partner API PBS Mail.'
};

const endpoints = [
  {
    method: 'POST',
    path: '/api/v1/partner/aliases',
    summary: 'Buat alias email baru untuk API key yang sedang aktif.'
  },
  {
    method: 'GET',
    path: '/api/v1/partner/messages?alias=nama@domain.com',
    summary: 'Ambil daftar pesan untuk alias yang dimiliki API key.'
  },
  {
    method: 'GET',
    path: '/api/v1/partner/messages/:id?alias=nama@domain.com',
    summary: 'Ambil detail satu pesan untuk alias yang dimiliki API key.'
  },
  {
    method: 'GET',
    path: '/api/v1/partner/otp?alias=nama@domain.com&waitSeconds=20',
    summary: 'Polling OTP terbaru untuk alias tertentu.'
  },
  {
    method: 'GET',
    path: '/api/v1/partner/health',
    summary: 'Cek status API key, scope, dan rate limit yang tersisa.'
  }
];

const scopes = [
  {
    name: 'alias:create',
    description: 'Mengizinkan create alias baru melalui endpoint /aliases.'
  },
  {
    name: 'messages:read',
    description: 'Mengizinkan baca daftar pesan dan detail pesan.'
  },
  {
    name: 'otp:read',
    description: 'Mengizinkan polling OTP terbaru dari pesan alias.'
  }
];

export default function PartnerApiDocsPage() {
  return (
    <main className="partner-docs-shell">
      <style>{`
        .partner-docs-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top left, rgba(99,102,241,0.16), transparent 34%),
            radial-gradient(circle at top right, rgba(16,185,129,0.14), transparent 28%),
            linear-gradient(180deg, #0f172a 0%, #111827 34%, #f8fafc 34%, #f8fafc 100%);
          color: #0f172a;
        }
        .partner-docs-hero {
          color: #fff;
          padding: 4rem 0 7rem;
        }
        .partner-docs-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.8rem;
          border-radius: 999px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.18);
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.03em;
        }
        .partner-docs-title {
          font-size: clamp(2.1rem, 5vw, 4rem);
          font-weight: 800;
          line-height: 1.02;
          letter-spacing: -0.04em;
          margin: 1rem 0 1rem;
          max-width: 12ch;
        }
        .partner-docs-lead {
          max-width: 720px;
          color: rgba(255,255,255,0.82);
          font-size: 1.02rem;
          line-height: 1.7;
          margin: 0;
        }
        .partner-docs-grid {
          margin-top: -4rem;
          padding-bottom: 4rem;
        }
        .partner-docs-card {
          background: #fff;
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 22px;
          box-shadow: 0 20px 55px rgba(15,23,42,0.08);
        }
        .partner-docs-card-inner {
          padding: 1.5rem;
        }
        .partner-docs-section {
          background: #fff;
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 22px;
          box-shadow: 0 20px 55px rgba(15,23,42,0.06);
          padding: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .partner-docs-section h2,
        .partner-docs-section h3 {
          letter-spacing: -0.02em;
        }
        .partner-docs-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          border-radius: 999px;
          background: #eef2ff;
          color: #3730a3;
          padding: 0.4rem 0.75rem;
          font-size: 0.82rem;
          font-weight: 700;
        }
        .partner-docs-code {
          background: #0b1220;
          color: #e2e8f0;
          border-radius: 18px;
          padding: 1rem 1.1rem;
          overflow-x: auto;
          font-size: 0.88rem;
          line-height: 1.7;
          margin: 0;
        }
        .partner-docs-table {
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 18px;
          overflow: hidden;
        }
        .partner-docs-table .table {
          margin-bottom: 0;
        }
        .partner-docs-table .table th {
          background: #f8fafc;
          color: #475569;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .partner-docs-table .table td,
        .partner-docs-table .table th {
          vertical-align: top;
          padding: 0.95rem 1rem;
        }
        .partner-docs-kicker {
          color: #64748b;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 800;
          margin-bottom: 0.5rem;
        }
        .partner-docs-callout {
          border-radius: 18px;
          padding: 1rem 1rem;
          background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(16,185,129,0.1));
          border: 1px solid rgba(99,102,241,0.16);
        }
        .partner-docs-list li + li {
          margin-top: 0.55rem;
        }
        .partner-docs-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 0 0;
        }
        .partner-docs-topbar a {
          color: #fff;
          text-decoration: none;
        }
        @media (max-width: 991.98px) {
          .partner-docs-hero {
            padding-bottom: 5rem;
          }
          .partner-docs-grid {
            margin-top: -3rem;
          }
        }
        @media (max-width: 767.98px) {
          .partner-docs-topbar {
            flex-wrap: wrap;
          }
          .partner-docs-card-inner,
          .partner-docs-section {
            padding: 1.1rem;
          }
        }
      `}</style>

      <section className="partner-docs-hero">
        <div className="container-xl">
          <div className="partner-docs-topbar">
            <div className="partner-docs-badge">
              <i className="bi bi-file-earmark-text" />
              Dokumentasi publik
            </div>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <Link href="/" className="text-white text-decoration-none small fw-semibold">
                <i className="bi bi-house me-1" />Home
              </Link>
              <Link href="/admin" className="text-white text-decoration-none small fw-semibold">
                <i className="bi bi-shield-lock me-1" />Admin
              </Link>
            </div>
          </div>

          <div className="row align-items-end g-4 mt-3">
            <div className="col-12 col-lg-8">
              <p className="partner-docs-badge mb-3">
                <i className="bi bi-key" />
                PBS Mail Partner API v1
              </p>
              <h1 className="partner-docs-title">Dokumentasi API Partner</h1>
              <p className="partner-docs-lead">
                Halaman ini menjelaskan cara memakai Partner API untuk membuat alias email sementara,
                membaca pesan milik alias tersebut, dan mengambil OTP. Halaman ini publik dan tidak
                memerlukan login admin.
              </p>
            </div>
            <div className="col-12 col-lg-4">
              <div className="partner-docs-callout">
                <div className="fw-bold mb-2">Ringkasnya</div>
                <ul className="mb-0 ps-3 small">
                  <li>Gunakan header <code>x-api-key</code>.</li>
                  <li>Scope menentukan akses endpoint.</li>
                  <li>Alias hanya bisa diakses oleh API key pemiliknya.</li>
                  <li>OTP bisa dipolling sampai batas waktu.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="partner-docs-grid">
        <div className="container-xl">
          <div className="row g-4">
            <div className="col-12 col-lg-8">
              <div className="partner-docs-section">
                <div className="partner-docs-kicker">1. Autentikasi</div>
                <h2 className="h4 mb-3">Header API Key</h2>
                <p className="mb-3">
                  Semua request ke endpoint partner harus menyertakan API key pada header berikut:
                </p>
                <pre className="partner-docs-code mb-3"><code>{`x-api-key: tpk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</code></pre>
                <ul className="partner-docs-list mb-0">
                  <li>API key hanya ditampilkan sekali saat dibuat atau di-rotate.</li>
                  <li>Jika key kadaluarsa atau dicabut, semua request akan ditolak.</li>
                  <li>Beberapa key bisa dibatasi berdasarkan domain, IP, scope, dan rate limit.</li>
                  <li>Jika field <code>domain</code> tidak dikirim saat create alias, server akan memilih domain aktif yang diizinkan oleh API key.</li>
                </ul>
              </div>

              <div className="partner-docs-section">
                <div className="partner-docs-kicker">2. Scope</div>
                <h2 className="h4 mb-3">Hak akses yang tersedia</h2>
                <div className="row g-3">
                  {scopes.map((scope) => (
                    <div className="col-12 col-md-4" key={scope.name}>
                      <div className="h-100 p-3 rounded-4 border bg-light">
                        <div className="fw-bold mb-1"><code>{scope.name}</code></div>
                        <p className="small text-secondary mb-0">{scope.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="partner-docs-section">
                <div className="partner-docs-kicker">3. Endpoint</div>
                <h2 className="h4 mb-3">Daftar endpoint partner</h2>
                <div className="partner-docs-table">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead>
                        <tr>
                          <th style={{ width: '120px' }}>Method</th>
                          <th>Path</th>
                          <th>Fungsi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {endpoints.map((item) => (
                          <tr key={`${item.method}-${item.path}`}>
                            <td><span className="badge text-bg-dark">{item.method}</span></td>
                            <td><code>{item.path}</code></td>
                            <td>{item.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="partner-docs-section">
                <div className="partner-docs-kicker">4. Alur Pakai</div>
                <h2 className="h4 mb-3">Flow integrasi yang disarankan</h2>
                <ol className="mb-0 partner-docs-list ps-3">
                  <li>Admin membuat API key dari dashboard admin.</li>
                  <li>Partner memanggil endpoint create alias untuk membuat alamat email sementara.</li>
                  <li>Partner memanggil endpoint messages untuk membaca inbox alias tersebut.</li>
                  <li>Jika email berisi OTP, partner memanggil endpoint otp dan menunggu sampai kode ditemukan.</li>
                </ol>
              </div>

              <div className="partner-docs-section">
                <div className="partner-docs-kicker">5. Contoh Integrasi</div>
                <h2 className="h4 mb-3">Contoh di beberapa bahasa umum</h2>
                <div className="row g-3">
                  <div className="col-12 col-xl-6">
                    <div className="p-3 rounded-4 border bg-light h-100">
                      <div className="fw-bold mb-2">JavaScript / Node.js</div>
                      <pre className="partner-docs-code mb-0" style={{ fontSize: '0.8rem' }}><code>{`const res = await fetch('https://your-domain.com/api/v1/partner/aliases', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.PBS_API_KEY,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    localPart: 'demo123',
    ttlMinutes: 60,
    reference: 'order-001'
  })
});

const data = await res.json();`}</code></pre>
                    </div>
                  </div>
                  <div className="col-12 col-xl-6">
                    <div className="p-3 rounded-4 border bg-light h-100">
                      <div className="fw-bold mb-2">Python</div>
                      <pre className="partner-docs-code mb-0" style={{ fontSize: '0.8rem' }}><code>{`import requests

res = requests.post(
    'https://your-domain.com/api/v1/partner/aliases',
    headers={'x-api-key': 'tpk_xxx'},
    json={'localPart': 'demo123', 'ttlMinutes': 60}
)
data = res.json()`}</code></pre>
                    </div>
                  </div>
                  <div className="col-12 col-xl-6">
                    <div className="p-3 rounded-4 border bg-light h-100">
                      <div className="fw-bold mb-2">PHP</div>
                      <pre className="partner-docs-code mb-0" style={{ fontSize: '0.8rem' }}><code>{`$client = new \GuzzleHttp\Client();
$res = $client->post('https://your-domain.com/api/v1/partner/aliases', [
  'headers' => ['x-api-key' => 'tpk_xxx'],
  'json' => ['localPart' => 'demo123', 'ttlMinutes' => 60],
]);
$data = json_decode((string) $res->getBody(), true);`}</code></pre>
                    </div>
                  </div>
                  <div className="col-12 col-xl-6">
                    <div className="p-3 rounded-4 border bg-light h-100">
                      <div className="fw-bold mb-2">Go</div>
                      <pre className="partner-docs-code mb-0" style={{ fontSize: '0.8rem' }}><code>{`req, _ := http.NewRequest(http.MethodPost, "https://your-domain.com/api/v1/partner/aliases", strings.NewReader(body))
req.Header.Set("x-api-key", os.Getenv("PBS_API_KEY"))
req.Header.Set("content-type", "application/json")

resp, _ := http.DefaultClient.Do(req)
defer resp.Body.Close()`}</code></pre>
                    </div>
                  </div>
                </div>
              </div>

              <div className="partner-docs-section">
                <div className="partner-docs-kicker">6. Benar vs Salah</div>
                <h2 className="h4 mb-3">Cara pakai yang disarankan</h2>
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="p-3 rounded-4 border border-success bg-success-subtle h-100">
                      <div className="fw-bold text-success mb-2">Benar</div>
                      <ul className="mb-0 ps-3 small">
                        <li>Kirim hanya <code>localPart</code> saat domain tidak perlu dipaksa.</li>
                        <li>Biarkan server memilih domain aktif jika key tidak dibatasi domain.</li>
                        <li>Cek endpoint <code>/health</code> saat integrasi baru.</li>
                        <li>Gunakan alias yang sudah dikembalikan oleh server untuk request berikutnya.</li>
                      </ul>
                    </div>
                  </div>
                  <div className="col-12 col-lg-6">
                    <div className="p-3 rounded-4 border border-danger bg-danger-subtle h-100">
                      <div className="fw-bold text-danger mb-2">Salah</div>
                      <ul className="mb-0 ps-3 small">
                        <li>Mengirim <code>address</code> penuh dengan domain yang tidak aktif.</li>
                        <li>Mengubah domain sendiri tanpa memastikan domain itu aktif di PBS.</li>
                        <li>Menganggap semua domain bebas jika API key dibatasi domain.</li>
                        <li>Menebak format OTP tanpa membaca response dari server.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="partner-docs-section">
                <div className="partner-docs-kicker">Contoh 1</div>
                <h3 className="h5 mb-3">Buat alias</h3>
                <pre className="partner-docs-code"><code>{`curl -X POST https://your-domain.com/api/v1/partner/aliases \
  -H "x-api-key: tpk_xxx" \
  -H "content-type: application/json" \
  -d '{
    "localPart": "demo123",
    "ttlMinutes": 60,
    "reference": "partner-order-001"
  }'`}</code></pre>
                <p className="small text-secondary mb-0">
                  Kalau domain tidak perlu dipaksa, jangan kirim field <code>domain</code>. Server akan memilih domain aktif yang cocok untuk API key.
                </p>
              </div>

              <div className="partner-docs-section">
                <div className="partner-docs-kicker">Contoh 2</div>
                <h3 className="h5 mb-3">Ambil OTP</h3>
                <pre className="partner-docs-code"><code>{`GET /api/v1/partner/otp?alias=demo123@pbsmailer.tech&waitSeconds=20`}</code></pre>
                <p className="small text-secondary mb-0">
                  Parameter <code>waitSeconds</code> bersifat opsional. Jika diisi, API akan polling sampai kode ditemukan atau batas waktu habis.
                </p>
              </div>

              <div className="partner-docs-section">
                <div className="partner-docs-kicker">Catatan Penting</div>
                <ul className="mb-0 ps-3 partner-docs-list">
                  <li>Endpoint messages dan otp hanya bisa membaca alias yang dimiliki API key tersebut.</li>
                  <li>Rate limit dihitung per API key.</li>
                  <li>Gunakan scope sekecil mungkin untuk kebutuhan integrasi.</li>
                  <li>Rotasi API key lama setelah key baru aktif.</li>
                </ul>
              </div>

              <div className="partner-docs-section">
                <div className="partner-docs-kicker">Contoh Respons</div>
                <h3 className="h5 mb-3">Health check</h3>
                <pre className="partner-docs-code"><code>{`{
  "ok": true,
  "partnerApiEnabled": true,
  "rateLimit": {
    "limitPerMin": 60,
    "remaining": 58,
    "resetAt": "2026-04-21T10:30:00.000Z"
  }
}`}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}