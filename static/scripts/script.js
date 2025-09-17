document.addEventListener("DOMContentLoaded", () => {
  const spanSaldo = document.getElementById("valor-saldo");
  const toggleBtn = document.getElementById("toggle-saldo");

  const valorOriginal = spanSaldo.textContent;
  let visivel = true;

  toggleBtn.addEventListener("click", () => {
    visivel = !visivel;

    if (visivel) {
      spanSaldo.textContent = valorOriginal;
      toggleBtn.src = "/static/assets/olho.png"; // olho aberto
    } else {
      spanSaldo.textContent = "R$ ••••••";
      toggleBtn.src = "/static/assets/olhos-fechados.png"; // olho fechado
    }
  });
});
