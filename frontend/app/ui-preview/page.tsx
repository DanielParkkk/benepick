const pages = [
  "index.html",
  "analysis.html",
  "apply.html",
  "community.html",
  "portfolio.html",
  "search.html",
  "login.html",
  "signup.html",
  "profile.html",
  "recently-viewed.html",
  "scrap.html",
];

export default function UiPreviewPage() {
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 40px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>UI Preview (2026-04-21)</h1>
      <p style={{ color: "#555", marginBottom: 16 }}>
        기존 서비스 라우팅은 건드리지 않고, 신규 정적 UI를 안전하게 분리 통합한 미리보기 페이지입니다.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {pages.map((name) => (
          <a
            key={name}
            href={`/ui-2026-04-21/${name}`}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "8px 12px",
              border: "1px solid #d7d7d7",
              borderRadius: 8,
              textDecoration: "none",
              color: "#1f2937",
              fontSize: 14,
            }}
          >
            {name}
          </a>
        ))}
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
          기본 프리뷰: /ui-2026-04-21/index.html
        </div>
        <iframe
          title="UI Preview Index"
          src="/ui-2026-04-21/index.html"
          style={{ width: "100%", height: "80vh", border: "none" }}
        />
      </section>
    </main>
  );
}
