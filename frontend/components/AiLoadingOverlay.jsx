export default function AiLoadingOverlay() {
  return (
    <div className="ai-loading" id="aiLoading">
      <div className="ai-loading-card">
        <div className="ai-spinner"></div>
        <div className="ai-loading-text">
          <h3 data-i18n="ai_loading_title">AI 분석 중입니다...</h3>
          <p>입력하신 조건으로<br />수급 가능성을 계산하고 있어요</p>
          <br />
          <div className="ai-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
