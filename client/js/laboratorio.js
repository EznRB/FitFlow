// Usa os mesmos módulos da área autenticada para permitir consulta educativa sem banco.
// A seleção é comunicada visualmente e para leitores de tela sem simular uma sessão.
function selectLabSection(id, view) {
  for (const button of document.querySelectorAll('.science-lab-nav button')) {
    button.setAttribute('aria-pressed', String(button.id === id));
  }
  view.render();
}
document.getElementById('lab-nutrition').addEventListener('click', () => selectLabSection('lab-nutrition', NutricaoView));
document.getElementById('lab-evidence').addEventListener('click', () => selectLabSection('lab-evidence', EvidenciasView));
NutricaoView.render();
