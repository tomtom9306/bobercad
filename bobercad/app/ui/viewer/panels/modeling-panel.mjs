export function mountModelingPanel({ panel }) {
  panel.textContent = "B Beam  |  C Column  |  Tab snap  |  Shift axis lock";
  return {
    setMessage(message) {
      panel.textContent = message;
    }
  };
}
